import React, { useEffect, useState, useCallback } from 'react';

const SHEET_ID = process.env.REACT_APP_LOGISTICS_SHEET_ID || '1Z6hxb_Z9TPDbAA8l9B25WJlCCRIpfwGuJtkD41puYA8';
const API_KEY  = process.env.REACT_APP_GOOGLE_API_KEY;

async function fetchSheet(sheetName) {
  const range = encodeURIComponent(`${sheetName}!A1:Z500`);
  const url   = `https://sheets.googleapis.com/v4/spreadsheets/${SHEET_ID}/values/${range}?key=${API_KEY}`;
  const res   = await fetch(url);
  if (!res.ok) throw new Error(`Sheets error ${res.status}`);
  const data  = await res.json();
  const rows  = data.values || [];
  if (rows.length < 2) return [];
  const headers = rows[0];
  return rows.slice(1).map(row => {
    const obj = {};
    headers.forEach((h, i) => { obj[h] = row[i] !== undefined ? row[i] : ''; });
    return obj;
  });
}

// Agrupa filas por orden (la primera fila con # tiene los datos del cliente)
function parsePrice(val) {
  if (!val) return 0;
  if (typeof val === 'number') return val;
  // Quitar $, espacios, y manejar tanto punto como coma decimal
  const clean = String(val).replace(/[$\s]/g, '').replace(/,(?=\d{2}$)/, '.');
  return parseFloat(clean) || 0;
}

function groupByOrder(rows, priceCol, priceCol2) {
  const orders = [];
  let current = null;
  for (const row of rows) {
    const num = row['Número de orden'] || row['Número de orden '] || '';
    if (num && num.toString().startsWith('#')) {
      if (current) orders.push(current);
      // Buscar precio web y precio pagado con varios nombres posibles
      const precioWeb = parsePrice(
        row['precio web'] || row['PRECIO WEB'] || row[priceCol] || 0
      );
      const precioPag = parsePrice(
        row['precio pagado'] || row['PRECIO REAL PAGADO'] || row[priceCol2] || row[priceCol] || 0
      );
      current = {
        num:        num.toString(),
        fecha:      row['Fecha de orden'] || '',
        cliente:    row['Nombre del cliente'] || '',
        email:      row['Email del Cliente'] || '',
        telefono:   row['Teléfono'] || '',
        direccion:  row['Dirección'] || '',
        entrega:    row['Fecha deseada de entrega'] || '',
        en_proceso: row['Pedido en proceso'] === 'TRUE' || row['Pedido en proceso'] === true,
        listo:      row['Listo para despachar'] === 'TRUE' || row['Listo para despachar'] === true,
        novedad:    row['Novedades'] || '',
        tracking:   row['Tracking'] || '',
        coleccion:  row['Colección'] || row['CONCATENAR'] || '',
        size:       row['Size of box'] || '',
        precio_web: precioWeb,
        precio_pag: precioPag,
        productos:  [],
        boxes:      parseFloat(row['boxes'] || '1') || 1,
      };
    }
    if (current && (row['Producto'] || row['Colección'])) {
      current.productos.push({
        prod:   row['Producto'] || '',
        color:  row['Color'] || '',
        bunches:row['bunches per color'] || row['Bunches por Box'] || '',
        col:    row['Colección'] || '',
        size:   row['Size of box'] || '',
      });
    }
  }
  if (current) orders.push(current);
  return orders.filter(o => o.num);
}

function fmtDate(str) {
  if (!str) return '—';
  try {
    const d = new Date(str);
    if (isNaN(d)) return str;
    return d.toLocaleDateString('es-CO', { month: 'short', day: 'numeric', year: 'numeric' });
  } catch { return str; }
}
function fmtMoney(n) {
  return '$' + (n || 0).toFixed(2).replace(/\B(?=(\d{3})+(?!\d))/g, ',');
}
function daysUntil(str) {
  if (!str) return null;
  try {
    const d = new Date(str);
    const now = new Date();
    return Math.ceil((d - now) / (1000 * 60 * 60 * 24));
  } catch { return null; }
}

const S = {
  wrap:    { minHeight: '100vh', background: '#F5F5F3', fontFamily: 'system-ui, sans-serif' },
  topbar:  { background: '#fff', borderBottom: '1px solid #E8E7E2', padding: '0 24px', height: 52, display: 'flex', alignItems: 'center', justifyContent: 'space-between', position: 'sticky', top: 0, zIndex: 100 },
  topLeft: { display: 'flex', alignItems: 'center', gap: 12 },
  backBtn: { background: 'none', border: '1px solid #E8E7E2', borderRadius: 6, padding: '5px 12px', fontSize: 12, color: '#5F5E5A', cursor: 'pointer' },
  title:   { fontSize: 15, fontWeight: 600, color: '#1A1916' },
  badge:   { background: '#FF6B0015', color: '#CC4400', borderRadius: 20, padding: '2px 10px', fontSize: 11, fontWeight: 600 },
  syncBtn: { background: '#F5F5F3', border: '1px solid #E8E7E2', borderRadius: 6, padding: '5px 12px', fontSize: 12, color: '#5F5E5A', cursor: 'pointer' },
  body:    { padding: '24px 28px', maxWidth: 1400, margin: '0 auto' },
  grid4:   { display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 16, marginBottom: 20 },
  grid2:   { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 20 },
  card:    { background: '#fff', borderRadius: 10, padding: '18px 20px', border: '1px solid #E8E7E2' },
  cardLabel:{ fontSize: 11, color: '#A8A79D', fontWeight: 500, textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 6 },
  cardVal: { fontSize: 26, fontWeight: 700, color: '#1A1916' },
  cardSub: { fontSize: 12, color: '#A8A79D', marginTop: 3 },
  section: { background: '#fff', borderRadius: 10, border: '1px solid #E8E7E2', marginBottom: 20, overflow: 'hidden' },
  secHead: { padding: '14px 20px', borderBottom: '1px solid #E8E7E2', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 8 },
  secTitle:{ fontSize: 13, fontWeight: 600, color: '#1A1916' },
  table:   { width: '100%', borderCollapse: 'collapse', fontSize: 12 },
  th:      { padding: '10px 14px', textAlign: 'left', color: '#A8A79D', fontWeight: 500, fontSize: 11, borderBottom: '1px solid #E8E7E2', background: '#FAFAF8', whiteSpace: 'nowrap' },
  td:      { padding: '10px 14px', borderBottom: '1px solid #F0EFE8', color: '#1A1916', verticalAlign: 'middle' },
  pill:    (bg, color) => ({ background: bg, color, borderRadius: 20, padding: '2px 9px', fontSize: 11, fontWeight: 500, display: 'inline-block', whiteSpace: 'nowrap' }),
  search:  { background: '#F5F5F3', border: '1px solid #E8E7E2', borderRadius: 6, padding: '6px 12px', fontSize: 12, width: 200, outline: 'none' },
  tab:     (active) => ({ background: active ? '#1A1916' : 'none', color: active ? '#fff' : '#5F5E5A', border: '1px solid ' + (active ? '#1A1916' : '#E8E7E2'), borderRadius: 6, padding: '4px 14px', fontSize: 12, cursor: 'pointer', fontWeight: 500 }),
};

const COL_COLORS = {
  roses:    ['#FAECE7', '#993C1D'],
  fillers:  ['#EAF3DE', '#3B6D11'],
  basics:   ['#E6F1FB', '#185FA5'],
  novelties:['#FAEEDA', '#854F0B'],
  focals:   ['#F3E6FB', '#6B1FA5'],
  greens:   ['#E0F5E9', '#1A7A3C'],
  tropical: ['#FFF3E0', '#B35B00'],
  bouquets: ['#FCE4EC', '#880E4F'],
};
function colColor(col) {
  const k = Object.keys(COL_COLORS).find(k => (col || '').toLowerCase().includes(k));
  return k ? COL_COLORS[k] : ['#F1EFE8', '#5F5E5A'];
}

export default function LogisticsPage({ onBack }) {
  const [resumen,   setResumen]   = useState([]);
  const [historial, setHistorial] = useState([]);
  const [loading,   setLoading]   = useState(true);
  const [error,     setError]     = useState('');
  const [lastSync,  setLastSync]  = useState(null);
  const [syncing,   setSyncing]   = useState(false);
  const [tab,       setTab]       = useState('activas'); // activas | historial | recurrentes
  const [search,    setSearch]    = useState('');
  const [selected,  setSelected]  = useState(null);

  const load = useCallback(async () => {
    try {
      setSyncing(true);
      const [r, h] = await Promise.all([
        fetchSheet('RESUMEN'),
        fetchSheet('HISTORIAL'),
      ]);
      setResumen(groupByOrder(r,   'precio web',        'PRECIO REAL PAGADO'));
      setHistorial(groupByOrder(h, 'PRECIO WEB',        'PRECIO REAL PAGADO'));
      setLastSync(new Date());
      setError('');
    } catch (e) {
      setError('Error: ' + e.message);
    } finally {
      setLoading(false);
      setSyncing(false);
    }
  }, []);

  useEffect(() => {
    load();
    const iv = setInterval(load, 30 * 60 * 1000);
    return () => clearInterval(iv);
  }, [load]);

  // ── Métricas ──────────────────────────────────────────────────────────────
  const allOrders   = [...historial, ...resumen];
  const totalRev    = allOrders.reduce((s, o) => s + (o.precio_pag || 0), 0);
  const histRev     = historial.reduce((s, o) => s + (o.precio_pag || 0), 0);
  const activeRev   = resumen.reduce((s, o) => s + (o.precio_pag || 0), 0);
  const listas      = resumen.filter(o => o.listo).length;
  const pendientes  = resumen.filter(o => !o.listo).length;
  const conNovedad  = resumen.filter(o => o.novedad && o.novedad.trim()).length;

  // Clientes recurrentes (por email, más de 1 orden en historial)
  const clientMap = {};
  historial.forEach(o => {
    const key = o.email || o.cliente;
    if (!key) return;
    if (!clientMap[key]) clientMap[key] = { nombre: o.cliente, email: o.email, orders: [], total: 0 };
    clientMap[key].orders.push(o);
    clientMap[key].total += o.precio_pag || 0;
  });
  const recurrentes = Object.values(clientMap).filter(c => c.orders.length > 1).sort((a,b) => b.orders.length - a.orders.length);

  // Colecciones más vendidas
  const colCount = {};
  historial.forEach(o => {
    const c = (o.coleccion || '').split(' ')[0].toLowerCase();
    if (c) colCount[c] = (colCount[c] || 0) + 1;
  });

  // Filtrado
  const q = search.toLowerCase();
  const filtResumen   = resumen.filter(o => !q || o.cliente?.toLowerCase().includes(q) || o.num?.includes(q) || o.email?.toLowerCase().includes(q));
  const filtHistorial = historial.filter(o => !q || o.cliente?.toLowerCase().includes(q) || o.num?.includes(q) || o.email?.toLowerCase().includes(q));

  if (loading) return (
    <div style={{ ...S.wrap, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#A8A79D', fontSize: 13 }}>
      Cargando órdenes...
    </div>
  );

  return (
    <div style={S.wrap}>
      {/* TOPBAR */}
      <div style={S.topbar}>
        <div style={S.topLeft}>
          <button style={S.backBtn} onClick={onBack}>← Volver</button>
          <span style={S.title}>📦 Logística & Órdenes</span>
          <span style={S.badge}>Solo Admin</span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          {error && <span style={{ fontSize: 11, color: '#993C1D' }}>{error}</span>}
          <span style={{ fontSize: 11, color: '#A8A79D' }}>
            {lastSync ? `Sync: ${lastSync.toLocaleTimeString('es-CO', { hour: '2-digit', minute: '2-digit' })}` : ''}
          </span>
          <button style={S.syncBtn} onClick={load} disabled={syncing}>
            {syncing ? '⟳ Actualizando...' : '⟳ Actualizar'}
          </button>
        </div>
      </div>

      <div style={S.body}>
        {/* MÉTRICAS */}
        <div style={S.grid4}>
          <div style={S.card}>
            <div style={S.cardLabel}>Revenue Total</div>
            <div style={{ ...S.cardVal, color: '#3B6D11' }}>{fmtMoney(totalRev)}</div>
            <div style={S.cardSub}>{allOrders.length} órdenes en total</div>
          </div>
          <div style={S.card}>
            <div style={S.cardLabel}>Órdenes activas</div>
            <div style={{ ...S.cardVal, color: '#185FA5' }}>{resumen.length}</div>
            <div style={S.cardSub}>{fmtMoney(activeRev)} en proceso</div>
          </div>
          <div style={S.card}>
            <div style={S.cardLabel}>Listas para despachar</div>
            <div style={{ ...S.cardVal, color: listas > 0 ? '#3B6D11' : '#A8A79D' }}>{listas}</div>
            <div style={S.cardSub}>{pendientes} pendientes de procesar</div>
          </div>
          <div style={S.card}>
            <div style={S.cardLabel}>Ventas completadas</div>
            <div style={S.cardVal}>{historial.length}</div>
            <div style={S.cardSub}>{fmtMoney(histRev)} cobrado</div>
          </div>
        </div>

        {/* FILA 2: Colecciones + Urgentes */}
        <div style={S.grid2}>
          {/* Colecciones más vendidas */}
          <div style={S.section}>
            <div style={S.secHead}><span style={S.secTitle}>Colecciones más vendidas</span></div>
            <div style={{ padding: '16px 20px', display: 'flex', flexDirection: 'column', gap: 8 }}>
              {Object.entries(colCount).sort((a,b) => b[1]-a[1]).map(([col, cnt]) => {
                const [bg, color] = colColor(col);
                const pct = Math.round(cnt / historial.length * 100);
                return (
                  <div key={col}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 3 }}>
                      <span style={S.pill(bg, color)}>{col}</span>
                      <span style={{ fontSize: 12, color: '#5F5E5A' }}>{cnt} órdenes ({pct}%)</span>
                    </div>
                    <div style={{ height: 5, borderRadius: 3, background: '#F0EFE8' }}>
                      <div style={{ height: 5, borderRadius: 3, background: color, width: pct + '%' }} />
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Órdenes urgentes */}
          <div style={S.section}>
            <div style={S.secHead}><span style={S.secTitle}>⚠️ Próximas entregas</span></div>
            <div style={{ padding: '8px 0' }}>
              {resumen
                .filter(o => o.entrega)
                .sort((a, b) => new Date(a.entrega) - new Date(b.entrega))
                .slice(0, 8)
                .map((o, i) => {
                  const days = daysUntil(o.entrega);
                  const urgente = days !== null && days <= 3;
                  const pasada  = days !== null && days < 0;
                  return (
                    <div key={i} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '9px 20px', borderBottom: '1px solid #F0EFE8' }}>
                      <div>
                        <div style={{ fontWeight: 600, fontSize: 12 }}>{o.num} — {o.cliente}</div>
                        <div style={{ fontSize: 11, color: '#A8A79D' }}>{o.coleccion}</div>
                      </div>
                      <div style={{ textAlign: 'right' }}>
                        <div style={{ fontSize: 11, fontWeight: 600, color: pasada ? '#993C1D' : urgente ? '#854F0B' : '#3B6D11' }}>
                          {pasada ? '🔴 VENCIDA' : urgente ? `⚠️ ${days}d` : `${days}d`}
                        </div>
                        <div style={{ fontSize: 11, color: '#A8A79D' }}>{fmtDate(o.entrega)}</div>
                      </div>
                    </div>
                  );
                })}
              {resumen.filter(o => o.entrega).length === 0 && (
                <div style={{ padding: 20, color: '#A8A79D', fontSize: 12, textAlign: 'center' }}>Sin fechas de entrega registradas</div>
              )}
            </div>
          </div>
        </div>

        {/* TABLA PRINCIPAL */}
        <div style={S.section}>
          <div style={S.secHead}>
            <div style={{ display: 'flex', gap: 8 }}>
              {[['activas', `Activas (${resumen.length})`], ['historial', `Historial (${historial.length})`], ['recurrentes', `Recurrentes (${recurrentes.length})`]].map(([t, label]) => (
                <button key={t} style={S.tab(tab === t)} onClick={() => setTab(t)}>{label}</button>
              ))}
            </div>
            <input style={S.search} placeholder="Buscar orden, cliente..." value={search} onChange={e => setSearch(e.target.value)} />
          </div>

          {/* TAB: ACTIVAS */}
          {tab === 'activas' && (
            <div style={{ overflowX: 'auto' }}>
              <table style={S.table}>
                <thead>
                  <tr>
                    {['Orden','Fecha orden','Cliente','Colección','Entrega','Estado','Novedad','Tracking','Precio web','Precio pagado','Detalle'].map(h => (
                      <th key={h} style={S.th}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {filtResumen.map((o, i) => {
                    const days = daysUntil(o.entrega);
                    const [colBg, colColor2] = colColor(o.coleccion);
                    return (
                      <tr key={i} style={{ background: i % 2 === 0 ? '#fff' : '#FAFAF8' }}>
                        <td style={S.td}><strong>{o.num}</strong></td>
                        <td style={S.td}>{fmtDate(o.fecha)}</td>
                        <td style={S.td}>
                          <div style={{ fontWeight: 600 }}>{o.cliente}</div>
                          <div style={{ fontSize: 11, color: '#A8A79D' }}>{o.email}</div>
                        </td>
                        <td style={S.td}><span style={S.pill(colBg, colColor2)}>{o.coleccion}</span></td>
                        <td style={S.td}>
                          <div style={{ fontSize: 12, fontWeight: days !== null && days <= 3 ? 700 : 400, color: days !== null && days < 0 ? '#993C1D' : days !== null && days <= 3 ? '#854F0B' : '#1A1916' }}>
                            {fmtDate(o.entrega)}
                          </div>
                          {days !== null && <div style={{ fontSize: 10, color: '#A8A79D' }}>{days < 0 ? 'VENCIDA' : `en ${days}d`}</div>}
                        </td>
                        <td style={S.td}>
                          <div style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
                            <span style={S.pill(o.en_proceso ? '#EAF3DE' : '#F1EFE8', o.en_proceso ? '#3B6D11' : '#5F5E5A')}>
                              {o.en_proceso ? '✓ En proceso' : 'Pendiente'}
                            </span>
                            <span style={S.pill(o.listo ? '#185FA520' : '#FAEEDA', o.listo ? '#185FA5' : '#854F0B')}>
                              {o.listo ? '✓ Lista' : 'No lista'}
                            </span>
                          </div>
                        </td>
                        <td style={S.td}>
                          {o.novedad ? <span style={S.pill('#FAECE7', '#993C1D')}>⚠️ {o.novedad.slice(0, 30)}</span> : <span style={{ color: '#A8A79D' }}>—</span>}
                        </td>
                        <td style={S.td}>
                          {o.tracking
                            ? <span style={{ fontSize: 11, color: '#185FA5', fontWeight: 600 }}>{String(o.tracking).slice(0, 20)}</span>
                            : <span style={{ color: '#A8A79D' }}>—</span>}
                        </td>
                        <td style={{ ...S.td, fontWeight: 600 }}>{fmtMoney(o.precio_web)}</td>
                        <td style={{ ...S.td, fontWeight: 700, color: '#3B6D11' }}>{fmtMoney(o.precio_pag)}</td>
                        <td style={S.td}>
                          <button onClick={() => setSelected(o)} style={{ background: 'none', border: '1px solid #E8E7E2', borderRadius: 5, padding: '3px 10px', fontSize: 11, cursor: 'pointer', color: '#185FA5' }}>
                            Ver
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
              {filtResumen.length === 0 && <div style={{ padding: 32, textAlign: 'center', color: '#A8A79D', fontSize: 13 }}>Sin resultados</div>}
            </div>
          )}

          {/* TAB: HISTORIAL */}
          {tab === 'historial' && (
            <div style={{ overflowX: 'auto' }}>
              <table style={S.table}>
                <thead>
                  <tr>
                    {['Orden','Fecha','Cliente','Colección','Entrega','Tracking','Precio web','Precio pagado','Detalle'].map(h => (
                      <th key={h} style={S.th}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {filtHistorial.map((o, i) => {
                    const [colBg, colColor2] = colColor(o.coleccion);
                    return (
                      <tr key={i} style={{ background: i % 2 === 0 ? '#fff' : '#FAFAF8' }}>
                        <td style={S.td}><strong>{o.num}</strong></td>
                        <td style={S.td}>{fmtDate(o.fecha)}</td>
                        <td style={S.td}>
                          <div style={{ fontWeight: 600 }}>{o.cliente}</div>
                          <div style={{ fontSize: 11, color: '#A8A79D' }}>{o.email}</div>
                        </td>
                        <td style={S.td}><span style={S.pill(colBg, colColor2)}>{o.coleccion}</span></td>
                        <td style={S.td}>{fmtDate(o.entrega)}</td>
                        <td style={S.td}>
                          {o.tracking
                            ? <span style={{ fontSize: 11, color: '#185FA5' }}>{String(o.tracking).slice(0, 20)}</span>
                            : <span style={{ color: '#A8A79D' }}>—</span>}
                        </td>
                        <td style={{ ...S.td }}>{fmtMoney(o.precio_web)}</td>
                        <td style={{ ...S.td, fontWeight: 700, color: '#3B6D11' }}>{fmtMoney(o.precio_pag)}</td>
                        <td style={S.td}>
                          <button onClick={() => setSelected(o)} style={{ background: 'none', border: '1px solid #E8E7E2', borderRadius: 5, padding: '3px 10px', fontSize: 11, cursor: 'pointer', color: '#185FA5' }}>
                            Ver
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
              {filtHistorial.length === 0 && <div style={{ padding: 32, textAlign: 'center', color: '#A8A79D', fontSize: 13 }}>Sin resultados</div>}
            </div>
          )}

          {/* TAB: RECURRENTES */}
          {tab === 'recurrentes' && (
            <div style={{ overflowX: 'auto' }}>
              <table style={S.table}>
                <thead>
                  <tr>
                    {['Cliente','Email','# Órdenes','Total gastado','Promedio por orden','Colección favorita','Última orden'].map(h => (
                      <th key={h} style={S.th}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {recurrentes.map((c, i) => {
                    const cols = {};
                    c.orders.forEach(o => {
                      const col = (o.coleccion || '').split(' ')[0].toLowerCase();
                      if (col) cols[col] = (cols[col] || 0) + 1;
                    });
                    const favCol = Object.entries(cols).sort((a,b) => b[1]-a[1])[0]?.[0] || '—';
                    const [colBg, colColor2] = colColor(favCol);
                    const lastOrder = c.orders.sort((a,b) => new Date(b.fecha) - new Date(a.fecha))[0];
                    return (
                      <tr key={i} style={{ background: i % 2 === 0 ? '#fff' : '#FAFAF8' }}>
                        <td style={S.td}><strong>{c.nombre}</strong></td>
                        <td style={S.td}><span style={{ fontSize: 11, color: '#A8A79D' }}>{c.email}</span></td>
                        <td style={{ ...S.td, textAlign: 'center' }}>
                          <span style={{ ...S.pill('#E6F1FB', '#185FA5'), fontSize: 13, fontWeight: 700 }}>{c.orders.length}</span>
                        </td>
                        <td style={{ ...S.td, fontWeight: 700, color: '#3B6D11', fontSize: 14 }}>{fmtMoney(c.total)}</td>
                        <td style={S.td}>{fmtMoney(c.total / c.orders.length)}</td>
                        <td style={S.td}><span style={S.pill(colBg, colColor2)}>{favCol}</span></td>
                        <td style={S.td}>{fmtDate(lastOrder?.fecha)}</td>
                      </tr>
                    );
                  })}
                  {recurrentes.length === 0 && (
                    <tr><td colSpan={7} style={{ padding: 32, textAlign: 'center', color: '#A8A79D', fontSize: 13 }}>Sin clientes recurrentes aún</td></tr>
                  )}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

      {/* MODAL DETALLE ORDEN */}
      {selected && (
        <div style={{ position: 'fixed', inset: 0, background: '#0007', zIndex: 999, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24 }}
             onClick={() => setSelected(null)}>
          <div style={{ background: '#fff', borderRadius: 12, padding: 28, maxWidth: 560, width: '100%', maxHeight: '85vh', overflowY: 'auto' }}
               onClick={e => e.stopPropagation()}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 20 }}>
              <div>
                <div style={{ fontSize: 18, fontWeight: 700 }}>{selected.num}</div>
                <div style={{ fontSize: 12, color: '#A8A79D' }}>{fmtDate(selected.fecha)}</div>
              </div>
              <button onClick={() => setSelected(null)} style={{ background: 'none', border: 'none', fontSize: 20, cursor: 'pointer', color: '#A8A79D' }}>✕</button>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 16 }}>
              {[
                ['Cliente', selected.cliente],
                ['Email', selected.email],
                ['Teléfono', selected.telefono],
                ['Entrega deseada', fmtDate(selected.entrega)],
                ['Precio web', fmtMoney(selected.precio_web)],
                ['Precio pagado', fmtMoney(selected.precio_pag)],
                ['Tracking', selected.tracking || '—'],
                ['Estado', selected.listo ? 'Lista para despachar' : selected.en_proceso ? 'En proceso' : 'Pendiente'],
              ].map(([label, val]) => (
                <div key={label}>
                  <div style={{ fontSize: 10, color: '#A8A79D', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 2 }}>{label}</div>
                  <div style={{ fontSize: 13, fontWeight: 500 }}>{val || '—'}</div>
                </div>
              ))}
            </div>
            {selected.direccion && (
              <div style={{ marginBottom: 14 }}>
                <div style={{ fontSize: 10, color: '#A8A79D', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 2 }}>Dirección</div>
                <div style={{ fontSize: 12 }}>{selected.direccion}</div>
              </div>
            )}
            {selected.novedad && (
              <div style={{ background: '#FAECE7', borderRadius: 6, padding: '8px 12px', marginBottom: 14 }}>
                <strong style={{ fontSize: 11, color: '#993C1D' }}>⚠️ NOVEDAD:</strong>
                <div style={{ fontSize: 12, color: '#993C1D', marginTop: 2 }}>{selected.novedad}</div>
              </div>
            )}
            {selected.productos.length > 0 && (
              <div>
                <div style={{ fontSize: 11, color: '#A8A79D', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 8 }}>Productos</div>
                {selected.productos.map((p, i) => (
                  <div key={i} style={{ display: 'flex', gap: 8, padding: '6px 0', borderBottom: '1px solid #F0EFE8', fontSize: 12 }}>
                    <span style={S.pill(...colColor(p.col || p.prod))}>{p.col || p.prod}</span>
                    <span style={{ color: '#1A1916' }}>{p.prod}</span>
                    {p.color && <span style={{ color: '#A8A79D' }}>• {p.color}</span>}
                    {p.bunches && <span style={{ color: '#A8A79D' }}>• {p.bunches} bunches</span>}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
