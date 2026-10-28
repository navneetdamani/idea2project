// Public summaries only. Never put source emails, vendor rates or recruiter details here.
const currentOpenings = [
  {
    id: 'I2P-20261027-01', title: 'FIS Profile 7 Techno-Functional Consultant', published: '27 Oct 2026',
    location: 'Hyderabad, Bengaluru, Chennai or Pune', experience: '2-5 years',
    summary: 'Support banking solutions on FIS Profile 7, combining functional banking knowledge with profile scripting, integrations and data migration.',
    skills: ['FIS Profile 7', 'MUMPS / GT.M', 'SQL', 'ETL / ELT', 'API integrations', 'Banking'],
    detail: 'One opening. Experience with deposits, savings, account reconciliation and virtual back-office processes is relevant. Data architecture and migration experience are required. COBOL, JCL and next-generation banking platforms are useful additions. Hybrid arrangement; working hours and office schedule to be confirmed.'
  },
  {
    id: 'I2P-20261027-02', title: 'JD Edwards Manufacturing Functional Consultant', published: '27 Oct 2026',
    location: 'India - office location to be confirmed; remote may be considered', experience: '8-10 years overall; 6+ years of relevant JDE experience',
    summary: 'Deliver client-facing functional consulting for JD Edwards EnterpriseOne Manufacturing, including inventory, product data, costing and shop-floor processes.',
    skills: ['JD Edwards EnterpriseOne', 'Manufacturing', 'Inventory Management', 'Product Costing', 'Shop Floor Control', 'Manufacturing Accounting'],
    detail: 'One opening. Hands-on EnterpriseOne 9.0, 9.1 or 9.2 experience is required. The stated schedule is 2-11 p.m. IST, with 2-3 office days per week. Remote working may be considered for a suitable candidate. Two virtual interview rounds are planned.'
  },
  {
    id: 'I2P-20261027-03', title: 'JD Edwards Sales & Distribution Functional Consultant', published: '27 Oct 2026',
    location: 'India - office location to be confirmed', experience: 'Relevant EnterpriseOne Sales & Distribution experience required; experience band to be confirmed',
    summary: 'Support JD Edwards EnterpriseOne Sales & Distribution processes across procurement, order management, inventory, pricing, warehousing and logistics.',
    skills: ['JD Edwards EnterpriseOne', 'Sales & Distribution', 'Procure to Pay', 'Order to Cash', 'Advanced Pricing', 'Warehousing'],
    detail: 'Three openings were requested across the related requisitions. This is a client-facing functional role. The stated schedule is 2-11 p.m. IST, with 2-3 office days per week and two virtual interview rounds. Final experience eligibility will be confirmed during recruiter review.'
  },
  {
    id: 'I2P-20261027-04', title: 'Senior Mendix Developer', published: '27 Oct 2026',
    location: 'India - office location to be confirmed', experience: '6-8 years, including substantial hands-on Mendix development',
    summary: 'Design, build and support secure, scalable Mendix applications, workflows, integrations and reusable components from requirements through deployment.',
    skills: ['Mendix Studio Pro', 'Domain modeling', 'Microflows / Nanoflows', 'REST / SOAP', 'Relational databases', 'CI/CD'],
    detail: 'Rotational shifts. Experience with application security, lifecycle management, testing, code review and production support is required. Mendix Advanced or Expert certification, cloud deployments and Java or JavaScript experience are useful additions. Additional screening requirements will be coordinated by the recruitment team.'
  }

];

function renderCurrentOpenings() {
  const escape = value => String(value).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  document.getElementById('current-opening-cards').innerHTML = currentOpenings.map(job => {
    return '<article class="card job"><span class="badge">Recruiting · ' + escape(job.published || '23 Oct 2026') + '</span><h3>' + escape(job.title) + '</h3><p class="muted">' + escape(job.location) + '</p><p>' + escape(job.summary) + '</p><p>' + job.skills.map(skill => '<span class="skill">' + escape(skill) + '</span>').join('') + '</p><p><strong>Experience:</strong> ' + escape(job.experience) + '</p><p class="tiny">' + escape(job.detail) + '</p><p class="tiny muted">Reference: ' + escape(job.id) + ' · Engagement terms to be confirmed</p><a class="button primary" href="candidate.html?job=' + encodeURIComponent(job.id) + '">Apply through portal →</a></article>';
  }).join('');
}
globalThis.TalentFlowOpenings=currentOpenings;
if(document.getElementById('current-opening-cards'))renderCurrentOpenings();
