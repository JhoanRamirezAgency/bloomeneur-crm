import { supabase, assignCS } from './supabase';

const SHEET_ID   = process.env.REACT_APP_GOOGLE_SHEET_ID;
const API_KEY    = process.env.REACT_APP_GOOGLE_API_KEY;
const SHEET_NAME = process.env.REACT_APP_GOOGLE_SHEET_NAME || 'Sheet1';

// Convierte una fila del Sheet al formato del CRM
function rowToLead(row) {
  return {
    sheet_id:    row[0]  || '',          // columna A: id del lead de META
    created_at:  row[1]  || '',          // columna B: created_time
    ad_name:     row[3]  || '',          // columna D: ad_name
    platform:    row[11] || '',          // columna L: platform (fb/ig)
    intent:      row[12] || '',          // columna M: are_you_interested...
    timeline:    row[13] || '',          // columna N: when_would_you_like...
    full_name:   row[14] || '',          // columna O: full_name
    email:       row[15] || '',          // columna P: email
    phone:       (row[16] || '').replace('p:', ''), // columna Q: phone_number
    source:      'META',
    status:      'New',
    touches:     [],
  };
}

// Obtiene todos los leads del Google Sheet
async function fetchSheetLeads() {
  const range = encodeURIComponent(`${SHEET_NAME}!A2:R1000`);
  const url   = `https://sheets.googleapis.com/v4/spreadsheets/${SHEET_ID}/values/${range}?key=${API_KEY}`;
  const res   = await fetch(url);
  if (!res.ok) throw new Error(`Google Sheets error: ${res.status}`);
  const data  = await res.json();
  return (data.values || []).filter(r => r[0] && r[14]); // requiere id y nombre
}

// Sincroniza leads nuevos desde Google Sheets → Supabase
// Solo inserta los que no existen (por sheet_id único)
export async function syncFromSheets() {
  try {
    const sheetRows = await fetchSheetLeads();
    if (!sheetRows.length) return { inserted: 0, skipped: 0 };

    // Obtener IDs ya existentes en Supabase
    const { data: existing } = await supabase
      .from('leads')
      .select('sheet_id');
    const existingIds = new Set((existing || []).map(r => r.sheet_id));

    // Filtrar solo los nuevos
    const newRows = sheetRows.filter(r => !existingIds.has(r[0]));
    if (!newRows.length) return { inserted: 0, skipped: sheetRows.length };

    // Obtener conteo actual por CS para distribución
    const { data: csCounts } = await supabase
      .from('leads')
      .select('assigned_to');
    const counts = {};
    CS_USERS_REF.forEach(cs => counts[cs.email] = 0);
    (csCounts || []).forEach(r => {
      if (r.assigned_to) counts[r.assigned_to] = (counts[r.assigned_to] || 0) + 1;
    });

    // Construir leads con asignación automática
    const toInsert = newRows.map(row => {
      const lead = rowToLead(row);
      lead.assigned_to = assignCS(counts);
      counts[lead.assigned_to] = (counts[lead.assigned_to] || 0) + 1;
      return lead;
    });

    const { error } = await supabase.from('leads').insert(toInsert);
    if (error) throw error;

    return { inserted: toInsert.length, skipped: existingIds.size };
  } catch (err) {
    console.error('Sync error:', err);
    return { error: err.message };
  }
}

// Para que assignCS tenga referencia al array
import { CS_USERS as CS_USERS_REF } from './supabase';
