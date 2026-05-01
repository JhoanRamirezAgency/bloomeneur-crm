import React, { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../lib/AuthContext';

const CS_NAMES = {
  'jessica@bloomeneur.com': 'Jessica',
  'marcela@bloomeneur.com': 'Marcela',
  'sofia@bloomeneur.com':   'Sofia',
};

// ── Mini donut SVG ──────────────────────────────────────────────────────────
function DonutChart({ segments, size = 120, thickness = 22 }) {
  const r   = (size - thickness) / 2;
  const cx  = size / 2;
  const cy  = size / 2;
  const circ = 2 * Math.PI * r;
  const total = segments.reduce((a, s) => a + s.value, 0) || 1;
  let offset = 0;

  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} style={{ transform: 'rotate(-90deg)' }}>
      {segments.map((seg, i) => {
        const pct  = seg.value / total;
        const dash = pct * circ;
        const gap  = circ - dash;
        const el = (
          <circle
            key={i}
            cx={cx} cy={cy} r={r}
            fill="none"
            stroke={seg.color}
            strokeWidth={thickness}
            strokeDasharray={`${dash} ${gap}`}
            strokeDashoffset={-offset}
            strokeLinecap="round"
          />
        );
        offset += dash;
        return el;
      })}
      {/* track */}
      <circle cx={cx} cy={cy} r={r} fill="none" stroke="#f0ede6" strokeWidth={thickness} style={{ zIndex: -1 }}/>
    </svg>
  );
}

// ── Horizontal bar ──────────────────────────────────────────────────────────
function Bar({ value, max, color }) {
  const pct = max > 0 ? Math.round(value / max * 100) : 0;
  return (
    <div style={{ flex: 1, height: 8, background: '#f0ede6', borderRadius: 4, overflow: 'hidden' }}>
      <div style={{ width: pct + '%', height: '100%', background: color, borderRadius: 4, transition: 'width 0.5s ease' }} />
    </div>
  );
}

export default function ReportsPage({ onBack }) {
  const { user } = useAuth();
  const [leads, setLeads]   = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    supabase.from('leads').select('*').then(({ data }) => {
      setLeads(data || []);
      setLoading(false);
    });
  }, []);

  if (loading) return <div style={S.loading}>Cargando estadísticas...</div>;

  const total = leads.length || 1;
  const byStatus  = {};
  const byCS      = {};
  const touchCounts   = { 0: 0, 1: 0, 2: 0, 3: 0, '4+': 0 };
  const contactTypes  = { call: 0, sms: 0, mail: 0 };
  const callResults   = { Answered: 0, 'No answer': 0, Voicemail: 0 };
  const byIntent  = {};
  const csActivity = {};

  leads.forEach(lead => {
    byStatus[lead.status] = (byStatus[lead.status] || 0) + 1;

    const csName = CS_NAMES[lead.assigned_to] || lead.assigned_to?.split('@')[0] || 'Sin asignar';
    if (!byCS[csName]) byCS[csName] = { total: 0, customers: 0, hot: 0, touched: 0 };
    byCS[csName].total++;
    if (lead.status === 'Customer') byCS[csName].customers++;
    if (lead.status === 'Hot')      byCS[csName].hot++;

    const t = (lead.touches || []).length;
    if      (t === 0) touchCounts[0]++;
    else if (t === 1) touchCounts[1]++;
    else if (t === 2) touchCounts[2]++;
    else if (t === 3) touchCounts[3]++;
    else              touchCounts['4+']++;
    if (t > 0) byCS[csName].touched++;

    (lead.touches || []).forEach(touch => {
      if (touch.type) contactTypes[touch.type] = (contactTypes[touch.type] || 0) + 1;
      if (touch.type === 'call' && touch.result)
        callResults[touch.result] = (callResults[touch.result] || 0) + 1;
      const tcsName = CS_NAMES[touch.cs] || touch.cs?.split('@')[0] || 'N/A';
      if (!csActivity[tcsName]) csActivity[tcsName] = { call: 0, sms: 0, mail: 0 };
      if (touch.type) csActivity[tcsName][touch.type] = (csActivity[tcsName][touch.type] || 0) + 1;
    });

    const intent = lead.intent
      ?.replace(/_/g, ' ')
      .replace('yes i want to get started', 'Quiere empezar')
      .replace("yes but i'd like more information", 'Quiere más info')
      .replace("yes, but i'd like more info", 'Quiere más info')
      .replace("i'm just exploring", 'Solo explorando') || 'Sin especificar';
    const intentKey = intent.length > 30 ? intent.slice(0, 30) + '…' : intent;
    byIntent[intentKey] = (byIntent[intentKey] || 0) + 1;
  });

  const totalTouches = Object.values(contactTypes).reduce((a, b) => a + b, 0);
  const totalCalls   = callResults.Answered + callResults['No answer'] + callResults.Voicemail;
  const answeredRate = totalCalls > 0 ? Math.round(callResults.Answered / totalCalls * 100) : 0;

  const statusColors = {
    New: '#378ADD', Hot: '#D85A30', Maybe: '#BA7517', Customer: '#1D9E75', Lost: '#888780',
  };
  const maxStatus = Math.max(...Object.values(byStatus), 1);
  const maxTouch  = Math.max(...Object.values(touchCounts), 1);

  // Donut segments for status
  const statusSegments = Object.entries(byStatus)
    .sort((a, b) => b[1] - a[1])
    .map(([status, count]) => ({ label: status, value: count, color: statusColors[status] || '#ccc' }));

  // Donut segments for contact types
  const contactSegments = [
    { label: 'Llamadas', value: contactTypes.call || 0, color: '#1D9E75' },
    { label: 'SMS',      value: contactTypes.sms  || 0, color: '#378ADD' },
    { label: 'Emails',   value: contactTypes.mail || 0, color: '#BA7517' },
  ];

  return (
    <div style={S.wrap}>
      {/* ── TOPBAR ── */}
      <div style={S.topbar}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <button style={S.backBtn} onClick={onBack}>← Volver</button>
          <span style={S.title}>Reportes y estadísticas</span>
        </div>
        <span style={S.sub}>Total: {leads.length} leads</span>
      </div>

      <div style={S.main}>

        {/* ── MÉTRICAS PRINCIPALES ── */}
        <div style={S.grid4}>
          {[
            { label: 'Total leads',          val: leads.length,               color: '#1a1a18' },
            { label: 'Sin contacto',          val: touchCounts[0],             color: '#D85A30', pct: Math.round(touchCounts[0] / total * 100) + '%' },
            { label: 'Tasa de respuesta',     val: answeredRate + '%',         color: '#1D9E75' },
            { label: 'Clientes convertidos',  val: byStatus['Customer'] || 0, color: '#1D9E75', pct: Math.round((byStatus['Customer'] || 0) / total * 100) + '%' },
          ].map(m => (
            <div style={S.metricCard} key={m.label}>
              <div style={S.metricLabel}>{m.label}</div>
              <div style={{ ...S.metricVal, color: m.color }}>{m.val}</div>
              {m.pct && <div style={S.metricPct}>{m.pct} del total</div>}
            </div>
          ))}
        </div>

        {/* ── CHARTS ROW ── */}
        <div style={S.grid3}>

          {/* Donut: estado */}
          <div style={S.card}>
            <div style={S.cardTitle}>Distribución por estado</div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 20 }}>
              <div style={{ position: 'relative', flexShrink: 0 }}>
                <DonutChart segments={statusSegments} size={110} thickness={20} />
                <div style={S.donutCenter}>
                  <div style={{ fontSize: 20, fontWeight: 700, color: '#1a1a18', lineHeight: 1 }}>{leads.length}</div>
                  <div style={{ fontSize: 10, color: '#888780' }}>leads</div>
                </div>
              </div>
              <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 6 }}>
                {statusSegments.map(seg => (
                  <div key={seg.label} style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
                    <div style={{ width: 8, height: 8, borderRadius: '50%', background: seg.color, flexShrink: 0 }} />
                    <span style={{ fontSize: 12, color: '#5F5E5A', flex: 1 }}>{seg.label}</span>
                    <span style={{ fontSize: 12, fontWeight: 600, color: '#1a1a18' }}>{seg.value}</span>
                    <span style={{ fontSize: 10, color: '#888780', width: 34, textAlign: 'right' }}>
                      {Math.round(seg.value / total * 100)}%
                    </span>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Donut: tipos de contacto */}
          <div style={S.card}>
            <div style={S.cardTitle}>Tipos de contacto</div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 20 }}>
              <div style={{ position: 'relative', flexShrink: 0 }}>
                <DonutChart segments={contactSegments} size={110} thickness={20} />
                <div style={S.donutCenter}>
                  <div style={{ fontSize: 20, fontWeight: 700, color: '#1a1a18', lineHeight: 1 }}>{totalTouches}</div>
                  <div style={{ fontSize: 10, color: '#888780' }}>toques</div>
                </div>
              </div>
              <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 10 }}>
                {contactSegments.map(seg => (
                  <div key={seg.label}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                      <span style={{ fontSize: 12, color: seg.color, fontWeight: 500 }}>{seg.label}</span>
                      <span style={{ fontSize: 12, fontWeight: 600, color: '#1a1a18' }}>{seg.value}</span>
                    </div>
                    <Bar value={seg.value} max={totalTouches} color={seg.color} />
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Resultado de llamadas */}
          <div style={S.card}>
            <div style={S.cardTitle}>Resultado de llamadas</div>
            {/* Dial gauge */}
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', marginBottom: 14 }}>
              <div style={{ position: 'relative' }}>
                <svg width={110} height={60} viewBox="0 0 110 60">
                  {/* track */}
                  <path d="M 10 55 A 45 45 0 0 1 100 55" fill="none" stroke="#f0ede6" strokeWidth={14} strokeLinecap="round" />
                  {/* fill */}
                  <path
                    d={`M 10 55 A 45 45 0 0 1 100 55`}
                    fill="none"
                    stroke="#1D9E75"
                    strokeWidth={14}
                    strokeLinecap="round"
                    strokeDasharray={`${answeredRate * 1.41} 141`}
                  />
                </svg>
                <div style={{ position: 'absolute', bottom: 0, left: 0, right: 0, textAlign: 'center' }}>
                  <span style={{ fontSize: 22, fontWeight: 700, color: '#1D9E75' }}>{answeredRate}%</span>
                </div>
              </div>
              <div style={{ fontSize: 11, color: '#888780', marginTop: 4 }}>tasa de contestación</div>
            </div>
            {[
              { label: '✅ Contestó',       val: callResults.Answered,       color: '#1D9E75' },
              { label: '❌ No contestó',    val: callResults['No answer'],   color: '#D85A30' },
              { label: '📱 Voicemail',      val: callResults.Voicemail,      color: '#BA7517' },
            ].map(r => (
              <div key={r.label} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '5px 0', borderBottom: '0.5px solid #f0ede6', fontSize: 12 }}>
                <span style={{ color: r.color }}>{r.label}</span>
                <span style={{ fontWeight: 600, color: '#1a1a18' }}>
                  {r.val}
                  <span style={{ fontWeight: 400, color: '#888780', marginLeft: 4 }}>
                    ({totalCalls > 0 ? Math.round(r.val / totalCalls * 100) : 0}%)
                  </span>
                </span>
              </div>
            ))}
          </div>
        </div>

        <div style={S.grid2}>

          {/* ── LEADS POR ESTADO (barras) ── */}
          <div style={S.card}>
            <div style={S.cardTitle}>Leads por estado</div>
            {Object.entries(byStatus).sort((a, b) => b[1] - a[1]).map(([status, count]) => (
              <div key={status} style={S.barRow}>
                <div style={{ ...S.barLabel, color: statusColors[status] || '#888' }}>{status}</div>
                <Bar value={count} max={maxStatus} color={statusColors[status] || '#888'} />
                <div style={S.barCount}>{count}</div>
              </div>
            ))}
          </div>

          {/* ── TOQUES POR LEAD ── */}
          <div style={S.card}>
            <div style={S.cardTitle}>Intentos de contacto por lead</div>
            {Object.entries(touchCounts).map(([k, v]) => (
              <div key={k} style={S.barRow}>
                <div style={S.barLabel}>{k === '0' ? 'Sin contacto' : k === '1' ? '1 toque' : k + ' toques'}</div>
                <Bar value={v} max={maxTouch} color={k === '0' ? '#D85A30' : '#1D9E75'} />
                <div style={S.barCount}>{v}</div>
              </div>
            ))}
          </div>
        </div>

        {/* ── RENDIMIENTO POR CS ── */}
        <div style={S.card}>
          <div style={S.cardTitle}>Rendimiento por Customer Service</div>
          <div style={{ overflowX: 'auto' }}>
            <table style={S.table}>
              <thead>
                <tr>
                  {['CS', 'Asignados', 'Contactados', '% Contacto', 'Hot', 'Clientes', 'Conversión', 'Llamadas', 'SMS', 'Emails'].map(h => (
                    <th key={h} style={S.th}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {Object.entries(byCS).sort((a, b) => b[1].total - a[1].total).map(([name, data]) => {
                  const act         = csActivity[name] || { call: 0, sms: 0, mail: 0 };
                  const convRate    = data.total > 0 ? Math.round(data.customers / data.total * 100) : 0;
                  const contactRate = data.total > 0 ? Math.round(data.touched   / data.total * 100) : 0;
                  return (
                    <tr key={name} style={S.tr}>
                      <td style={{ ...S.td, fontWeight: 600, color: '#1a1a18' }}>{name}</td>
                      <td style={S.td}>{data.total}</td>
                      <td style={S.td}>{data.touched}</td>
                      <td style={{ ...S.td, color: contactRate > 50 ? '#1D9E75' : '#D85A30', fontWeight: 500 }}>{contactRate}%</td>
                      <td style={{ ...S.td, color: '#D85A30', fontWeight: 500 }}>{data.hot}</td>
                      <td style={{ ...S.td, color: '#1D9E75', fontWeight: 500 }}>{data.customers}</td>
                      <td style={{ ...S.td, color: convRate > 5 ? '#1D9E75' : '#888780', fontWeight: 500 }}>{convRate}%</td>
                      <td style={S.td}>{act.call}</td>
                      <td style={S.td}>{act.sms}</td>
                      <td style={S.td}>{act.mail}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>

        <div style={S.grid2}>

          {/* ── INTENCIÓN DE LEADS ── */}
          <div style={S.card}>
            <div style={S.cardTitle}>Nivel de intención</div>
            {Object.entries(byIntent).sort((a, b) => b[1] - a[1]).slice(0, 6).map(([intent, count]) => (
              <div key={intent} style={S.barRow}>
                <div style={{ ...S.barLabel, fontSize: 11 }}>{intent}</div>
                <Bar value={count} max={total} color="#7F77DD" />
                <div style={S.barCount}>{count}</div>
              </div>
            ))}
          </div>

          {/* ── CS por % contacto visual ── */}
          <div style={S.card}>
            <div style={S.cardTitle}>Actividad por CS</div>
            {Object.entries(byCS).sort((a, b) => b[1].total - a[1].total).map(([name, data]) => {
              const act = csActivity[name] || { call: 0, sms: 0, mail: 0 };
              const totalAct = act.call + act.sms + act.mail;
              return (
                <div key={name} style={{ marginBottom: 14 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
                    <span style={{ fontSize: 13, fontWeight: 600, color: '#1a1a18' }}>{name}</span>
                    <span style={{ fontSize: 11, color: '#888780' }}>{totalAct} acciones</span>
                  </div>
                  <div style={{ display: 'flex', height: 8, borderRadius: 4, overflow: 'hidden', gap: 1 }}>
                    {[
                      { val: act.call, color: '#1D9E75' },
                      { val: act.sms,  color: '#378ADD' },
                      { val: act.mail, color: '#BA7517' },
                    ].map((seg, i) => totalAct > 0 && (
                      <div key={i} style={{ width: Math.round(seg.val / totalAct * 100) + '%', background: seg.color, minWidth: seg.val > 0 ? 3 : 0 }} />
                    ))}
                    {totalAct === 0 && <div style={{ width: '100%', background: '#f0ede6' }} />}
                  </div>
                  <div style={{ display: 'flex', gap: 12, marginTop: 4 }}>
                    {[['📞', act.call, '#1D9E75'], ['💬', act.sms, '#378ADD'], ['✉️', act.mail, '#BA7517']].map(([icon, v, c]) => (
                      <span key={icon} style={{ fontSize: 11, color: c }}>{icon} {v}</span>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* ── HOT LEADS ── */}
        <div style={S.card}>
          <div style={S.cardTitle}>Hot leads — pendientes de cerrar</div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: 10 }}>
            {leads
              .filter(l => l.status === 'Hot' || (l.intent?.includes('want_to_get_started') && l.status === 'New'))
              .slice(0, 12)
              .map(lead => {
                const touches  = (lead.touches || []).length;
                const col = ['#1D9E75','#378ADD','#D4537E','#BA7517'][lead.full_name?.charCodeAt(0) % 4];
                const initials = (lead.full_name || '?').split(' ').slice(0,2).map(w=>w[0]).join('').toUpperCase();
                return (
                  <div key={lead.id} style={{ background: '#f9f8f5', borderRadius: 8, padding: '10px 12px', border: '0.5px solid #e0ddd6', display: 'flex', alignItems: 'center', gap: 10 }}>
                    <div style={{ width: 34, height: 34, borderRadius: '50%', background: col + '22', color: col, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 12, fontWeight: 600, flexShrink: 0 }}>{initials}</div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: 13, fontWeight: 500, color: '#1a1a18', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{lead.full_name}</div>
                      <div style={{ fontSize: 11, color: '#888780' }}>{lead.phone} · {touches} toques · {CS_NAMES[lead.assigned_to] || 'Sin CS'}</div>
                    </div>
                    <div style={{ background: lead.status === 'Hot' ? '#FAECE7' : '#E6F1FB', color: lead.status === 'Hot' ? '#993C1D' : '#185FA5', padding: '2px 8px', borderRadius: 100, fontSize: 11, fontWeight: 500, flexShrink: 0 }}>{lead.status}</div>
                  </div>
                );
              })}
          </div>
          {leads.filter(l => l.status === 'Hot').length === 0 && (
            <div style={{ fontSize: 13, color: '#888780', padding: '12px 0' }}>No hay leads con estado Hot aún.</div>
          )}
        </div>

      </div>
    </div>
  );
}

const S = {
  wrap:        { minHeight: '100vh', background: '#f5f5f3', fontFamily: 'system-ui, sans-serif' },
  topbar:      { background: 'white', borderBottom: '0.5px solid #e0ddd6', padding: '12px 20px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' },
  backBtn:     { padding: '6px 12px', borderRadius: 8, border: '0.5px solid #ccc', background: 'white', fontSize: 13, cursor: 'pointer', color: '#1a1a18' },
  title:       { fontSize: 16, fontWeight: 600, color: '#1a1a18' },
  sub:         { fontSize: 13, color: '#888780' },
  main:        { padding: 20, display: 'flex', flexDirection: 'column', gap: 16 },
  loading:     { padding: 40, textAlign: 'center', color: '#888780', fontFamily: 'system-ui, sans-serif' },
  grid4:       { display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12 },
  grid3:       { display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 16 },
  grid2:       { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 },
  metricCard:  { background: 'white', borderRadius: 10, padding: '14px 16px', border: '0.5px solid #e0ddd6' },
  metricLabel: { fontSize: 12, color: '#888780', marginBottom: 6 },
  metricVal:   { fontSize: 24, fontWeight: 600 },
  metricPct:   { fontSize: 11, color: '#888780', marginTop: 3 },
  card:        { background: 'white', borderRadius: 12, padding: '16px 18px', border: '0.5px solid #e0ddd6' },
  cardTitle:   { fontSize: 13, fontWeight: 600, color: '#1a1a18', marginBottom: 14 },
  barRow:      { display: 'flex', alignItems: 'center', gap: 10, marginBottom: 8 },
  barLabel:    { fontSize: 12, color: '#5F5E5A', width: 100, flexShrink: 0 },
  barCount:    { fontSize: 12, fontWeight: 500, color: '#1a1a18', width: 36, textAlign: 'right', flexShrink: 0 },
  table:       { width: '100%', borderCollapse: 'collapse', fontSize: 13 },
  th:          { padding: '8px 12px', textAlign: 'left', fontSize: 11, fontWeight: 600, color: '#888780', borderBottom: '0.5px solid #e0ddd6', whiteSpace: 'nowrap' },
  td:          { padding: '10px 12px', borderBottom: '0.5px solid #f0ede6', color: '#5F5E5A' },
  tr:          { transition: 'background 0.1s' },
  donutCenter: { position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%, -50%)', textAlign: 'center' },
};
