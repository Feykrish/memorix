/**
 * Tracks cumulative correct answers per category to drive difficulty progression.
 * Stored in localStorage under "memorix-progression".
 * Level thresholds: 0-14 = débutant, 15-39 = intermédiaire, 40+ = expert
 */

const STORAGE_KEY = 'memorix-progression';

function getStore() {
  try { return JSON.parse(localStorage.getItem(STORAGE_KEY) || '{}'); }
  catch { return {}; }
}

function saveStore(store) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(store));
}

export function calculerNiveau(total) {
  if (total < 15) return 'debutant';
  if (total < 40) return 'intermediaire';
  return 'expert';
}

export function getNiveauLabel(niveau) {
  if (niveau === 'intermediaire') return 'Intermédiaire';
  if (niveau === 'expert') return 'Expert';
  return 'Débutant';
}

export function getNiveauBadge(niveau) {
  if (niveau === 'expert') return { emoji: '🔥', label: 'Expert', cls: 'bg-error/10 text-error' };
  if (niveau === 'intermediaire') return { emoji: '⭐⭐', label: 'Intermédiaire', cls: 'bg-amber-500/10 text-amber-500' };
  return { emoji: '⭐', label: 'Débutant', cls: 'bg-success/10 text-success' };
}

export function getProgressionText(total, niveau) {
  if (niveau === 'expert') return 'Niveau maximum atteint 🏆';
  if (niveau === 'intermediaire') return `Intermédiaire : ${total - 15}/25 bonnes réponses`;
  return `Débutant : ${total}/15 bonnes réponses`;
}

/**
 * Returns { total, niveau } for a category+sub pair.
 * Key format: "category::sub" for per-subcategory tracking.
 */
export function getProgression(category, sub = '') {
  const store = getStore();
  const key   = sub ? `${category}::${sub}` : category;
  const total = store[key] || 0;
  return { total, niveau: calculerNiveau(total) };
}

/**
 * Add correct answers for a category+sub pair.
 * Returns { prevNiveau, newNiveau, levelUp } so the caller can show a message.
 */
export function addCorrectAnswers(category, count, sub = '') {
  const store = getStore();
  const key   = sub ? `${category}::${sub}` : category;
  const prev  = store[key] || 0;
  const prevNiveau = calculerNiveau(prev);
  store[key]       = prev + count;
  const newNiveau  = calculerNiveau(store[key]);
  saveStore(store);
  return { prevNiveau, newNiveau, levelUp: newNiveau !== prevNiveau };
}
