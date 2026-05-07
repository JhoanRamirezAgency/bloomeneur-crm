import React, { useState } from 'react';
import { supabase } from '../lib/supabase';
import { format } from 'date-fns';

const STATUS_COLORS = {
  New:      { bg: '#E6F1FB', color: '#185FA5' },
  Hot:      { bg: '#FAECE7', color: '#993C1D' },
  Maybe:    { bg: '#FAEEDA', color: '#854F0B' },
  Customer: { bg: '#EAF3DE', color: '#3B6D11' },
  Lost:     { bg: '#F1EFE8', color: '#5F5E5A' },
};

const CLIENT_PROFILES = [
  { value: 'Design Studio', icon: '🎨', bg: '#F0E6FF', color: '#6B21A8' },
  { value: 'Event Planner', icon: '🎉', bg: '#FFF0E6', color: '#C2410C' },
  { value: 'Flower Shop',   icon: '🌸', bg: '#FFF0F5', color: '#BE185D' },
  { value: 'Bloomeneur',    icon: '🌿', bg: '#E6F4EA', color: '#166534' },
];

const YEARS_OPTIONS = [
  { value: '0',    label: '0 años (Nuevo)' },
  { value: '1-2',  label: '1-2 años' },
  { value: '3-5',  label: '3-5 años' },
  { value: '6-10', label: '6-10 años' },
  { value: '10+',  label: 'Más de 10 años' },
];

const CS_USERS = [
  'jessica@bloomeneur.com',
  'marcela@bloomeneur.com',
  'sofia@bloomeneur.com',
];

const TOUCH_ICONS = { call: '📞', sms: '💬', mail: '📧', note: '📝' };
const TOUCH_COLORS = { call: '#1D9E75', sms: '#378ADD', mail: '#BA7517', note: '#888780' };

function InfoItem({ label, val }) {
  return (
    <div style={{ marginBottom: 10 }}>
      <div style={{ fontSize: 10, color: '#888780', textTransform: 'uppercase', letterSpacing: '0.04em', marginBottom: 2 }}>{label}</div>
      <div style={{ fontSize: 13, color: '#1a1a18', fontWeight: 400 }}>{val || <span style={{ color: '#ccc' }}>—</span>}</div>
    </div>
  );
}

export default function LeadProfile({ lead, isAdmin, userEmail, onClose, onUpdate }) {
  const [saving, setSaving]     = useState(false);
  const [status, setStatus]     = useState(lead.status || 'New');
  const [assigned, setAssigned] = useState(lead.assigned_to || '');
  const [profile, setProfile]   = useState(lead.client_profile || '');
  const [years, setYears]       = useState(lead.years_in_market || '');

  // Pendiente
  const [hasPending, setHasPending]     = useState(!!lead.has_pending);
  const [pendingNote, setPendingNote]   = useState(lead.pending_note || '');
  const [pendingDue, setPendingDue]     = useState(lead.pending_due || '');
  const [showPendingForm, setShowPending] = useState(false);

  // Touch
  const [showTouchForm, setShowTouch]   = useState(false);
  const [touchType, setTouchType]       = useState('call');
  const [touchResult, setTouchResult]   = useState('');
  const [touchNote, setTouchNote]       = useState('');
  const [touchDate, setTouchDate]       = useState(new Date().toISOString().slice(0,10));

  const canEdit = isAdmin || userEmail === lead.assigned_to;

  async function saveField(fields) {
    setSaving(true);
    const { data, error } = await supabase
      .from('leads')
      .update(fields)
      .eq('id', lead.id)
      .select()
      .single();
    if (!error && data) onUpdate(data);
    setSaving(false);
  }

  async function handleStatusChange(newStatus) {
    setStatus(newStatus);
    await saveField({ status: newStatus });
  }

  async function handleAssignedChange(newCS) {
    setAssigned(newCS);
    await saveField({ assigned_to: newCS });
  }

  async function handleProfileChange(newProfile) {
    setProfile(newProfile);
    await saveField({ client_profile: newProfile || null });
  }

  async function handleYearsChange(newYears) {
    setYears(newYears);
    await saveField({ years_in_market: newYears || null });
  }

  async function savePending() {
    const fields = {
      has_pending:  hasPending,
      pending_note: hasPending ? pendingNote : null,
      pending_due:  hasPending ? (pendingDue || null) : null,
    };
    await saveField(fields);
    setShowPending(false);
  }

  async function clearPending() {
    setHasPending(false);
    setPendingNote('');
    setPendingDue('');
    await saveField({ has_pending: false, pending_note: null, pending_due: null });
  }

  async function addTouch() {
    if (!touchResult.trim()) return;
    const touch = {
      type:   touchType,
      result: touchResult.trim(),
      note:   touchNote.trim(),
      date:   touchDate,
      cs:     userEmail,
    };
    const newTouches = [...(lead.touches || []), touch];
    await saveField({ touches: newTouches });
    setTouchResult(''); setTouchNote('');
    setTouchDate(new Date().toISOString().slice(0,10));
    setShowTouch(false);
  }

  const sc = STATUS_COLORS[status] || STATUS_COLORS.New;
  const profData = CLIENT_PROFILES.find(p => p.value === profile);
  const isOverdue = lead.pending_due && new Date(lead.pending_due) < new Date();

  const inp = { padding: '7px 10px', border: '0.5px solid #ddd', borderRadius: 8, fontSize: 12, width: '100%', boxSizing: 'border-box', fontFamily: 'system-ui' };
  const lbl = { fontSize: 10, color: '#888780', textTransform: 'uppercase', letterSpacing: '0.04em', marginBottom: 4, display: 'block' };

  return (
    <div style={P.overlay} onClick={e => { if (e.target === e.currentTarget) onClose(); }}>
      <div style={P.panel}>
        {/* ── HEADER ── */}
        <div style={P.header}>
          <div>
            <div style={P.leadName}>{lead.full_name}</div>
            <div style={{ fontSize: 12, color: '#888780' }}>{lead.email} · {lead.source}</div>
          </div>
          <button onClick={onClose} style={P.closeBtn}>×</button>
        </div>

        <div style={P.body}>
          {/* ── ESTADO ── */}
          <div style={P.section}>
            <div style={P.sectionTitle}>Estado del lead</div>
            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
              {Object.keys(STATUS_COLORS).map(s => (
                <button key={s} disabled={!canEdit}
                  onClick={() => handleStatusChange(s)}
                  style={{ padding: '5px 14px', borderRadius: 100, border: 'none', cursor: canEdit ? 'pointer' : 'default',
                    background: status === s ? STATUS_COLORS[s].bg : '#f0ede6',
                    color:      status === s ? STATUS_COLORS[s].color : '#888780',
                    fontWeight: status === s ? 600 : 400, fontSize: 12 }}>
                  {s}
                </button>
              ))}
            </div>
          </div>

          {/* ── PERFIL DE CLIENTE ── */}
          <div style={P.section}>
            <div style={P.sectionTitle}>Perfil de cliente</div>
            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
              {CLIENT_PROFILES.map(p => (
                <button key={p.value} disabled={!canEdit}
                  onClick={() => handleProfileChange(profile === p.value ? '' : p.value)}
                  style={{ padding: '5px 12px', borderRadius: 100, border: profile === p.value ? `1.5px solid ${p.color}` : '1px solid #e0ddd6',
                    cursor: canEdit ? 'pointer' : 'default',
                    background: profile === p.value ? p.bg : 'white',
                    color:      profile === p.value ? p.color : '#888780',
                    fontWeight: profile === p.value ? 600 : 400, fontSize: 12 }}>
                  {p.icon} {p.value}
                </button>
              ))}
            </div>
          </div>

          {/* ── AÑOS EN MERCADO ── */}
          <div style={P.section}>
            <div style={P.sectionTitle}>Años en el mercado</div>
            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
              {YEARS_OPTIONS.map(y => (
                <button key={y.value} disabled={!canEdit}
                  onClick={() => handleYearsChange(years === y.value ? '' : y.value)}
                  style={{ padding: '5px 12px', borderRadius: 100, border: years === y.value ? '1.5px solid #378ADD' : '1px solid #e0ddd6',
                    cursor: canEdit ? 'pointer' : 'default',
                    background: years === y.value ? '#E6F1FB' : 'white',
                    color:      years === y.value ? '#185FA5' : '#888780',
                    fontWeight: years === y.value ? 600 : 400, fontSize: 12 }}>
                  {y.label}
                </button>
              ))}
            </div>
          </div>

          {/* ── PENDIENTE ── */}
          <div style={P.section}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
              <div style={P.sectionTitle}>⏰ Pendiente</div>
              {canEdit && !showPendingForm && (
                <button onClick={() => { setShowPending(true); setHasPending(true); }}
                  style={{ fontSize: 11, color: '#92400E', background: '#FEF9C3', border: 'none', borderRadius: 6, padding: '3px 10px', cursor: 'pointer' }}>
                  {lead.has_pending ? '✏️ Editar' : '+ Agregar'}
                </button>
              )}
            </div>

            {lead.has_pending && !showPendingForm && (
              <div style={{ background: isOverdue ? '#FEF2F2' : '#FEF9C3', borderRadius: 8, padding: '10px 12px', border: `1px solid ${isOverdue ? '#FECACA' : '#FDE68A'}` }}>
                <div style={{ fontSize: 13, color: isOverdue ? '#DC2626' : '#92400E', fontWeight: 500 }}>
                  ⏰ {lead.pending_note || 'Sin descripción'}
                </div>
                {lead.pending_due && (
                  <div style={{ fontSize: 11, color: '#888780', marginTop: 4 }}>
                    Fecha: {lead.pending_due} {isOverdue && <span style={{ color: '#DC2626', fontWeight: 600 }}>· VENCIDO</span>}
                  </div>
                )}
                {canEdit && (
                  <button onClick={clearPending} style={{ marginTop: 8, fontSize: 11, color: '#888', background: 'none', border: 'none', cursor: 'pointer', textDecoration: 'underline' }}>
                    ✓ Marcar como resuelto
                  </button>
                )}
              </div>
            )}

            {!lead.has_pending && !showPendingForm && (
              <div style={{ fontSize: 12, color: '#ccc' }}>Sin pendientes asignados</div>
            )}

            {showPendingForm && canEdit && (
              <div style={{ background: '#FFFBEB', borderRadius: 8, padding: 12, border: '1px solid #FDE68A' }}>
                <label style={lbl}>Descripción del pendiente</label>
                <textarea style={{ ...inp, minHeight: 60, resize: 'vertical', marginBottom: 10 }}
                  placeholder="Ej: Llamar en 3 días, cliente dijo que estará disponible el viernes..."
                  value={pendingNote} onChange={e => setPendingNote(e.target.value)}
                />
                <label style={lbl}>Fecha límite (opcional)</label>
                <input type="date" style={{ ...inp, marginBottom: 10 }} value={pendingDue} onChange={e => setPendingDue(e.target.value)} />
                <div style={{ display: 'flex', gap: 8 }}>
                  <button onClick={savePending} style={{ flex: 1, padding: '7px', borderRadius: 8, border: 'none', background: '#92400E', color: 'white', fontSize: 12, cursor: 'pointer', fontWeight: 600 }}>
                    Guardar pendiente
                  </button>
                  <button onClick={() => setShowPending(false)} style={{ padding: '7px 12px', borderRadius: 8, border: '0.5px solid #ccc', background: 'white', fontSize: 12, cursor: 'pointer' }}>
                    Cancelar
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* ── INFORMACIÓN DE CONTACTO ── */}
          <div style={P.section}>
            <div style={P.sectionTitle}>Información de contacto</div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
              <InfoItem label="Teléfono"   val={lead.phone} />
              <InfoItem label="Email"      val={lead.email} />
              <InfoItem label="Intención"  val={lead.intent} />
              <InfoItem label="Timeline"   val={lead.timeline} />
              <InfoItem label="Registrado" val={lead.created_at ? format(new Date(lead.created_at), 'dd/MM/yyyy') : '—'} />
              <InfoItem label="Fuente"     val={lead.source} />
            </div>
          </div>

          {/* ── CS ASIGNADO (solo admin) ── */}
          {isAdmin && (
            <div style={P.section}>
              <div style={P.sectionTitle}>CS asignado</div>
              <select style={{ ...inp, width: 'auto' }} value={assigned} onChange={e => handleAssignedChange(e.target.value)}>
                {CS_USERS.map(u => <option key={u}>{u}</option>)}
              </select>
            </div>
          )}

          {/* ── HISTORIAL DE CONTACTOS ── */}
          <div style={P.section}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
              <div style={P.sectionTitle}>Historial de contactos ({(lead.touches||[]).length})</div>
              {canEdit && (
                <button onClick={() => setShowTouch(t => !t)}
                  style={{ fontSize: 11, color: '#1D9E75', background: '#EAF3DE', border: 'none', borderRadius: 6, padding: '3px 10px', cursor: 'pointer' }}>
                  + Registrar
                </button>
              )}
            </div>

            {showTouchForm && canEdit && (
              <div style={{ background: '#f9f8f5', borderRadius: 8, padding: 12, marginBottom: 12, border: '0.5px solid #e0ddd6' }}>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginBottom: 8 }}>
                  <div>
                    <label style={lbl}>Tipo</label>
                    <select style={inp} value={touchType} onChange={e => setTouchType(e.target.value)}>
                      <option value="call">📞 Llamada</option>
                      <option value="sms">💬 SMS / WhatsApp</option>
                      <option value="mail">📧 Email</option>
                      <option value="note">📝 Nota</option>
                    </select>
                  </div>
                  <div>
                    <label style={lbl}>Fecha</label>
                    <input type="date" style={inp} value={touchDate} onChange={e => setTouchDate(e.target.value)} />
                  </div>
                </div>
                <div style={{ marginBottom: 8 }}>
                  <label style={lbl}>Resultado / respuesta</label>
                  <input style={inp} placeholder="Contestó, dejó buzón, interesado..." value={touchResult} onChange={e => setTouchResult(e.target.value)} />
                </div>
                <div style={{ marginBottom: 8 }}>
                  <label style={lbl}>Nota adicional</label>
                  <textarea style={{ ...inp, minHeight: 50, resize: 'vertical' }} placeholder="Detalles..." value={touchNote} onChange={e => setTouchNote(e.target.value)} />
                </div>
                <div style={{ display: 'flex', gap: 8 }}>
                  <button onClick={addTouch} style={{ flex: 1, padding: '7px', borderRadius: 8, border: 'none', background: '#1D9E75', color: 'white', fontSize: 12, cursor: 'pointer', fontWeight: 600 }}>
                    Guardar contacto
                  </button>
                  <button onClick={() => setShowTouch(false)} style={{ padding: '7px 12px', borderRadius: 8, border: '0.5px solid #ccc', background: 'white', fontSize: 12, cursor: 'pointer' }}>
                    Cancelar
                  </button>
                </div>
              </div>
            )}

            {(lead.touches || []).length === 0 && <div style={{ fontSize: 12, color: '#ccc' }}>Sin intentos de contacto aún.</div>}

            {[...(lead.touches || [])].reverse().map((t, i) => (
              <div key={i} style={{ display: 'flex', gap: 10, padding: '8px 0', borderBottom: '0.5px solid #f0ede6' }}>
                <div style={{ fontSize: 18 }}>{TOUCH_ICONS[t.type] || '📌'}</div>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 12, fontWeight: 500, color: TOUCH_COLORS[t.type] || '#888' }}>
                    {t.type === 'call' ? 'Llamada' : t.type === 'sms' ? 'SMS/WhatsApp' : t.type === 'mail' ? 'Email' : 'Nota'}
                    {t.date && <span style={{ fontWeight: 400, color: '#888780', marginLeft: 6 }}>· {t.date}</span>}
                  </div>
                  <div style={{ fontSize: 12, color: '#1a1a18', marginTop: 2 }}>{t.result}</div>
                  {t.note && <div style={{ fontSize: 11, color: '#888780', marginTop: 2 }}>{t.note}</div>}
                  {t.cs && <div style={{ fontSize: 10, color: '#ccc', marginTop: 2 }}>{t.cs}</div>}
                </div>
              </div>
            ))}
          </div>
        </div>

        {saving && <div style={{ position: 'absolute', bottom: 16, right: 20, fontSize: 11, color: '#1D9E75' }}>Guardando…</div>}
      </div>
    </div>
  );
}

const P = {
  overlay:      { position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.25)', zIndex: 500, display: 'flex', justifyContent: 'flex-end' },
  panel:        { width: 480, background: 'white', height: '100vh', overflowY: 'auto', boxShadow: '-4px 0 24px rgba(0,0,0,0.1)', position: 'relative' },
  header:       { padding: '20px 20px 16px', borderBottom: '0.5px solid #e0ddd6', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', background: 'white', position: 'sticky', top: 0, zIndex: 10 },
  leadName:     { fontSize: 17, fontWeight: 600, color: '#1a1a18', marginBottom: 4 },
  closeBtn:     { border: 'none', background: 'none', fontSize: 24, cursor: 'pointer', color: '#888', lineHeight: 1, padding: 0 },
  body:         { padding: '0 0 40px' },
  section:      { padding: '16px 20px', borderBottom: '0.5px solid #f0ede6' },
  sectionTitle: { fontSize: 11, fontWeight: 600, color: '#888780', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 10 },
};
