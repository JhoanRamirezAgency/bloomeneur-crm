import { createClient } from '@supabase/supabase-js';

export const supabase = createClient(
  process.env.REACT_APP_SUPABASE_URL,
  process.env.REACT_APP_SUPABASE_ANON_KEY
);

// ─── DISTRIBUCIÓN DE CS ──────────────────────────────────────────────────────
// Jessica: 40% | Marcela: 40% | Sofia: 20%
export const CS_USERS = [
  { email: 'jessica@bloomeneur.com', name: 'Jessica', weight: 40 },
  { email: 'marcela@bloomeneur.com', name: 'Marcela', weight: 40 },
  { email: 'sofia@bloomeneur.com',   name: 'Sofia',   weight: 20 },
];

// Weighted round-robin: dado cuántos leads tiene cada CS, elige el siguiente
export function assignCS(counts) {
  // counts = { jessica_id: 45, marcela_id: 44, sofia_id: 22 }
  // Normaliza: compara ratio actual vs ratio objetivo
  let best = null;
  let bestScore = Infinity;
  const total = Object.values(counts).reduce((a, b) => a + b, 0) || 1;

  CS_USERS.forEach(cs => {
    const current = (counts[cs.email] || 0) / total;
    const target  = cs.weight / 100;
    const score   = current - target; // cuanto más negativo, más necesita leads
    if (score < bestScore) { bestScore = score; best = cs.email; }
  });
  return best;
}
