import React, { useEffect, useState, useCallback } from 'react';

const SHEET_ID   = process.env.REACT_APP_DAPTA_SHEET_ID || '1PktcgX3W1iEVI8G7DMdOG1w8bQ-NmutlBhLphHRxyvU';
const API_KEY    = process.env.REACT_APP_GOOGLE_API_KEY;
const SHEET_NAME = 'contacts_results';
const LOG_SHEET  = 'call_log';

// ── Helpers ────────────────────────────────────────────────────────────────────
function pct(a, b) {
  if (!b) return '0%';
  return Math.round((a / b) * 100) + '%';
}
function fmt(secs) {
  if (!secs) return '0s';
  const m = Math.floor(secs / 60);
  const s = secs % 60;
  return m > 0 ? `${m}m ${s}s` : `${s}s`;
}
function fmtDate(str) {
  if (!str) return '-';
  try { return new Date(str).toLocaleString('es-CO', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' }); }
  catch { return str; }
}

async function fetchSheet(sheetName) {
  const range = encodeURIComponent(`${sheetName}!A1:Z3000`);
  const url   = `https://sheets.googleapis.com/v4/spreadsheets/${SHEET_ID}/values/${range}?key=${API_KEY}`;
  const res   = await fetch(url);
  if (!res.ok) throw new Error(`Sheets error ${res.status}`);
  const data  = await res.json();
  const rows  = data.values || [];
  if (rows.length < 2) return [];
  const headers = rows[0];
  return rows.slice(1).map(row => {
    const obj = {};
    headers.forEach((h, i) => { obj[h] = row[i] || ''; });
    return obj;
  });
}

// ── Styles ─────────────────────────────────────────────────────────────────────
const S = {
  wrap:   { minHeight: '100vh', background: '#F5F5F3', fontFamily: 'system-ui, sans-serif' },
  topbar: { background: '#fff', borderBottom: '1px solid #E8E7E2', padding: '0 24px', height: 52, display: 'flex', alignItems: 'center', justifyContent: 'space-between', position: 'sticky', top: 0, zIndex: 100 },
  topLeft:{ display: 'flex', alignItems: 'center', gap: 12 },
  backBtn:{ background: 'none', border: '1px solid #E8E7E2', borderRadius: 6, padding: '5px 12px', fontSize: 12, color: '#5F5E5A', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6 },
  title:  { fontSize: 15, fontWeight: 600, color: '#1A1916' },
  badge:  { background: '#6C47FF15', color: '#6C47FF', borderRadius: 20, padding: '2px 10px', fontSize: 11, fontWeight: 600 },
  syncBtn:{ background: '#F5F5F3', border: '1px solid #E8E7E2', borderRadius: 6, padding: '5px 12px', fontSize: 12, color: '#5F5E5A', cursor: 'pointer' },
  syncTime:{ fontSize: 11, color: '#A8A79D' },
  body:   { padding: '24px 28px', maxWidth: 1400, margin: '0 auto' },
  grid:   { display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 16, marginBottom: 24 },
  card:   { background: '#fff', borderRadius: 10, padding: '18px 20px', border: '1px solid #E8E7E2' },
  cardLabel: { fontSize: 11, color: '#A8A79D', fontWeight: 500, textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 6 },
  cardVal:{ fontSize: 26, fontWeight: 700, color: '#1A1916' },
  cardSub:{ fontSize: 12, color: '#A8A79D', marginTop: 2 },
  section:{ background: '#fff', borderRadius: 10, border: '1px solid #E8E7E2', marginBottom: 20, overflow: 'hidden' },
  secHead:{ padding: '14px 20px', borderBottom: '1px solid #E8E7E2', display: 'flex', alignItems: 'center', justifyContent: 'space-between' },
  secTitle:{ fontSize: 13, fontWeight: 600, color: '#1A1916' },
  table:  { width: '100%', borderCollapse: 'collapse', fontSize: 12 },
  th:     { padding: '10px 16px', textAlign: 'left', color: '#A8A79D', fontWeight: 500, fontSize: 11, borderBottom: '1px solid #E8E7E2', background: '#FAFAF8' },
  td:     { padding: '10px 16px', borderBottom: '1px solid #F0EFE8', color: '#1A1916', verticalAlign: 'middle' },
  pill:   (bg, color) => ({ background: bg, color, borderRadius: 20, padding: '2px 8px', fontSize: 11, fontWeight: 500, display: 'inline-block' }),
  search: { background: '#F5F5F3', border: '1px solid #E8E7E2', borderRadius: 6, padding: '6px 12px', fontSize: 12, width: 220, outline: 'none' },
  bar:    (pct, color) => ({ height: 6, borderRadius: 3, background: color, width: pct + '%', maxWidth: '100%' }),
  barBg:  { height: 6, borderRadius: 3, background: '#F0EFE8', marginTop: 4 },
};

const SENT_COLOR = {
  'Positive': ['#EAF3DE', '#3B6D11'],
  'Neutral':  ['#E6F1FB', '#185FA5'],
  'Negative': ['#FAECE7', '#993C1D'],
  '':         ['#F1EFE8', '#5F5E5A'],
};

const DISC_COLOR = {
  'user_hangup':       ['#FAECE7', '#993C1D'],
  'voicemail_reached': ['#FAEEDA', '#854F0B'],
  'agent_hangup':      ['#EAF3DE', '#3B6D11'],
  'call_transfer':     ['#E6F1FB', '#185FA5'],
  'dial_no_answer':    ['#F1EFE8', '#5F5E5A'],
};

export default function DaptaPage({ onBack }) {
  const [contacts, setContacts] = useState([]);
  const [logs, setLogs]         = useState([]);
  const [loading, setLoading]   = useState(true);
  const [error, setError]       = useState('');
  const [search, setSearch]     = useState('');
  const [lastSync, setLastSync] = useState(null);
  const [syncing, setSyncing]   = useState(false);
  const [tab, setTab]           = useState('contacts'); // contacts | calls
  const [selectedCall, setSelectedCall] = useState(null);

  const load = useCallback(async () => {
    try {
      setSyncing(true);
      const [c, l] = await Promise.all([
        fetchSheet(SHEET_NAME),
        fetchSheet(LOG_SHEET),
      ]);
      setContacts(c);
      setLogs(l);
      setLastSync(new Date());
      setError('');
    } catch (e) {
      setError('Error al cargar datos: ' + e.message);
    } finally {
      setLoading(false);
      setSyncing(false);
    }
  }, []);

  useEffect(() => {
    load();
    const iv = setInterval(load, 30 * 60 * 1000); // auto-sync cada 30 min
    return () => clearInterval(iv);
  }, [load]);

  // ── Métricas ──────────────────────────────────────────────────────────────
  const totalContacts  = contacts.length;
  const totalAttempts  = contacts.reduce((s, c) => s + (parseInt(c.call_atempts) || 0), 0);
  const totalConnected = contacts.reduce((s, c) => s + (parseInt(c.connected_calls) || 0), 0);
  const totalSuccess   = contacts.reduce((s, c) => s + (parseInt(c.successful_calls) || 0), 0);
  const totalDuration  = logs.reduce((s, l) => s + (parseFloat(l.duration) || 0), 0);
  const avgDuration    = logs.length ? Math.round(totalDuration / logs.length) : 0;

  const sentiments = logs.reduce((acc, l) => {
    const s = l.user_sentiment || 'Unknown';
    acc[s] = (acc[s] || 0) + 1;
    return acc;
  }, {});

  const discReasons = logs.reduce((acc, l) => {
    const r = l.disconnection_reason || 'unknown';
    acc[r] = (acc[r] || 0) + 1;
    return acc;
  }, {});

  // ── Filtrado ──────────────────────────────────────────────────────────────
  const filteredContacts = contacts.filter(c => {
    const q = search.toLowerCase();
    return !q || c.contact_name?.toLowerCase().includes(q) || String(c.to_number).includes(q);
  });

  const filteredLogs = logs.filter(l => {
    const q = search.toLowerCase();
    const vars = l.dynamic_variables || '';
    const name = vars.match(/"contact_name":"([^"]+)"/)?.[1] || '';
    return !q || name.toLowerCase().includes(q) || String(l.to_number).includes(q);
  });

  if (loading) return (
    <div style={{ ...S.wrap, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#A8A79D', fontSize: 13 }}>
      Cargando datos del agente IA...
    </div>
  );

  return (
    <div style={S.wrap}>
      {/* ── TOPBAR ── */}
      <div style={S.topbar}>
        <div style={S.topLeft}>
          <button style={S.backBtn} onClick={onBack}>← Volver</button>
          <span style={S.title}>Agente IA DAPTA</span>
          <span style={S.badge}>Solo Admin</span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          {error && <span style={{ fontSize: 11, color: '#993C1D' }}>{error}</span>}
          <span style={S.syncTime}>
            {lastSync ? `Última sync: ${lastSync.toLocaleTimeString('es-CO', { hour: '2-digit', minute: '2-digit' })}` : ''}
          </span>
          <button style={S.syncBtn} onClick={load} disabled={syncing}>
            {syncing ? '⟳ Actualizando...' : '⟳ Actualizar'}
          </button>
        </div>
      </div>

      <div style={S.body}>
        {/* ── MÉTRICAS ── */}
        <div style={S.grid}>
          <div style={S.card}>
            <div style={S.cardLabel}>Total contactos</div>
            <div style={S.cardVal}>{totalContacts}</div>
            <div style={S.cardSub}>{totalAttempts} intentos totales</div>
          </div>
          <div style={S.card}>
            <div style={S.cardLabel}>Tasa de conexión</div>
            <div style={{ ...S.cardVal, color: '#185FA5' }}>{pct(totalConnected, totalAttempts)}</div>
            <div style={S.cardSub}>{totalConnected} contestaron</div>
          </div>
          <div style={S.card}>
            <div style={S.cardLabel}>Llamadas exitosas</div>
            <div style={{ ...S.cardVal, color: '#3B6D11' }}>{pct(totalSuccess, totalConnected)}</div>
            <div style={S.cardSub}>{totalSuccess} transferidas / completadas</div>
          </div>
          <div style={S.card}>
            <div style={S.cardLabel}>Duración promedio</div>
            <div style={S.cardVal}>{fmt(avgDuration)}</div>
            <div style={S.cardSub}>{logs.length} llamadas registradas</div>
          </div>
        </div>

        {/* ── FILA: SENTIMIENTO + RAZONES ── */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 20 }}>
          {/* Sentimiento */}
          <div style={S.section}>
            <div style={S.secHead}><span style={S.secTitle}>Sentimiento del usuario</span></div>
            <div style={{ padding: '16px 20px', display: 'flex', flexDirection: 'column', gap: 10 }}>
              {Object.entries(sentiments).sort((a,b) => b[1]-a[1]).map(([s, count]) => {
                const [bg, color] = SENT_COLOR[s] || SENT_COLOR[''];
                return (
                  <div key={s}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 3 }}>
                      <span style={S.pill(bg, color)}>{s}</span>
                      <span style={{ fontSize: 12, color: '#5F5E5A' }}>{count} ({pct(count, logs.length)})</span>
                    </div>
                    <div style={S.barBg}>
                      <div style={S.bar(Math.round(count/logs.length*100), color)} />
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Razones de desconexión */}
          <div style={S.section}>
            <div style={S.secHead}><span style={S.secTitle}>Razón de desconexión</span></div>
            <div style={{ padding: '16px 20px', display: 'flex', flexDirection: 'column', gap: 10 }}>
              {Object.entries(discReasons).sort((a,b) => b[1]-a[1]).slice(0,6).map(([r, count]) => {
                const [bg, color] = DISC_COLOR[r] || ['#F1EFE8', '#5F5E5A'];
                return (
                  <div key={r}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 3 }}>
                      <span style={S.pill(bg, color)}>{r.replace(/_/g, ' ')}</span>
                      <span style={{ fontSize: 12, color: '#5F5E5A' }}>{count} ({pct(count, logs.length)})</span>
                    </div>
                    <div style={S.barBg}>
                      <div style={S.bar(Math.round(count/logs.length*100), color)} />
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        {/* ── TABS: Contactos / Llamadas ── */}
        <div style={S.section}>
          <div style={{ ...S.secHead, gap: 16 }}>
            <div style={{ display: 'flex', gap: 8 }}>
              {['contacts','calls'].map(t => (
                <button key={t} onClick={() => setTab(t)} style={{
                  background: tab === t ? '#1A1916' : 'none',
                  color:      tab === t ? '#fff' : '#5F5E5A',
                  border: '1px solid ' + (tab === t ? '#1A1916' : '#E8E7E2'),
                  borderRadius: 6, padding: '4px 14px', fontSize: 12, cursor: 'pointer', fontWeight: 500,
                }}>
                  {t === 'contacts' ? `Contactos (${contacts.length})` : `Registro de llamadas (${logs.length})`}
                </button>
              ))}
            </div>
            <input
              style={S.search}
              placeholder="Buscar nombre o teléfono..."
              value={search}
              onChange={e => setSearch(e.target.value)}
            />
          </div>

          {/* TABLA CONTACTOS */}
          {tab === 'contacts' && (
            <div style={{ overflowX: 'auto' }}>
              <table style={S.table}>
                <thead>
                  <tr>
                    {['Contacto','Teléfono','Estado','Intentos','Conectadas','Exitosas','Última llamada','Motivo desconexión'].map(h => (
                      <th key={h} style={S.th}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {filteredContacts.map((c, i) => {
                    const [bg, color] = DISC_COLOR[c.last_call_disconnection_reason] || ['#F1EFE8','#5F5E5A'];
                    return (
                      <tr key={i} style={{ background: i % 2 === 0 ? '#fff' : '#FAFAF8' }}>
                        <td style={S.td}><strong>{c.contact_name || '-'}</strong></td>
                        <td style={S.td}>{c.to_number || '-'}</td>
                        <td style={S.td}>
                          <span style={S.pill(c.status === 'On' ? '#EAF3DE' : '#F1EFE8', c.status === 'On' ? '#3B6D11' : '#5F5E5A')}>
                            {c.status || '-'}
                          </span>
                        </td>
                        <td style={{ ...S.td, textAlign: 'center' }}>{c.call_atempts || '0'}</td>
                        <td style={{ ...S.td, textAlign: 'center', color: '#185FA5', fontWeight: 600 }}>{c.connected_calls || '0'}</td>
                        <td style={{ ...S.td, textAlign: 'center', color: '#3B6D11', fontWeight: 600 }}>{c.successful_calls || '0'}</td>
                        <td style={S.td}>{fmtDate(c.last_call_time)}</td>
                        <td style={S.td}>
                          {c.last_call_disconnection_reason
                            ? <span style={S.pill(bg, color)}>{c.last_call_disconnection_reason.replace(/_/g,' ')}</span>
                            : '-'}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
              {filteredContacts.length === 0 && (
                <div style={{ padding: 32, textAlign: 'center', color: '#A8A79D', fontSize: 13 }}>Sin resultados</div>
              )}
            </div>
          )}

          {/* TABLA LLAMADAS */}
          {tab === 'calls' && (
            <div style={{ overflowX: 'auto' }}>
              <table style={S.table}>
                <thead>
                  <tr>
                    {['Contacto','Teléfono','Fecha','Duración','Sentimiento','Resultado','Motivo','Resumen','Grabación'].map(h => (
                      <th key={h} style={S.th}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {filteredLogs.map((l, i) => {
                    const name = (l.dynamic_variables || '').match(/"contact_name":"([^"]+)"/)?.[1] || '-';
                    const [sentBg, sentColor] = SENT_COLOR[l.user_sentiment] || SENT_COLOR[''];
                    const [discBg, discColor] = DISC_COLOR[l.disconnection_reason] || ['#F1EFE8','#5F5E5A'];
                    const isSuccess = l.call_successful === 'True' || l.call_successful === true;
                    return (
                      <tr key={i} style={{ background: i % 2 === 0 ? '#fff' : '#FAFAF8' }}>
                        <td style={S.td}><strong>{name}</strong></td>
                        <td style={S.td}>{l.to_number || '-'}</td>
                        <td style={S.td}>{fmtDate(l.run_time)}</td>
                        <td style={{ ...S.td, textAlign: 'center' }}>{fmt(parseFloat(l.duration))}</td>
                        <td style={S.td}>
                          <span style={S.pill(sentBg, sentColor)}>{l.user_sentiment || '-'}</span>
                        </td>
                        <td style={S.td}>
                          <span style={S.pill(isSuccess ? '#EAF3DE' : '#FAECE7', isSuccess ? '#3B6D11' : '#993C1D')}>
                            {isSuccess ? 'Exitosa' : 'No exitosa'}
                          </span>
                        </td>
                        <td style={S.td}>
                          <span style={S.pill(discBg, discColor)}>
                            {(l.disconnection_reason || '-').replace(/_/g,' ')}
                          </span>
                        </td>
                        <td style={{ ...S.td, maxWidth: 220 }}>
                          <span
                            title={l.call_summary}
                            style={{ cursor: 'pointer', color: '#185FA5', fontSize: 11 }}
                            onClick={() => setSelectedCall(l)}
                          >
                            {l.call_summary ? l.call_summary.slice(0, 60) + '...' : '-'}
                          </span>
                        </td>
                        <td style={S.td}>
                          {l.recording_url && l.recording_url !== 'undefined' ? (
                            <a href={l.recording_url} target="_blank" rel="noreferrer"
                               style={{ color: '#6C47FF', fontSize: 11, textDecoration: 'none', fontWeight: 500 }}>
                              ▶ Escuchar
                            </a>
                          ) : '-'}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
              {filteredLogs.length === 0 && (
                <div style={{ padding: 32, textAlign: 'center', color: '#A8A79D', fontSize: 13 }}>Sin resultados</div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* ── MODAL RESUMEN + TRANSCRIPT ── */}
      {selectedCall && (
        <div style={{ position: 'fixed', inset: 0, background: '#0007', zIndex: 999, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24 }}
             onClick={() => setSelectedCall(null)}>
          <div style={{ background: '#fff', borderRadius: 12, padding: 28, maxWidth: 600, width: '100%', maxHeight: '80vh', overflowY: 'auto' }}
               onClick={e => e.stopPropagation()}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 16 }}>
              <strong style={{ fontSize: 14 }}>Resumen de llamada</strong>
              <button onClick={() => setSelectedCall(null)} style={{ background: 'none', border: 'none', fontSize: 18, cursor: 'pointer', color: '#A8A79D' }}>✕</button>
            </div>
            <p style={{ fontSize: 13, color: '#1A1916', lineHeight: 1.6, marginBottom: 16 }}>{selectedCall.call_summary || 'Sin resumen'}</p>
            {selectedCall.transcript && (
              <>
                <strong style={{ fontSize: 12, color: '#A8A79D', display: 'block', marginBottom: 8 }}>TRANSCRIPT</strong>
                <pre style={{ fontSize: 11, color: '#5F5E5A', whiteSpace: 'pre-wrap', background: '#FAFAF8', padding: 12, borderRadius: 6, lineHeight: 1.6 }}>
                  {selectedCall.transcript}
                </pre>
              </>
            )}
            {selectedCall.recording_url && selectedCall.recording_url !== 'undefined' && (
              <a href={selectedCall.recording_url} target="_blank" rel="noreferrer"
                 style={{ display: 'inline-block', marginTop: 12, color: '#6C47FF', fontSize: 12, fontWeight: 600 }}>
                ▶ Escuchar grabación
              </a>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
