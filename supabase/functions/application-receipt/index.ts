import { createClient } from 'npm:@supabase/supabase-js@2.118.0';
import nodemailer from 'npm:nodemailer@10.2.1';

const origin = 'https://www.idea2proj.com';
const cors = {'Access-Control-Allow-Origin':origin,'Access-Control-Allow-Headers':'authorization, apikey, content-type, x-client-info','Access-Control-Allow-Methods':'POST, OPTIONS','Vary':'Origin'};
const reply = (status,data) => Response.json(data,{status,headers:cors});
const escape = value => value.replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));

Deno.serve(async request => {
  if(request.method==='OPTIONS')return new Response(null,{headers:cors});
  if(request.method!=='POST')return reply(405,{error:'Method not allowed'});
  const token=request.headers.get('Authorization')?.replace(/^Bearer\s+/i,'');
  if(!token)return reply(401,{error:'Sign in required'});
  const admin=createClient(Deno.env.get('SUPABASE_URL'),Deno.env.get('SUPABASE_SERVICE_ROLE_KEY'),{auth:{persistSession:false,autoRefreshToken:false}});
  const {data:auth,error:authError}=await admin.auth.getUser(token);
  if(authError || !auth.user?.email || !auth.user.email_confirmed_at)return reply(401,{error:'Verified sign-in required'});
  let id;
  try { id=(await request.json()).application_id; if(!/^[a-f0-9-]{36}$/i.test(id))throw Error(); }
  catch {return reply(400,{error:'Valid application reference required'});}
  const {data:application,error}=await admin.from('job_applications').select('id,job_id,submitted_at').eq('id',id).eq('candidate_id',auth.user.id).maybeSingle();
  if(error)return reply(503,{error:'Application lookup unavailable'});
  if(!application)return reply(404,{error:'Application not found'});
  if(!Deno.env.get('RECRUITMENT_SMTP_PASSWORD'))return reply(503,{error:'Email delivery is being configured',state:'pending'});
  const {data:claimed,error:claimError}=await admin.rpc('claim_application_receipt',{receipt_id:id});
  if(claimError)return reply(503,{error:'Email queue unavailable'});
  if(!claimed?.length){
    const {data:receipt}=await admin.from('job_application_receipts').select('state,sent_at').eq('application_id',id).single();
    return reply(200,{state:receipt?.state||'pending'});
  }
  let transporter;
  try {
    const {data:job,error:jobError}=await admin.from('published_jobs').select('title').eq('id',application.job_id).single();
    if(jobError)throw Error('job_lookup');
    const title=job.title.replace(/[\r\n]/g,' ');
    const submitted=new Date(application.submitted_at).toLocaleString('en-US',{timeZone:'Asia/Kolkata',dateStyle:'medium',timeStyle:'short'})+' IST';
    const url=origin+'/demos/recruitment/candidate.html';
    const text=`Hello,\n\nWe’ve received your application for ${title}.\n\nApplication reference: ${id}\nSubmitted: ${submitted}\n\nYou can sign in to view your application, update your profile and keep your latest CV current:\n${url}\n\nOur recruitment team will review your application and contact you if there is a suitable next step. This email confirms receipt; it is not a selection or interview confirmation.\n\nThe Idea 2 Project Recruitment Team\ninfo@idea2proj.com`;
    const html=`<div style="background:#f5f2e9;padding:24px;font-family:Arial,sans-serif;color:#20201e"><div style="max-width:600px;margin:auto;background:white;border-radius:12px;overflow:hidden"><div style="background:#111214;color:white;padding:24px;font-weight:bold">IDEA <span style="color:#f97316">2</span> PROJECT</div><div style="padding:28px"><h1 style="font-size:28px">Application received.</h1><p>Hello,</p><p>We’ve received your application for <strong>${escape(title)}</strong>.</p><p><strong>Reference:</strong> ${escape(id)}<br><strong>Submitted:</strong> ${escape(submitted)}</p><p><a href="${url}" style="display:inline-block;background:#f97316;color:#171717;padding:14px 20px;text-decoration:none;border-radius:8px;font-weight:bold">View my applications →</a></p><p>Our recruitment team will review your application and contact you if there is a suitable next step.</p><p>You can update your profile and latest CV in your candidate workspace.</p><p style="font-size:13px;color:#61615b">This email confirms receipt. It is not a selection or interview confirmation.</p><p>The Idea 2 Project Recruitment Team<br><a href="mailto:info@idea2proj.com">info@idea2proj.com</a></p></div></div></div>`;
    transporter=nodemailer.createTransport({host:'smtp.gmail.com',port:465,secure:true,auth:{user:'chandra@idea2proj.com',pass:Deno.env.get('RECRUITMENT_SMTP_PASSWORD')},connectionTimeout:15000,greetingTimeout:10000,socketTimeout:20000});
    await transporter.sendMail({from:'Idea 2 Project Recruitment <info@idea2proj.com>',to:auth.user.email,subject:'Application received | '+title,messageId:`<application-${id}@idea2proj.com>`,text,html});
    const {error:saveError}=await admin.from('job_application_receipts').update({state:'sent',sent_at:new Date().toISOString(),last_error:null}).eq('application_id',id);
    if(saveError)return reply(503,{state:'sending',error:'Delivery status could not be recorded'});
    return reply(200,{state:'sent'});
  } catch(error) {
    // Do not log message content, credentials, tokens or candidate details.
    const code=String(error.code||'delivery_failed').slice(0,80);
    await admin.from('job_application_receipts').update({state:'failed',last_error:code}).eq('application_id',id);
    return reply(503,{state:'failed',error:'Email delivery failed; your application remains saved'});
  } finally {transporter?.close();}
});
