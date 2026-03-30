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

/**
 * Returns { total, niveau } for a category.
 */
export function getProgression(category) {
  const store = getStore();
  const total = store[category] || 0;
  return { total, niveau: calculerNiveau(total) };
}

/**
 * Add correct answers for a category.
 * Returns { prevNiveau, newNiveau, levelUp } so the caller can show a message.
 */
export function addCorrectAnswers(category, count) {
  const store = getStore();
  const prev = store[category] || 0;
  const prevNiveau = calculerNiveau(prev);
  store[category] = prev + count;
  const newNiveau = calculerNiveau(store[category]);
  saveStore(store);
  return { prevNiveau, newNiveau, levelUp: newNiveau !== prevNiveau };
}
