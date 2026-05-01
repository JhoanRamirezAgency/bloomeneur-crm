import React, { useState } from 'react';
import { supabase, CS_USERS, assignCS } from '../lib/supabase';

/**
 * Modal para agregar un lead manualmente.
 * Props:
 *   isAdmin    — boolean, si el usuario es admin puede elegir CS
 *   userEmail  — email del CS actual (para asignación automática si no es admin)
 *   onClose    — callback para cerrar el modal
 *   onCreated  — callback(lead) llamado cuando el lead se crea exitosamente
 */
export default function AddLeadModal({ isAdmin, userEmail, onClose, onCreated }) {
  const [saving, setSaving] = useState(false);
  const [error,  setError]  = useState('');
  const [form, setForm] = useState({
    full_name:   '',
    phone:       '',
    email:       '',
    intent:      '',
    timeline:    '',
    platform:    'manual',
    source:      'Manual',
    status:      'New',
    assigned_to: isAdmin ? CS_USERS[0].email : userEmail,
  });

  function set(key, val) {
    setForm(f => ({ ...f, [key]: val }));
  }

  async function handleSave() {
    if (!form.full_name.trim()) { setError('El nombre es obligatorio.'); return; }
    if (!form.phone.trim() && !form.email.trim()) { setError('Ingresa al menos teléfono o email.'); return; }

    setSaving(true);
    setError('');

    // Si admin y no eligió CS, asignar automático
    let assigned = form.assigned_to;
    if (!assigned) {
      const { data: csCounts } = await supabase.from('leads').select('assigned_to');
      const counts = {};
      CS_USERS.forEach(cs => counts[cs.email] = 0);
      (csCounts || []).forEach(r => {
        if (r.assigned_to) counts[r.assigned_to] = (counts[r.assigned_to] || 0) + 1;
      });
      assigned = assignCS(counts);
    }

    const payload = {
      full_name:   form.full_name.trim(),
      phone:       form.phone.trim(),
      email:       form.email.trim(),
      intent:      form.intent.trim(),
      timeline:    form.timeline.trim(),
      platform:    form.platform,
      source:      form.source,
      status:      form.status,
      assigned_to: assigned,
      touches:     [],
    };

    const { data, error: supaErr } = await supabase
      .from('leads').insert(payload).select().single();

    if (supaErr) {
      setError(supaErr.message);
      setSaving(false);
      return;
    }

    onCreated(data);
    onClose();
  }

  return (
    <>
      <div style={S.overlay} onClick={onClose} />
      <div style={S.modal}>
        {/* Header */}
        <div style={S.head}>
          <div style={S.headTitle}>
            <div style={S.headIcon}>+</div>
            Agregar lead manual
          </div>
          <button style={S.closeBtn} onClick={onClose}>✕</button>
        </div>

        <div style={S.body}>
          {/* Nombre */}
          <Row label="Nombre completo *">
            <input style={S.input} placeholder="Ej: María García" value={form.full_name}
              onChange={e => set('full_name', e.target.value)} />
          </Row>

          {/* Teléfono + Email */}
          <div style={S.twoCol}>
            <Row label="Teléfono">
              <input style={S.input} placeholder="+1 555 000 0000" value={form.phone}
                onChange={e => set('phone', e.target.value)} />
            </Row>
            <Row label="Email">
              <input style={S.input} type="email" placeholder="correo@ejemplo.com" value={form.email}
                onChange={e => set('email', e.target.value)} />
            </Row>
          </div>

          {/* Intención */}
          <Row label="Intención / interés">
            <input style={S.input} placeholder="Ej: Quiere más información sobre precios" value={form.intent}
              onChange={e => set('intent', e.target.value)} />
          </Row>

          {/* Timeline */}
          <Row label="Timeline de decisión">
            <input style={S.input} placeholder="Ej: Este mes, En 3 meses..." value={form.timeline}
              onChange={e => set('timeline', e.target.value)} />
          </Row>

          {/* Estado + Plataforma */}
          <div style={S.twoCol}>
            <Row label="Estado inicial">
              <select style={S.input} value={form.status} onChange={e => set('status', e.target.value)}>
                {['New','Hot','Maybe','Customer','Lost'].map(s => <option key={s}>{s}</option>)}
              </select>
            </Row>
            <Row label="Fuente / canal">
              <select style={S.input} value={form.platform} onChange={e => set('platform', e.target.value)}>
                <option value="manual">Manual / Referido</option>
                <option value="fb">Facebook</option>
                <option value="ig">Instagram</option>
                <option value="sh">Shopify</option>
                <option value="other">Otro</option>
              </select>
            </Row>
          </div>

          {/* Asignación — solo admin ve el selector */}
          {isAdmin && (
            <Row label="Asignar a CS">
              <select style={S.input} value={form.assigned_to} onChange={e => set('assigned_to', e.target.value)}>
                {CS_USERS.map(cs => (
                  <option key={cs.email} value={cs.email}>{cs.name} ({cs.email})</option>
                ))}
              </select>
            </Row>
          )}

          {error && (
            <div style={S.errorBox}>{error}</div>
          )}
        </div>

        {/* Footer */}
        <div style={S.footer}>
          <button style={S.cancelBtn} onClick={onClose}>Cancelar</button>
          <button style={S.saveBtn} onClick={handleSave} disabled={saving}>
            {saving ? 'Guardando...' : '+ Crear lead'}
          </button>
        </div>
      </div>
    </>
  );
}

function Row({ label, children }) {
  return (
    <div style={{ marginBottom: 12 }}>
      <label style={{ fontSize: 11, color: '#888780', display: 'block', marginBottom: 4, fontWeight: 500 }}>
        {label}
      </label>
      {children}
    </div>
  );
}

const S = {
  overlay:   { position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.40)', zIndex: 200 },
  modal:     { position: 'fixed', top: '50%', left: '50%', transform: 'translate(-50%,-50%)', width: 480, maxHeight: '90vh', background: 'white', borderRadius: 14, zIndex: 201, display: 'flex', flexDirection: 'column', border: '0.5px solid #e0ddd6', overflow: 'hidden' },
  head:      { padding: '16px 20px', borderBottom: '0.5px solid #e0ddd6', display: 'flex', alignItems: 'center', justifyContent: 'space-between', background: 'white' },
  headTitle: { display: 'flex', alignItems: 'center', gap: 10, fontSize: 15, fontWeight: 600, color: '#1a1a18' },
  headIcon:  { width: 28, height: 28, borderRadius: 8, background: '#1D9E75', color: 'white', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 18, fontWeight: 400 },
  closeBtn:  { width: 28, height: 28, borderRadius: '50%', border: '0.5px solid #e0ddd6', background: 'white', cursor: 'pointer', fontSize: 14, color: '#888780' },
  body:      { padding: '18px 20px', overflowY: 'auto', flex: 1 },
  twoCol:    { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 },
  input:     { width: '100%', padding: '8px 10px', border: '0.5px solid #ccc', borderRadius: 8, fontSize: 13, background: 'white', outline: 'none', color: '#1a1a18', boxSizing: 'border-box' },
  footer:    { padding: '14px 20px', borderTop: '0.5px solid #e0ddd6', display: 'flex', gap: 8, background: 'white' },
  cancelBtn: { flex: 1, padding: '9px', borderRadius: 8, border: '0.5px solid #ccc', background: 'white', cursor: 'pointer', fontSize: 13, color: '#888780' },
  saveBtn:   { flex: 2, padding: '9px', borderRadius: 8, border: 'none', background: '#1D9E75', color: 'white', cursor: 'pointer', fontSize: 13, fontWeight: 600 },
  errorBox:  { padding: '8px 12px', background: '#FCEBEB', color: '#A32D2D', borderRadius: 8, fontSize: 13, marginTop: 4 },
};
