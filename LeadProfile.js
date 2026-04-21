import React, { useState } from 'react';
import { supabase } from '../lib/supabase';
import { format } from 'date-fns';

const STATUSES = ['New', 'Hot', 'Maybe', 'Customer', 'Lost'];
const STATUS_COLORS = {
  New:      { bg: '#E6F1FB', color: '#185FA5', border: '#185FA5' },
  Hot:      { bg: '#FAECE7', color: '#993C1D', border: '#993C1D' },
  Maybe:    { bg: '#FAEEDA', color: '#854F0B', border: '#854F0B' },
  Customer: { bg: '#EAF3DE', color: '#3B6D11', border: '#3B6D11' },
  Lost:     { bg: '#F1EFE8', color: '#5F5E5A', border: '#5F5E5A' },
};
const TYPE_LABEL  = { call: '📞 Llamada', sms: '💬 SMS', mail: '✉️ Email' };
const RESULT_ICON = {
  Answered:  '✅ Contestó',
  'No answer':'❌ No contestó',
  Voicemail: '📱 Voicemail dejado',
  Sent:      '📤 Enviado',
};

export default function LeadProfile({ lead, isAdmin, userEmail, onClose, onUpdate }) {
  const [showForm, setShowForm]   = useState(false);
  const [saving,   setSaving]     = useState(false);
  const [form, setForm]           = useState({
    type: 'call', result: 'Answered', note: '',
    date: new Date().toISOString().slice(0,10),
  });

  const col = ['#1D9E75','#378ADD','#D4537E','#BA7517','#533AB7','#D85A30'];
  const c   = col[(lead.full_name||'').charCodeAt(0) % col.length];
  const initials = (lead.full_name||'?').split(' ').slice(0,2).map(w=>w[0]).join('').toUpperCase();
  const touches  = lead.touches || [];

  // ── Cambiar estado del lead ─────────────────────────────────────────────────
  async function changeStatus(status) {
    const { data, error } = await supabase.from('leads').update({ status }).eq('id', lead.id).select().single();
    if (!error && data) onUpdate(data);
  }

  // ── Guardar nuevo contacto ──────────────────────────────────────────────────
  async function saveContact() {
    setSaving(true);
    const newTouch = { ...form, cs: userEmail, ts: new Date().toISOString() };
    const updated  = [...touches, newTouch];

    // Guardar en contact_log (tabla) y en leads.touches (JSON para acceso rápido)
    await supabase.from('contact_log').insert({
      lead_id:  lead.id, type: form.type, result: form.result,
      note: form.note, date: form.date, cs_email: userEmail,
    });
    const { data, error } = await supabase
      .from('leads').update({ touches: updated }).eq('id', lead.id).select().single();
    if (!error && data) onUpdate(data);
    setForm({ type: 'call', result: 'Answered', note: '', date: new Date().toISOString().slice(0,10) });
    setShowForm(false);
    setSaving(false);
  }

  return (
    <>
      <div style={S.overlay} onClick={onClose} />
      <div style={S.panel}>
        {/* ── HEADER ── */}
        <div style={S.head}>
          <div style={{ display:'flex', alignItems:'center', gap: 10 }}>
            <div style={{ ...S.avatarLg, background: c+'22', color: c }}>{initials}</div>
            <div>
              <div style={S.pName}>{lead.full_name}</div>
              <div style={S.pSub}>{lead.source} · {lead.platform === 'fb' ? 'Facebook' : lead.platform === 'ig' ? 'Instagram' : 'Shopify'}</div>
            </div>
          </div>
          <button style={S.closeBtn} onClick={onClose}>✕</button>
        </div>

        <div style={S.body}>
          {/* ── ESTADO ── */}
          <div style={S.section}>
            <div style={S.secTitle}>Estado del lead</div>
            <div style={{ display:'flex', gap: 6, flexWrap:'wrap' }}>
              {STATUSES.map(st => {
                const sc = STATUS_COLORS[st];
                const active = lead.status === st;
                return (
                  <button key={st} onClick={() => changeStatus(st)} style={{
                    ...S.stBtn,
                    background: active ? sc.bg : 'transparent',
                    color:      active ? sc.color : '#888780',
                    border:     active ? `0.5px solid ${sc.border}` : '0.5px solid #e0ddd6',
                    fontWeight: active ? 600 : 400,
                  }}>{st}</button>
                );
              })}
            </div>
          </div>

          {/* ── INFO ── */}
          <div style={S.section}>
            <div style={S.secTitle}>Información de contacto</div>
            <div style={S.infoGrid}>
              <InfoItem label="Teléfono"    val={lead.phone} />
              <InfoItem label="Email"       val={lead.email} />
              <InfoItem label="Intención"   val={lead.intent} />
              <InfoItem label="Timeline"    val={lead.timeline} />
              <InfoItem label="Registrado"  val={lead.created_at ? format(new Date(lead.created_at), 'dd/MM/yyyy') : '—'} />
              {isAdmin && <InfoItem label="CS asignado" val={lead.assigned_to?.split('@')[0] || '—'} />}
            </div>
          </div>

          {/* ── HISTORIAL ── */}
          <div style={S.section}>
            <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom: 10 }}>
              <div style={S.secTitle}>Historial de contactos ({touches.length})</div>
            </div>

            {touches.length === 0 && (
              <div style={{ fontSize: 13, color: '#888780', marginBottom: 12 }}>Sin intentos de contacto aún.</div>
            )}

            <div style={{ display:'flex', flexDirection:'column', gap: 8 }}>
              {touches.map((t, i) => (
                <div key={i} style={S.touchCard}>
                  <div style={{ display:'flex', justifyContent:'space-between', marginBottom: 4 }}>
                    <span style={{ fontSize: 13, fontWeight: 500 }}>
                      {TYPE_LABEL[t.type] || t.type}
                      <span style={{ fontSize: 11, fontWeight: 400, color: '#888780', marginLeft: 6 }}>
                        por {(t.cs || t.cs_email || '').split('@')[0]}
                      </span>
                    </span>
                    <span style={{ fontSize: 11, color: '#888780' }}>{t.date || ''}</span>
                  </div>
                  <div style={{ fontSize: 12, color: '#444441' }}>{RESULT_ICON[t.result] || t.result}</div>
                  {t.note && <div style={{ fontSize: 11, color: '#888780', marginTop: 4, fontStyle:'italic' }}>{t.note}</div>}
                </div>
              ))}
            </div>

            {/* ── FORM NUEVO CONTACTO ── */}
            {!showForm && (
              <button style={S.addBtn} onClick={() => setShowForm(true)}>
                + Registrar contacto
              </button>
            )}

            {showForm && (
              <div style={S.addForm}>
                <div style={S.fRow}>
                  <label style={S.fLabel}>Tipo</label>
                  <select style={S.fInput} value={form.type} onChange={e => setForm({...form, type: e.target.value})}>
                    <option value="call">📞 Llamada</option>
                    <option value="sms">💬 SMS / Texto</option>
                    <option value="mail">✉️ Email</option>
                  </select>
                </div>
                <div style={S.fRow}>
                  <label style={S.fLabel}>Resultado</label>
                  <select style={S.fInput} value={form.result} onChange={e => setForm({...form, result: e.target.value})}>
                    <option value="Answered">✅ Contestó</option>
                    <option value="No answer">❌ No contestó</option>
                    <option value="Voicemail">📱 Dejé voicemail</option>
                    <option value="Sent">📤 Enviado</option>
                  </select>
                </div>
                <div style={S.fRow}>
                  <label style={S.fLabel}>Fecha</label>
                  <input type="date" style={S.fInput} value={form.date}
                    onChange={e => setForm({...form, date: e.target.value})} />
                </div>
                <div style={S.fRow}>
                  <label style={S.fLabel}>Notas</label>
                  <textarea style={{ ...S.fInput, minHeight: 70, resize:'vertical', fontFamily:'inherit' }}
                    placeholder="Ej: Muy interesada, quiere información de precios..."
                    value={form.note} onChange={e => setForm({...form, note: e.target.value})} />
                </div>
                <div style={{ display:'flex', gap: 8, marginTop: 8 }}>
                  <button style={S.cancelBtn} onClick={() => setShowForm(false)}>Cancelar</button>
                  <button style={S.saveBtn}   onClick={saveContact} disabled={saving}>
                    {saving ? 'Guardando...' : 'Guardar'}
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </>
  );
}

function InfoItem({ label, val }) {
  return (
    <div>
      <div style={{ fontSize: 11, color: '#888780', marginBottom: 2 }}>{label}</div>
      <div style={{ fontSize: 13, color: '#1a1a18' }}>{val || '—'}</div>
    </div>
  );
}

const S = {
  overlay: { position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.35)', zIndex: 100 },
  panel:   { position: 'fixed', top: 0, right: 0, bottom: 0, width: 420, background: 'white', zIndex: 101, display: 'flex', flexDirection: 'column', borderLeft: '0.5px solid #e0ddd6', overflowY: 'auto' },
  head:    { padding: '16px 20px', borderBottom: '0.5px solid #e0ddd6', display: 'flex', alignItems: 'center', justifyContent: 'space-between', position: 'sticky', top: 0, background: 'white', zIndex: 1 },
  avatarLg:{ width: 44, height: 44, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 16, fontWeight: 600 },
  pName:   { fontSize: 16, fontWeight: 600, color: '#1a1a18' },
  pSub:    { fontSize: 12, color: '#888780', marginTop: 2 },
  closeBtn:{ width: 28, height: 28, borderRadius: '50%', border: '0.5px solid #e0ddd6', background: 'white', cursor: 'pointer', fontSize: 14, color: '#888780' },
  body:    { padding: 20, flex: 1 },
  section: { marginBottom: 24 },
  secTitle:{ fontSize: 11, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.06em', color: '#888780', marginBottom: 10 },
  infoGrid:{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 },
  stBtn:   { padding: '5px 12px', borderRadius: 100, fontSize: 12, cursor: 'pointer' },
  touchCard:{ background: '#f9f8f5', borderRadius: 8, padding: '10px 12px', border: '0.5px solid #e0ddd6' },
  addBtn:  { marginTop: 10, width: '100%', padding: 10, border: '1px dashed #ccc', borderRadius: 8, background: 'transparent', cursor: 'pointer', fontSize: 13, color: '#888780' },
  addForm: { marginTop: 10, background: '#f9f8f5', borderRadius: 10, padding: 14, border: '0.5px solid #e0ddd6' },
  fRow:    { marginBottom: 10 },
  fLabel:  { fontSize: 11, color: '#888780', display: 'block', marginBottom: 4 },
  fInput:  { width: '100%', padding: '7px 10px', border: '0.5px solid #ccc', borderRadius: 8, fontSize: 13, background: 'white', outline: 'none', color: '#1a1a18' },
  cancelBtn:{ flex: 1, padding: 8, borderRadius: 8, border: '0.5px solid #ccc', background: 'white', cursor: 'pointer', fontSize: 13, color: '#888780' },
  saveBtn:  { flex: 1, padding: 8, borderRadius: 8, border: 'none', background: '#1D9E75', color: 'white', cursor: 'pointer', fontSize: 13, fontWeight: 600 },
};
