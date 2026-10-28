import { createClient } from 'npm:@supabase/supabase-js@2.118.0';
import nodemailer from 'npm:nodemailer@10.2.1';

const origin='https://www.idea2proj.com';
const cors={'Access-Control-Allow-Origin':origin,'Access-Control-Allow-Headers':'authorization, apikey, content-type, x-client-info','Access-Control-Allow-Methods':'POST, OPTIONS','Vary':'Origin'};
const reply=(status,data)=>Response.json(data,{status,headers:cors});
const escape=value=>String(value).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
function emailHTML(heading,title,id,submitted,url,label,note) {
  return '<div style="background:#f5f2e9;padding:24px;font-family:Arial,sans-serif;color:#20201e"><div style="max-width:600px;margin:auto;background:white;border-radius:12px;overflow:hidden"><div style="background:#111214;color:white;padding:24px;font-weight:bold">IDEA <span style="color:#f97316">2</span> PROJECT</div><div style="padding:28px"><h1>'+heading+'</h1><p><strong>'+escape(title)+'</strong></p><p>Application reference: '+escape(id)+'<br>Submitted: '+escape(submitted)+'</p><p><a href="'+escape(url)+'" style="display:inline-block;background:#f97316;color:#171717;padding:14px 20px;text-decoration:none;border-radius:8px;font-weight:bold">'+label+'</a></p><p>'+note+'</p><p>The Idea 2 Project Recruitment Team<br>info@idea2proj.com</p></div></div></div>';
}
Deno.serve(async request=>{
  if(request.method==='OPTIONS')return new Response(null,{headers:cors});
  if(request.method!=='POST')return reply(405,{error:'Method not allowed'});
  const token=request.headers.get('Authorization')?.replace(/^Bearer\s+/i,'');
  if(!token)return reply(401,{error:'Sign in required'});
  const admin=createClient(Deno.env.get('SUPABASE_URL'),Deno.env.get('SUPABASE_SERVICE_ROLE_KEY'),{auth:{persistSession:false,autoRefreshToken:false}});
  const {data:auth,error:authError}=await admin.auth.getUser(token);
  if(authError||!auth.user?.email||!auth.user.email_confirmed_at)return reply(401,{error:'Verified sign-in required'});
  let id;
  try {id=(await request.json()).application_id;if(!/^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i.test(id))throw Error();}
  catch{return reply(400,{error:'Valid application reference required'});}
  const {data:application,error}=await admin.from('job_applications').select('id,job_id,submitted_at').eq('id',id).eq('candidate_id',auth.user.id).maybeSingle();
  if(error)return reply(503,{error:'Application lookup unavailable'});
  if(!application)return reply(404,{error:'Application not found'});
  if(!Deno.env.get('RECRUITMENT_SMTP_PASSWORD'))return reply(503,{error:'Email delivery is being configured',state:'pending',recruiter_state:'pending'});
  const {data:job,error:jobError}=await admin.from('published_jobs').select('title').eq('id',application.job_id).single();
  if(jobError||!job)return reply(503,{error:'Job lookup unavailable'});
  const title=job.title.replace(/[\r\n]/g,' ');
  const submitted=new Date(application.submitted_at).toLocaleString('en-US',{timeZone:'Asia/Kolkata',dateStyle:'medium',timeStyle:'short'})+' IST';
  const candidateURL=origin+'/applications/recruitment/candidate.html?application='+id+'#my-applications';
  const recruiterURL=origin+'/applications/recruitment/reviewer.html?application='+id;
  const detail='\n\nApplication reference: '+id+'\nSubmitted: '+submitted;
  const candidateNote='Sign in with the email address you used to apply. Under My applications, check the latest status: Submitted, In review or Closed. You can also update your profile and latest CV. This email confirms receipt; it is not a selection or interview confirmation.';
  const recruiterNote='Sign in with an authorized recruiter account to review the application, candidate profile and latest CV securely inside the portal.';
  const messages=[
    {prefix:'',rpc:'claim_application_receipt',mail:{to:auth.user.email,subject:'Application received | '+title,messageId:'<application-'+id+'@idea2proj.com>',text:"Hello,\n\nWe've received your application for "+title+'.'+detail+'\n\nCheck your application status at any time:\n'+candidateURL+'\n\n'+candidateNote+'\n\nThe Idea 2 Project Recruitment Team\ninfo@idea2proj.com',html:emailHTML('Application received.',title,id,submitted,candidateURL,'Check application status',candidateNote)}},
    {prefix:'recruiter_',rpc:'claim_application_recruiter_notice',mail:{to:'info@idea2proj.com',subject:'New application to review | '+title,messageId:'<recruiter-application-'+id+'@idea2proj.com>',text:'A candidate has applied for '+title+'.'+detail+'\n\nReview application:\n'+recruiterURL+'\n\n'+recruiterNote,html:emailHTML('New application to review.',title,id,submitted,recruiterURL,'Review application',recruiterNote)}}
  ];
  const transporter=nodemailer.createTransport({host:'smtp.gmail.com',port:465,secure:true,auth:{user:'chandra@idea2proj.com',pass:Deno.env.get('RECRUITMENT_SMTP_PASSWORD')},connectionTimeout:15000,greetingTimeout:10000,socketTimeout:20000});
  let unavailable=false;
  try {
    // Independent leases prevent a failed recruiter alert resending a successful candidate receipt.
    for(const {prefix,rpc,mail} of messages){
      const {data:claimed,error:claimError}=await admin.rpc(rpc,{receipt_id:id});
      if(claimError){unavailable=true;continue;}
      if(!claimed?.length)continue;
      try{
        const delivery=await transporter.sendMail({from:'Idea 2 Project Recruitment <info@idea2proj.com>',...mail});
        if(!delivery.accepted?.length)throw Object.assign(Error('not_accepted'),{code:'not_accepted'});
        const {error:saveError}=await admin.from('job_application_receipts').update({[prefix+'state']:'sent',[prefix+'sent_at']:new Date().toISOString(),[prefix+'last_error']:null}).eq('application_id',id);
        if(saveError)unavailable=true;
      }catch(error){
        // Never store message content, credentials, tokens or candidate details.
        const code=String(error.code||'delivery_failed').slice(0,80);
        const {error:saveError}=await admin.from('job_application_receipts').update({[prefix+'state']:'failed',[prefix+'last_error']:code}).eq('application_id',id);
        if(saveError)unavailable=true;
      }
    }
    const {data:receipt,error:readError}=await admin.from('job_application_receipts').select('state,recruiter_state').eq('application_id',id).single();
    if(unavailable||readError||!receipt)return reply(503,{error:'Email status unavailable; your application remains saved'});
    return reply(receipt.state==='failed'||receipt.recruiter_state==='failed'?503:200,{state:receipt.state,recruiter_state:receipt.recruiter_state});
  }finally{transporter.close();}
});

