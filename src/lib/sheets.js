import { supabase, assignCS } from './supabase';

const SHEET_ID   = process.env.REACT_APP_GOOGLE_SHEET_ID;
const API_KEY    = process.env.REACT_APP_GOOGLE_API_KEY;
const SHEET_NAME = process.env.REACT_APP_GOOGLE_SHEET_NAME || 'Sheet1';

function rowToLead(row) {
  return {
    sheet_id:   row[0]  || '',
    created_at: row[1]  || '',
    ad_name:    row[3]  || '',
    platform:   row[11] || '',
    intent:     row[12] || '',
    timeline:   row[13] || '',
    full_name:  row[14] || '',
    email:      row[15] || '',
    phone:      (row[16] || '').replace('p:', '').trim(),
    source:     'META',
  };
}

async function fetchSheetLeads() {
  const range = encodeURIComponent(`${SHEET_NAME}!A2:S2000`);
  const url   = `https://sheets.googleapis.com/v4/spreadsheets/${SHEET_ID}/values/${range}?key=${API_KEY}`;
  const res   = await fetch(url);
  if (!res.ok) throw new Error(`Google Sheets error: ${res.status}`);
  const data  = await res.json();
  return (data.values || []).filter(r => r[0] && r[14]);
}

async function getAllLeads() {
  let all = [];
  let page = 0;
  const size = 1000;
  while (true) {
    const { data, error } = await supabase
      .from('leads')
      .select('id, sheet_id, phone, assigned_to')
      .range(page * size, (page + 1) * size - 1);
    if (error || !data || data.length === 0) break;
    all = all.concat(data);
    if (data.length < size) break;
    page++;
  }
  return all;
}

export async function syncFromSheets() {
  try {
    const sheetRows = await fetchSheetLeads();
    if (!sheetRows.length) return { inserted: 0, updated: 0, skipped: 0 };

    const dbLeads = await getAllLeads();
    const bySheetId = new Map(dbLeads.filter(l => l.sheet_id).map(l => [l.sheet_id, l]));
    const byPhone   = new Map(dbLeads.filter(l => l.phone).map(l => [l.phone.trim(), l]));

    const counts = {};
    CS_USERS_REF.forEach(cs => { counts[cs.email] = 0; });
    dbLeads.forEach(l => {
      if (l.assigned_to && counts.hasOwnProperty(l.assigned_to)) counts[l.assigned_to]++;
    });

    const toInsert = [];
    const toUpdate = [];

    for (const row of sheetRows) {
      const lead = rowToLead(row);
      if (!lead.full_name || lead.full_name.length < 2) continue;

      const existing = bySheetId.get(lead.sheet_id) || byPhone.get(lead.phone);

      if (existing) {
        toUpdate.push({
          id:       existing.id,
          intent:   lead.intent,
          timeline: lead.timeline,
          sheet_id: lead.sheet_id,
        });
      } else {
        lead.status      = 'New';
        lead.touches     = [];
        lead.assigned_to = assignCS(counts);
        counts[lead.assigned_to] = (counts[lead.assigned_to] || 0) + 1;
        toInsert.push(lead);
      }
    }

    let inserted = 0;
    for (let i = 0; i < toInsert.length; i += 200) {
      const batch = toInsert.slice(i, i + 200);
      const { error } = await supabase.from('leads').insert(batch);
      if (!error) inserted += batch.length;
      else console.error('Insert error:', error.message);
    }

    let updated = 0;
    for (let i = 0; i < toUpdate.length; i += 50) {
      const batch = toUpdate.slice(i, i + 50);
      await Promise.all(batch.map(async (u) => {
        const { error } = await supabase
          .from('leads')
          .update({ intent: u.intent, timeline: u.timeline, sheet_id: u.sheet_id })
          .eq('id', u.id);
        if (!error) updated++;
      }));
    }

    return { inserted, updated, skipped: sheetRows.length - inserted - updated };
  } catch (err) {
    console.error('Sync error:', err);
    return { error: err.message };
  }
}

import { CS_USERS as CS_USERS_REF } from './supabase';
