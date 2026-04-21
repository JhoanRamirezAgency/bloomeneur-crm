import React, { useEffect, useState, useCallback } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../lib/AuthContext';
import { syncFromSheets } from '../lib/sheets';
import LeadProfile from '../components/LeadProfile';
import ReportsPage from './ReportsPage';

const STATUS_COLORS = {
  New:      { bg: '#E6F1FB', color: '#185FA5' },
  Hot:      { bg: '#FAECE7', color: '#993C1D' },
  Maybe:    { bg: '#FAEEDA', color: '#854F0B' },
  Customer: { bg: '#EAF3DE', color: '#3B6D11' },
  Lost:     { bg: '#F1EFE8', color: '#5F5E5A' },
};

const PLATFORM_LABEL = { fb: 'FB', ig: 'IG', sh: 'SH' };
const PLATFORM_COLOR = { fb: '#1877F2', ig: '#E1306C', sh: '#96BF48' };

export default function Dashboard() {
  const { user, profile, signOut } = useAuth();
  const isAdmin = profile?.role === 'admin';

  const [leads, setLeads]           = useState([]);
  const [loading, setLoading]       = useState(true);
  const [showReports, setShowReports] = useState(false);
  const [syncing, setSyncing]       = useState(false);
  const [syncMsg, setSyncMsg]       = useState('');
  const [selectedLead, setSelected] = useState(null);
  const [search, setSearch]         = useState('');
  const [statusFilter, setStatus]   = useState('');
  const [csFilter, setCSFilter]     = useState('');
  const [lastSync, setLastSync]     = useState(null);

  // ── Cargar leads ────────────────────────────────────────────────────────────
  const loadLeads = useCallback(async () => {
    setLoading(true);
    let query = supabase.from('leads').select('*').order('created_at', { ascending: false });
    // Si no es admin, solo sus leads (RLS lo hace automático, pero lo repetimos por claridad)
    if (!isAdmin) query = query.eq('assigned_to', user.email);
    const { data, error } = await query;
    if (!error) setLeads(data || []);
    setLoading(false);
  }, [user, isAdmin]);

  useEffect(() => { loadLeads(); }, [loadLeads]);

  // ── Realtime subscription ───────────────────────────────────────────────────
  useEffect(() => {
    const channel = supabase
      .channel('leads-changes')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'leads' }, () => {
        loadLeads();
      })
      .subscribe();
    return () => supabase.removeChannel(channel);
  }, [loadLeads]);

  // ── Auto-sync cada 60 minutos ───────────────────────────────────────────────
  useEffect(() => {
    if (!isAdmin) return;
    const doSync = async () => {
      const result = await syncFromSheets();
      setLastSync(new Date());
      if (result.inserted > 0) loadLeads();
    };
    doSync();
    const interval = setInterval(doSync, 60 * 60 * 1000);
    return () => clearInterval(interval);
  }, [isAdmin, loadLeads]);

  // ── Sync manual ─────────────────────────────────────────────────────────────
  async function handleManualSync() {
    setSyncing(true); setSyncMsg('');
    const result = await syncFromSheets();
    setLastSync(new Date());
    if (result.error)    setSyncMsg(`Error: ${result.error}`);
    else if (result.inserted > 0) { setSyncMsg(`✓ ${result.inserted} leads nuevos importados`); loadLeads(); }
    else                setSyncMsg('Sin leads nuevos');
    setSyncing(false);
    setTimeout(() => setSyncMsg(''), 4000);
  }

  // ── Filtrado ─────────────────────────────────────────────────────────────────
  const filtered = leads.filter(l => {
    const q = search.toLowerCase();
    const matchQ   = !q || l.full_name?.toLowerCase().includes(q) || l.email?.toLowerCase().includes(q) || l.phone?.includes(q);
    const matchS   = !statusFilter || l.status === statusFilter;
    const matchCS  = !csFilter     || l.assigned_to === csFilter;
    return matchQ && matchS && matchCS;
  });

  // ── Métricas ─────────────────────────────────────────────────────────────────
  const metrics = {
    total:    leads.length,
    hot:      leads.filter(l => l.status === 'Hot').length,
    customer: leads.filter(l => l.status === 'Customer').length,
    pending:  leads.filter(l => (!l.touches || l.touches.length === 0)).length,
  };

  const uniqueCS = [...new Set(leads.map(l => l.assigned_to).filter(Boolean))];

  return (
    <div style={S.wrap}>
      {showReports && <ReportsPage onBack={() => setShowReports(false)} />}
      {!showReports && <>
      {/* ── TOPBAR ── */}
      <div style={S.topbar}>
        <div style={S.topLeft}>
          <div style={S.logoIcon}>
            <svg width="16" height="16" viewBox="0 0 16 16" fill="white">
              <path d="M8 2C5.8 2 4 3.8 4 6c0 1.5.8 2.8 2 3.5V11h4V9.5c1.2-.7 2-2 2-3.5 0-2.2-1.8-4-4-4zm0 6.5c-1.4 0-2.5-1.1-2.5-2.5S6.6 3.5 8 3.5 10.5 4.6 10.5 6 9.4 8.5 8 8.5zM6 12h4v1H6z"/>
            </svg>
          </div>
          <span style={S.logoText}>Bloomeneur CRM</span>
          <span style={S.userBadge}>{profile?.name || user.email}</span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          {isAdmin && (
            <button style={S.syncBtn} onClick={handleManualSync} disabled={syncing}>
              {syncing ? '⟳ Sincronizando...' : '⟳ Sync Google Sheets'}
            </button>
          )}
          {isAdmin && (
            <button style={{...S.syncBtn, background: '#EAF3DE', color: '#3B6D11', border: 'none'}} onClick={() => setShowReports(true)}>
              📊 Reportes
            </button>
          )}
          {syncMsg && <span style={S.syncMsg}>{syncMsg}</span>}
          {lastSync && <span style={S.lastSync}>Última sync: {lastSync.toLocaleTimeString()}</span>}
          <button style={S.outBtn} onClick={signOut}>Salir</button>
        </div>
      </div>

      <div style={S.main}>
        {/* ── MÉTRICAS ── */}
        <div style={S.metrics}>
          {[
            { label: 'Total leads', val: metrics.total, color: '#1a1a18' },
            { label: 'Hot leads',   val: metrics.hot,      color: '#D85A30' },
            { label: 'Clientes',    val: metrics.customer, color: '#1D9E75' },
            { label: 'Sin contacto',val: metrics.pending,  color: '#BA7517' },
          ].map(m => (
            <div style={S.metricCard} key={m.label}>
              <div style={S.metricLabel}>{m.label}</div>
              <div style={{ ...S.metricVal, color: m.color }}>{m.val}</div>
            </div>
          ))}
        </div>

        {/* ── FILTROS ── */}
        <div style={S.filters}>
          <input style={S.search} placeholder="Buscar nombre, email, teléfono..."
            value={search} onChange={e => setSearch(e.target.value)} />
          <select style={S.sel} value={statusFilter} onChange={e => setStatus(e.target.value)}>
            <option value="">Todos los estados</option>
            {Object.keys(STATUS_COLORS).map(s => <option key={s}>{s}</option>)}
          </select>
          {isAdmin && (
            <select style={S.sel} value={csFilter} onChange={e => setCSFilter(e.target.value)}>
              <option value="">Todos los CS</option>
              {uniqueCS.map(cs => <option key={cs}>{cs}</option>)}
            </select>
          )}
          <span style={S.count}>{filtered.length} leads</span>
        </div>

        {/* ── TABLA ── */}
        <div style={S.table}>
          <div style={S.thead}>
            <div style={{ width: 36 }} />
            <div style={{ flex: 2 }}>Lead</div>
            <div style={{ flex: 2 }}>Contacto</div>
            <div style={{ flex: 1 }}>Estado</div>
            <div style={{ flex: 1.5 }}>Intención</div>
            <div style={{ flex: 1 }}>Fuente</div>
            <div style={{ width: 80 }}>Toques</div>
            {isAdmin && <div style={{ flex: 1 }}>CS</div>}
          </div>

          {loading && <div style={S.empty}>Cargando leads...</div>}
          {!loading && filtered.length === 0 && <div style={S.empty}>Sin leads con esos filtros</div>}

          {!loading && filtered.map(lead => {
            const sc = STATUS_COLORS[lead.status] || STATUS_COLORS.New;
            const touches = lead.touches || [];
            const calls = touches.filter(t => t.type === 'call').length;
            const sms   = touches.filter(t => t.type === 'sms').length;
            const mails = touches.filter(t => t.type === 'mail').length;
            const initials = (lead.full_name || '?').split(' ').slice(0,2).map(w=>w[0]).join('').toUpperCase();
            const col = ['#1D9E75','#378ADD','#D4537E','#BA7517','#533AB7','#D85A30'];
            const c = col[(lead.full_name||'').charCodeAt(0) % col.length];

            return (
              <div key={lead.id} style={S.row} onClick={() => setSelected(lead)}>
                <div style={{ width: 36 }}>
                  <div style={{ ...S.avatar, background: c+'22', color: c }}>{initials}</div>
                </div>
                <div style={{ flex: 2 }}>
                  <div style={S.name}>{lead.full_name}</div>
                  <div style={S.sub}>{lead.email}</div>
                </div>
                <div style={{ flex: 2, fontSize: 12, color: '#5F5E5A' }}>{lead.phone}</div>
                <div style={{ flex: 1 }}>
                  <span style={{ ...S.badge, background: sc.bg, color: sc.color }}>{lead.status}</span>
                </div>
                <div style={{ flex: 1.5, fontSize: 11, color: '#5F5E5A' }}>
                  {(lead.intent || '').length > 24 ? lead.intent.slice(0,24)+'…' : lead.intent}
                </div>
                <div style={{ flex: 1, display: 'flex', alignItems: 'center', gap: 5, fontSize: 12, color: '#5F5E5A' }}>
                  {lead.platform && (
                    <span style={{ ...S.platBadge, background: PLATFORM_COLOR[lead.platform] || '#888' }}>
                      {PLATFORM_LABEL[lead.platform] || lead.platform}
                    </span>
                  )}
                  {lead.source}
                </div>
                <div style={{ width: 80, display: 'flex', gap: 3 }}>
                  {[...Array(calls)].map((_,i) => <div key={'c'+i} style={{...S.dot, background:'#1D9E75'}} title="Llamada"/>)}
                  {[...Array(sms)].map((_,i)   => <div key={'s'+i} style={{...S.dot, background:'#378ADD'}} title="SMS"/>)}
                  {[...Array(mails)].map((_,i)  => <div key={'m'+i} style={{...S.dot, background:'#BA7517'}} title="Email"/>)}
                  {touches.length === 0 && <div style={{...S.dot, background:'#e0ddd6'}}/>}
                </div>
                {isAdmin && <div style={{ flex: 1, fontSize: 12, color: '#5F5E5A' }}>{lead.assigned_to?.split('@')[0]}</div>}
              </div>
            );
          })}
        </div>
      </div>

      {/* ── PERFIL LATERAL ── */}
      {selectedLead && (
        <LeadProfile
          lead={selectedLead}
          isAdmin={isAdmin}
          userEmail={user.email}
          onClose={() => setSelected(null)}
          onUpdate={updated => {
            setLeads(prev => prev.map(l => l.id === updated.id ? updated : l));
            setSelected(updated);
          }}
        />
      )}
      </>}
    </div>
  );
}

const S = {
  wrap:    { minHeight: '100vh', background: '#f5f5f3', fontFamily: 'system-ui, sans-serif' },
  topbar:  { background: 'white', borderBottom: '0.5px solid #e0ddd6', padding: '12px 20px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' },
  topLeft: { display: 'flex', alignItems: 'center', gap: 12 },
  logoIcon:{ width: 32, height: 32, borderRadius: 8, background: '#1D9E75', display: 'flex', alignItems: 'center', justifyContent: 'center' },
  logoText:{ fontSize: 15, fontWeight: 600, color: '#1a1a18' },
  userBadge:{ fontSize: 12, background: '#EAF3DE', color: '#3B6D11', padding: '3px 10px', borderRadius: 100, fontWeight: 500 },
  syncBtn: { padding: '7px 14px', borderRadius: 8, border: '0.5px solid #ccc', background: 'white', fontSize: 13, cursor: 'pointer', color: '#1a1a18' },
  syncMsg: { fontSize: 12, color: '#1D9E75', fontWeight: 500 },
  lastSync:{ fontSize: 11, color: '#888780' },
  outBtn:  { padding: '7px 14px', borderRadius: 8, border: '0.5px solid #ccc', background: 'white', fontSize: 13, cursor: 'pointer', color: '#A32D2D' },
  main:    { padding: 20 },
  metrics: { display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 12, marginBottom: 20 },
  metricCard:  { background: 'white', borderRadius: 10, padding: '14px 16px', border: '0.5px solid #e0ddd6' },
  metricLabel: { fontSize: 12, color: '#888780', marginBottom: 6 },
  metricVal:   { fontSize: 24, fontWeight: 600 },
  filters: { display: 'flex', gap: 8, marginBottom: 16, alignItems: 'center', flexWrap: 'wrap' },
  search:  { flex: 1, minWidth: 200, padding: '8px 12px', border: '0.5px solid #ccc', borderRadius: 8, fontSize: 13, outline: 'none', background: 'white' },
  sel:     { padding: '8px 10px', border: '0.5px solid #ccc', borderRadius: 8, fontSize: 12, background: 'white' },
  count:   { fontSize: 12, color: '#888780', marginLeft: 'auto' },
  table:   { background: 'white', borderRadius: 12, border: '0.5px solid #e0ddd6', overflow: 'hidden' },
  thead:   { display: 'flex', alignItems: 'center', padding: '10px 16px', borderBottom: '0.5px solid #e0ddd6', background: '#f9f8f5', gap: 12 },
  row:     { display: 'flex', alignItems: 'center', padding: '11px 16px', borderBottom: '0.5px solid #f0ede6', cursor: 'pointer', gap: 12, transition: 'background 0.1s' },
  avatar:  { width: 28, height: 28, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 11, fontWeight: 600 },
  name:    { fontSize: 13, fontWeight: 500, color: '#1a1a18' },
  sub:     { fontSize: 11, color: '#888780' },
  badge:   { display: 'inline-block', padding: '3px 10px', borderRadius: 100, fontSize: 11, fontWeight: 500 },
  platBadge:{ display: 'inline-block', padding: '2px 6px', borderRadius: 4, fontSize: 10, fontWeight: 700, color: 'white' },
  dot:     { width: 10, height: 10, borderRadius: '50%' },
  empty:   { padding: '40px', textAlign: 'center', color: '#888780', fontSize: 14 },
};
