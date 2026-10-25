// Public summaries only. Never put source emails, vendor rates or recruiter details here.
const currentOpenings = [
  {
    id: 'I2P-20261023-01', title: 'ServiceNow HRSD Consultant / Developer',
    location: 'Bengaluru, Hyderabad or Pune', experience: '3+ years of ServiceNow implementation experience; overall experience band to be confirmed',
    summary: 'Configure and develop HR service delivery solutions, workflows and integrations. Translate requirements into technical designs, test changes and document releases.',
    skills: ['ServiceNow HRSD', 'JavaScript', 'REST / SOAP', 'Workflows', 'CSA certification'],
    detail: 'One consultant opening. Experience with HR platform integrations, access controls and enterprise ServiceNow environments is required.'
  },
  {
    id: 'I2P-20261023-02', title: 'ServiceNow HRSD Senior Consultant',
    location: 'Bengaluru, Hyderabad or Pune', experience: '6+ years in ServiceNow implementations; 4+ years delivering an HRSD core module',
    summary: 'Lead HRSD workstreams from discovery and design through deployment. Guide functional and technical teams, manage delivery risks and work with HR stakeholders.',
    skills: ['ServiceNow HRSD', 'Project management', 'HR operations', 'Case management', 'Employee service portal'],
    detail: 'One senior consultant opening. Build implementation plans and user journeys, support configuration reviews and validate readiness for production.'
  },
  {
    id: 'I2P-20261023-03', title: 'UKG WFM Senior Consultant — Technical',
    location: 'Bengaluru, Hyderabad, Pune, Chennai or Kolkata', experience: '8+ years overall; 6–9 years of relevant application support experience',
    summary: 'Support UKG workforce management solutions, integrations, reporting and upgrades. Troubleshoot time, pay and access issues and support enterprise deployments.',
    skills: ['UKG Pro WFM', 'Workforce Dimensions', 'Dell Boomi', 'SQL / SSRS', 'WIM interfaces'],
    detail: 'Dell Boomi experience and certification are required. Work covers time and attendance, accruals, scheduling, analytics and payroll interfaces. International travel may be required. Headcount to be confirmed.'
  },
  {
    id: 'I2P-20261023-04', title: 'UKG WFM Senior Consultant — Functional',
    location: 'Bengaluru, Hyderabad, Pune, Chennai or Kolkata', experience: '8+ years overall; 4–6+ years of relevant functional application support experience',
    summary: 'Support and configure workforce management processes across timekeeping, accruals, attendance and scheduling. Resolve functional issues and collaborate with delivery teams.',
    skills: ['UKG Pro WFM', 'Workforce Dimensions', 'Time and attendance', 'Accruals', 'Advanced scheduling'],
    detail: 'Work includes pay policies, access settings, reporting and analytics. Strong communication and problem-solving skills are required. International travel may be required. Headcount to be confirmed.'
  },
  {
    id: 'I2P-20261023-05', title: 'SAP FSCM Consultant — Collections, Disputes & Credit Management',
    location: 'To be confirmed', experience: 'Experience requirement to be confirmed',
    summary: 'Urgent backfill opportunity for a resource with SAP FSCM expertise across collections, disputes and credit management who is ready for deployment.',
    skills: ['SAP FSCM', 'Collections management', 'Dispute management', 'Credit management'],
    detail: 'Location, engagement terms and detailed eligibility will be confirmed by the recruitment team. Availability will be requested during the portal application process.'
  }
];

function renderCurrentOpenings() {
  const escape = value => String(value).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  document.getElementById('current-opening-cards').innerHTML = currentOpenings.map(job => {
    return '<article class="card job"><span class="badge">Recruiting · 23 Oct 2026</span><h3>' + escape(job.title) + '</h3><p class="muted">' + escape(job.location) + '</p><p>' + escape(job.summary) + '</p><p>' + job.skills.map(skill => '<span class="skill">' + escape(skill) + '</span>').join('') + '</p><p><strong>Experience:</strong> ' + escape(job.experience) + '</p><p class="tiny">' + escape(job.detail) + '</p><p class="tiny muted">Reference: ' + escape(job.id) + ' · Engagement terms to be confirmed</p><button class="button primary" type="button" disabled aria-describedby="application-status">Portal applications unavailable</button></article>';
  }).join('');
}
renderCurrentOpenings();
