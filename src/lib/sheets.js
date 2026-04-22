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
    phone:       (row[16] || '').replace('p:', '').trim(), // columna Q: phone_number
    source:      'META',
    status:      'New',
    touches:     [],
  };
}

// Obtiene todos los leads del Google Sheet
// FIX: rango ampliado a 2000 filas y columna S para capturar todos los campos
async function fetchSheetLeads() {
  const range = encodeURIComponent(`${SHEET_NAME}!A2:S2000`);
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

    // FIX: obtener TODOS los IDs existentes sin límite de 100
    let existingIds = new Set();
    let from = 0;
    const batchSize = 1000;
    while (true) {
      const { data: existing, error } = await supabase
        .from('leads')
        .select('sheet_id')
        .range(from, from + batchSize - 1);
      if (error || !existing || existing.length === 0) break;
      existing.forEach(r => { if (r.sheet_id) existingIds.add(r.sheet_id); });
      if (existing.length < batchSize) break;
      from += batchSize;
    }

    // Filtrar solo los nuevos
    const newRows = sheetRows.filter(r => !existingIds.has(r[0]));
    if (!newRows.length) return { inserted: 0, skipped: sheetRows.length };

    // FIX: obtener conteo actual por CS con paginación completa
    let allLeads = [];
    let page = 0;
    while (true) {
      const { data: batch } = await supabase
        .from('leads')
        .select('assigned_to')
        .range(page * batchSize, (page + 1) * batchSize - 1);
      if (!batch || batch.length === 0) break;
      allLeads = allLeads.concat(batch);
      if (batch.length < batchSize) break;
      page++;
    }

    const counts = {};
    CS_USERS_REF.forEach(cs => { counts[cs.email] = 0; });
    allLeads.forEach(r => {
      if (r.assigned_to && counts.hasOwnProperty(r.assigned_to)) {
        counts[r.assigned_to]++;
      }
    });

    // Construir leads con asignación automática balanceada
    const toInsert = newRows.map(row => {
      const lead = rowToLead(row);
      lead.assigned_to = assignCS(counts);
      counts[lead.assigned_to] = (counts[lead.assigned_to] || 0) + 1;
      return lead;
    });

    // Insertar en lotes de 200
    let inserted = 0;
    for (let i = 0; i < toInsert.length; i += 200) {
      const batch = toInsert.slice(i, i + 200);
      const { error } = await supabase.from('leads').insert(batch);
      if (error) {
        console.error('Insert error:', error);
      } else {
        inserted += batch.length;
      }
    }

    return { inserted, skipped: existingIds.size };
  } catch (err) {
    console.error('Sync error:', err);
    return { error: err.message };
  }
}

// Para que assignCS tenga referencia al array
import { CS_USERS as CS_USERS_REF } from './supabase';
