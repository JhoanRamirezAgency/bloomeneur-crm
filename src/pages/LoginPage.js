import React, { useState } from 'react';
import { useAuth } from '../lib/AuthContext';

export default function LoginPage() {
  const { signIn }                    = useAuth();
  const [email, setEmail]             = useState('');
  const [password, setPassword]       = useState('');
  const [error, setError]             = useState('');
  const [loading, setLoading]         = useState(false);

  async function handleSubmit(e) {
    e.preventDefault();
    setError('');
    setLoading(true);
    const { error } = await signIn(email, password);
    if (error) setError(error.message);
    setLoading(false);
  }

  return (
    <div style={styles.bg}>
      <div style={styles.card}>
        <div style={styles.logo}>
          <div style={styles.logoIcon}>
            <svg width="22" height="22" viewBox="0 0 16 16" fill="white">
              <path d="M8 2C5.8 2 4 3.8 4 6c0 1.5.8 2.8 2 3.5V11h4V9.5c1.2-.7 2-2 2-3.5 0-2.2-1.8-4-4-4zm0 6.5c-1.4 0-2.5-1.1-2.5-2.5S6.6 3.5 8 3.5 10.5 4.6 10.5 6 9.4 8.5 8 8.5zM6 12h4v1H6z"/>
            </svg>
          </div>
          <div>
            <div style={styles.logoName}>Bloomeneur CRM</div>
            <div style={styles.logoSub}>Gestión de leads</div>
          </div>
        </div>

        <form onSubmit={handleSubmit} style={styles.form}>
          <div style={styles.field}>
            <label style={styles.label}>Correo electrónico</label>
            <input
              type="email" required value={email}
              onChange={e => setEmail(e.target.value)}
              style={styles.input} placeholder="tu@bloomeneur.com"
            />
          </div>
          <div style={styles.field}>
            <label style={styles.label}>Contraseña</label>
            <input
              type="password" required value={password}
              onChange={e => setPassword(e.target.value)}
              style={styles.input} placeholder="••••••••"
            />
          </div>
          {error && <div style={styles.error}>{error}</div>}
          <button type="submit" style={styles.btn} disabled={loading}>
            {loading ? 'Ingresando...' : 'Ingresar'}
          </button>
        </form>
      </div>
    </div>
  );
}

const styles = {
  bg: {
    minHeight: '100vh', display: 'flex', alignItems: 'center',
    justifyContent: 'center', background: '#f5f5f3',
  },
  card: {
    background: 'white', borderRadius: 16, padding: '40px 36px',
    width: 360, border: '0.5px solid #e0ddd6',
  },
  logo: { display: 'flex', alignItems: 'center', gap: 12, marginBottom: 32 },
  logoIcon: {
    width: 44, height: 44, borderRadius: 10, background: '#1D9E75',
    display: 'flex', alignItems: 'center', justifyContent: 'center',
  },
  logoName: { fontSize: 18, fontWeight: 600, color: '#1a1a18' },
  logoSub:  { fontSize: 12, color: '#888780', marginTop: 2 },
  form:     { display: 'flex', flexDirection: 'column', gap: 16 },
  field:    { display: 'flex', flexDirection: 'column', gap: 6 },
  label:    { fontSize: 13, fontWeight: 500, color: '#444441' },
  input:    {
    padding: '9px 12px', border: '0.5px solid #ccc', borderRadius: 8,
    fontSize: 14, outline: 'none', color: '#1a1a18',
  },
  btn: {
    marginTop: 8, padding: '11px', background: '#1D9E75', color: 'white',
    border: 'none', borderRadius: 8, fontSize: 14, fontWeight: 600,
    cursor: 'pointer',
  },
  error: {
    padding: '8px 12px', background: '#FCEBEB', color: '#A32D2D',
    borderRadius: 8, fontSize: 13,
  },
};
