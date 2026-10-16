import { supabase } from './supabase';

// La sincronización con Google Sheets ahora la hace la base de datos (Supabase):
// la función `sync_leads_from_sheet` lee TODA la hoja, inserta los leads nuevos con su
// fecha real de ingreso y evita duplicados (mismo ID de Meta o mismo email).
// Corre sola cada 10 minutos (pg_cron). Este botón solo la ejecuta en el momento.
export async function syncFromSheets() {
  try {
    const { data, error } = await supabase.rpc('sync_leads_from_sheet');
    if (error) throw error;
    return { inserted: data || 0, updated: 0, skipped: 0 };
  } catch (err) {
    console.error('Sync error:', err);
    return { error: err.message };
  }
}
