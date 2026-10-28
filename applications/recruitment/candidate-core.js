(function(root) {
  'use strict';
  const MAX_CV_BYTES = 5 * 1024 * 1024;
  function configReady(config) {
    if (!config || !/^https:\/\/[a-z0-9-]+\.supabase\.co$/.test(config.supabaseUrl || '')) return false;
    const key = config.supabasePublishableKey || '';
    if (/^sb_publishable_[A-Za-z0-9_-]{16,}$/.test(key)) return true;
    try {
      const payload = JSON.parse(atob(key.split('.')[1].replace(/-/g, '+').replace(/_/g, '/')));
      return payload.role === 'anon' && key.split('.').length === 3;
    } catch { return false; }
  }
  function profilePayload(id, input) {
    const text = (key, max, required = false) => {
      const val = String(input[key] || '').trim();
      if ((required && !val) || val.length > max) throw Error('Check the length of your ' + key.replace(/_/g, ' ') + '.');
      return val;
    };
    if (!id) throw Error('Sign in before saving your profile.');
    if (!input.consent) throw Error('Please confirm permission to store your profile and CV for recruitment.');
    const years = Number(input.experience_years);
    if (String(input.experience_years).trim() === '' || !Number.isFinite(years) || years < 0 || years > 80 || Math.round(years * 10) !== years * 10) throw Error('Enter experience from 0 to 80 years, with at most one decimal place.');
    const skills = [...new Set(String(input.skills || '').split(',').map(x => x.trim()).filter(Boolean))];
    if (!skills.length || skills.length > 30 || skills.some(x => x.length > 60)) throw Error('Enter 1–30 skills, each no longer than 60 characters.');
    return {id, full_name:text('full_name',120,true), headline:text('headline',200), location:text('location',120), phone:text('phone',40), experience_years:years, skills, summary:text('summary',4000), consent_version:'2026-10-v1'};
  }
  async function validateCV(file) {
    if (!file || !file.size) throw Error('Choose a PDF CV to upload.');
    if (file.size > MAX_CV_BYTES) throw Error('Your CV must be 5 MB or smaller.');
    if (!/\.pdf$/i.test(file.name) || (file.type && file.type !== 'application/pdf')) throw Error('Please upload a PDF file.');
    const header = new Uint8Array(await file.slice(0,5).arrayBuffer());
    if (String.fromCharCode(...header) !== '%PDF-') throw Error('The selected file does not appear to be a PDF.');
  }
  const api = {configReady,profilePayload,validateCV,MAX_CV_BYTES};
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.CandidateCore = Object.freeze(api);
})(globalThis);
