import React, { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../lib/AuthContext';

const CS_NAMES = {
  'jessica@bloomeneur.com': 'Jessica',
  'marcela@bloomeneur.com': 'Marcela',
  'sofia@bloomeneur.com': 'Sofia',
};

export default function ReportsPage({ onBack }) {
  const { user } = useAuth();
  const [leads, setLeads] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    supabase.from('leads').select('*').then(({ data }) => {
      setLeads(data || []);
      setLoading(false);
    });
  }, []);

  if (loading) return <div style={S.loading}>Cargando estadísticas...</div>;

  const total = leads.length;
  const byStatus = {};
  const byCS = {};
  const touchCounts = { 0: 0, 1: 0, 2: 0, 3: 0, '4+': 0 };
  const contactTypes = { call: 0, sms: 0, mail: 0 };
  const callResults = { Answered: 0, 'No answer': 0, Voicemail: 0 };
  const byIntent = {};
  const csActivity = {};

  leads.forEach(lead => {
    // By status
    byStatus[lead.status] = (byStatus[lead.status] || 0) + 1;

    // By CS
    const csName = CS_NAMES[lead.assigned_to] || lead.assigned_to?.split('@')[0] || 'Sin asignar';
    if (!byCS[csName]) byCS[csName] = { total: 0, customers: 0, hot: 0, touched: 0 };
    byCS[csName].total++;
    if (lead.status === 'Customer') byCS[csName].customers++;
    if (lead.status === 'Hot') byCS[csName].hot++;

    // Touch counts
    const t = (lead.touches || []).length;
    if (t === 0) touchCounts[0]++;
    else if (t === 1) touchCounts[1]++;
    else if (t === 2) touchCounts[2]++;
    else if (t === 3) touchCounts[3]++;
    else touchCounts['4+']++;

    if (t > 0) byCS[csName].touched++;

    // Contact types and call results
    (lead.touches || []).forEach(touch => {
      if (touch.type) contactTypes[touch.type] = (contactTypes[touch.type] || 0) + 1;
      if (touch.type === 'call' && touch.result) {
        callResults[touch.result] = (callResults[touch.result] || 0) + 1;
      }
      // CS activity
      const tcsName = CS_NAMES[touch.cs] || touch.cs?.split('@')[0] || 'N/A';
      if (!csActivity[tcsName]) csActivity[tcsName] = { call: 0, sms: 0, mail: 0 };
      if (touch.type) csActivity[tcsName][touch.type] = (csActivity[tcsName][touch.type] || 0) + 1;
    });

    // By intent
    const intent = lead.intent?.replace(/_/g, ' ').replace('yes i want to get started', 'Quiere empezar')
      .replace("yes but i'd like more information", 'Quiere más info')
      .replace("yes, but i'd like more info", 'Quiere más info')
      .replace("i'm just exploring", 'Solo explorando') || 'Sin especificar';
    const intentKey = intent.length > 30 ? intent.slice(0, 30) + '…' : intent;
    byIntent[intentKey] = (byIntent[intentKey] || 0) + 1;
  });

  const totalTouches = Object.values(contactTypes).reduce((a, b) => a + b, 0);
  const answeredRate = callResults.Answered && (callResults.Answered + callResults['No answer'] + callResults.Voicemail) > 0
    ? Math.round(callResults.Answered / (callResults.Answered + callResults['No answer'] + callResults.Voicemail) * 100)
    : 0;

  const statusColors = { New: '#378ADD', Hot: '#D85A30', Maybe: '#BA7517', Customer: '#1D9E75', Lost: '#888780' };
  const maxStatus = Math.max(...Object.values(byStatus));
  const maxTouch = Math.max(...Object.values(touchCounts));

  return (
    <div style={S.wrap}>
      <div style={S.topbar}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <button style={S.backBtn} onClick={onBack}>← Volver</button>
          <span style={S.title}>Reportes y estadísticas</span>
        </div>
        <span style={S.sub}>Total: {total} leads</span>
      </div>

      <div style={S.main}>

        {/* ── MÉTRICAS PRINCIPALES ── */}
        <div style={S.grid4}>
          {[
            { label: 'Total leads', val: total, color: '#1a1a18' },
            { label: 'Sin contacto', val: touchCounts[0], color: '#D85A30', pct: Math.round(touchCounts[0]/total*100)+'%' },
            { label: 'Tasa de respuesta', val: answeredRate+'%', color: '#1D9E75' },
            { label: 'Clientes convertidos', val: byStatus['Customer'] || 0, color: '#1D9E75', pct: Math.round((byStatus['Customer']||0)/total*100)+'%' },
          ].map(m => (
            <div style={S.metricCard} key={m.label}>
              <div style={S.metricLabel}>{m.label}</div>
              <div style={{ ...S.metricVal, color: m.color }}>{m.val}</div>
              {m.pct && <div style={S.metricPct}>{m.pct} del total</div>}
            </div>
          ))}
        </div>

        <div style={S.grid2}>

          {/* ── LEADS POR ESTADO ── */}
          <div style={S.card}>
            <div style={S.cardTitle}>Leads por estado</div>
            {Object.entries(byStatus).sort((a,b)=>b[1]-a[1]).map(([status, count]) => (
              <div key={status} style={S.barRow}>
                <div style={{ ...S.barLabel, color: statusColors[status] || '#888' }}>{status}</div>
                <div style={S.barTrack}>
                  <div style={{ ...S.barFill, width: Math.round(count/maxStatus*100)+'%', background: statusColors[status] || '#888' }}/>
                </div>
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
                <div style={S.barTrack}>
                  <div style={{ ...S.barFill, width: Math.round(v/maxTouch*100)+'%', background: k==='0'?'#D85A30':'#1D9E75' }}/>
                </div>
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
                  {['CS', 'Leads asignados', 'Contactados', '% contacto', 'Hot leads', 'Clientes', 'Tasa conversión', 'Llamadas', 'SMS', 'Emails'].map(h => (
                    <th key={h} style={S.th}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {Object.entries(byCS).sort((a,b)=>b[1].total-a[1].total).map(([name, data]) => {
                  const act = csActivity[name] || { call: 0, sms: 0, mail: 0 };
                  const convRate = data.total > 0 ? Math.round(data.customers/data.total*100) : 0;
                  const contactRate = data.total > 0 ? Math.round(data.touched/data.total*100) : 0;
                  return (
                    <tr key={name} style={S.tr}>
                      <td style={{ ...S.td, fontWeight: 500, color: '#1a1a18' }}>{name}</td>
                      <td style={S.td}>{data.total}</td>
                      <td style={S.td}>{data.touched}</td>
                      <td style={{ ...S.td, color: contactRate > 50 ? '#1D9E75' : '#D85A30' }}>{contactRate}%</td>
                      <td style={{ ...S.td, color: '#D85A30' }}>{data.hot}</td>
                      <td style={{ ...S.td, color: '#1D9E75' }}>{data.customers}</td>
                      <td style={{ ...S.td, color: convRate > 5 ? '#1D9E75' : '#888780' }}>{convRate}%</td>
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
          {/* ── TIPOS DE CONTACTO ── */}
          <div style={S.card}>
            <div style={S.cardTitle}>Tipos de contacto realizados</div>
            <div style={{ display: 'flex', gap: 16, marginBottom: 16 }}>
              {[
                { label: 'Llamadas', val: contactTypes.call || 0, color: '#1D9E75' },
                { label: 'SMS', val: contactTypes.sms || 0, color: '#378ADD' },
                { label: 'Emails', val: contactTypes.mail || 0, color: '#BA7517' },
              ].map(t => (
                <div key={t.label} style={{ flex: 1, textAlign: 'center', padding: '12px 8px', background: t.color+'15', borderRadius: 8 }}>
                  <div style={{ fontSize: 22, fontWeight: 600, color: t.color }}>{t.val}</div>
                  <div style={{ fontSize: 12, color: '#888780', marginTop: 4 }}>{t.label}</div>
                  <div style={{ fontSize: 11, color: '#888780' }}>{totalTouches > 0 ? Math.round(t.val/totalTouches*100) : 0}%</div>
                </div>
              ))}
            </div>
            <div style={S.cardTitle}>Resultado de llamadas</div>
            {Object.entries(callResults).map(([result, count]) => (
              <div key={result} style={{ display: 'flex', justifyContent: 'space-between', padding: '6px 0', borderBottom: '0.5px solid #f0ede6', fontSize: 13 }}>
                <span style={{ color: result==='Answered'?'#1D9E75':result==='No answer'?'#D85A30':'#BA7517' }}>
                  {result==='Answered'?'✅ Contestó':result==='No answer'?'❌ No contestó':'📱 Voicemail'}
                </span>
                <span style={{ fontWeight: 500 }}>{count} <span style={{ color: '#888780', fontWeight: 400 }}>({(contactTypes.call||0)>0?Math.round(count/(contactTypes.call||1)*100):0}%)</span></span>
              </div>
            ))}
          </div>

          {/* ── INTENCIÓN DE LEADS ── */}
          <div style={S.card}>
            <div style={S.cardTitle}>Nivel de intención</div>
            {Object.entries(byIntent).sort((a,b)=>b[1]-a[1]).slice(0,6).map(([intent, count]) => (
              <div key={intent} style={S.barRow}>
                <div style={{ ...S.barLabel, fontSize: 11 }}>{intent}</div>
                <div style={S.barTrack}>
                  <div style={{ ...S.barFill, width: Math.round(count/total*100)+'%', background: '#7F77DD' }}/>
                </div>
                <div style={S.barCount}>{count}</div>
              </div>
            ))}
          </div>
        </div>

        {/* ── LEADS MÁS INTERESADOS ── */}
        <div style={S.card}>
          <div style={S.cardTitle}>Hot leads — pendientes de cerrar</div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: 10 }}>
            {leads.filter(l => l.status === 'Hot' || (l.intent && l.intent.includes('want_to_get_started') && l.status === 'New'))
              .slice(0, 12).map(lead => {
              const touches = (lead.touches || []).length;
              const lastTouch = lead.touches?.slice(-1)[0];
              const col = ['#1D9E75','#378ADD','#D4537E','#BA7517'][lead.full_name?.charCodeAt(0) % 4];
              const initials = (lead.full_name || '?').split(' ').slice(0,2).map(w=>w[0]).join('').toUpperCase();
              return (
                <div key={lead.id} style={{ background: '#f9f8f5', borderRadius: 8, padding: '10px 12px', border: '0.5px solid #e0ddd6', display: 'flex', alignItems: 'center', gap: 10 }}>
                  <div style={{ width: 34, height: 34, borderRadius: '50%', background: col+'22', color: col, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 12, fontWeight: 600, flexShrink: 0 }}>{initials}</div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 13, fontWeight: 500, color: '#1a1a18', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{lead.full_name}</div>
                    <div style={{ fontSize: 11, color: '#888780' }}>{lead.phone} · {touches} toques · {CS_NAMES[lead.assigned_to] || 'Sin CS'}</div>
                  </div>
                  <div style={{ background: lead.status==='Hot'?'#FAECE7':'#E6F1FB', color: lead.status==='Hot'?'#993C1D':'#185FA5', padding: '2px 8px', borderRadius: 100, fontSize: 11, fontWeight: 500, flexShrink: 0 }}>{lead.status}</div>
                </div>
              );
            })}
          </div>
          {leads.filter(l => l.status === 'Hot').length === 0 && (
            <div style={{ fontSize: 13, color: '#888780', padding: '12px 0' }}>No hay leads con estado Hot aún. Cambia el estado de los leads más interesados desde su perfil.</div>
          )}
        </div>

      </div>
    </div>
  );
}

const S = {
  wrap: { minHeight: '100vh', background: '#f5f5f3', fontFamily: 'system-ui, sans-serif' },
  topbar: { background: 'white', borderBottom: '0.5px solid #e0ddd6', padding: '12px 20px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' },
  backBtn: { padding: '6px 12px', borderRadius: 8, border: '0.5px solid #ccc', background: 'white', fontSize: 13, cursor: 'pointer', color: '#1a1a18' },
  title: { fontSize: 16, fontWeight: 600, color: '#1a1a18' },
  sub: { fontSize: 13, color: '#888780' },
  main: { padding: 20, display: 'flex', flexDirection: 'column', gap: 16 },
  loading: { padding: 40, textAlign: 'center', color: '#888780', fontFamily: 'system-ui, sans-serif' },
  grid4: { display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12 },
  grid2: { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 },
  metricCard: { background: 'white', borderRadius: 10, padding: '14px 16px', border: '0.5px solid #e0ddd6' },
  metricLabel: { fontSize: 12, color: '#888780', marginBottom: 6 },
  metricVal: { fontSize: 24, fontWeight: 600 },
  metricPct: { fontSize: 11, color: '#888780', marginTop: 3 },
  card: { background: 'white', borderRadius: 12, padding: '16px 18px', border: '0.5px solid #e0ddd6' },
  cardTitle: { fontSize: 13, fontWeight: 600, color: '#1a1a18', marginBottom: 14 },
  barRow: { display: 'flex', alignItems: 'center', gap: 10, marginBottom: 8 },
  barLabel: { fontSize: 12, color: '#5F5E5A', width: 100, flexShrink: 0 },
  barTrack: { flex: 1, height: 8, background: '#f0ede6', borderRadius: 4, overflow: 'hidden' },
  barFill: { height: '100%', borderRadius: 4, transition: 'width 0.3s' },
  barCount: { fontSize: 12, fontWeight: 500, color: '#1a1a18', width: 36, textAlign: 'right', flexShrink: 0 },
  table: { width: '100%', borderCollapse: 'collapse', fontSize: 13 },
  th: { padding: '8px 12px', textAlign: 'left', fontSize: 11, fontWeight: 600, color: '#888780', borderBottom: '0.5px solid #e0ddd6', whiteSpace: 'nowrap' },
  td: { padding: '10px 12px', borderBottom: '0.5px solid #f0ede6', color: '#5F5E5A' },
  tr: { transition: 'background 0.1s' },
};
