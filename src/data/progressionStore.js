/**
 * Tracks correct answers per category+subcategory to drive difficulty progression.
 * Storage: individual localStorage keys — `bonnes_reponses_${categorie}_${sousCategorie}`
 * Level thresholds: 0-14 = débutant, 15-39 = intermédiaire, 40+ = expert
 */

// ─── Key helper ───────────────────────────────────────────────────────
function makeKey(categorie, sousCategorie = '') {
  return `bonnes_reponses_${categorie}_${sousCategorie}`;
}

function lireCompteur(categorie, sousCategorie = '') {
  return parseInt(localStorage.getItem(makeKey(categorie, sousCategorie)) || '0', 10);
}

function ecrireCompteur(categorie, sousCategorie = '', valeur) {
  localStorage.setItem(makeKey(categorie, sousCategorie), String(valeur));
}

// ─── Level logic ──────────────────────────────────────────────────────
export function calculerNiveau(total) {
  if (total >= 40) return 'expert';
  if (total >= 15) return 'intermediaire';
  return 'debutant';
}

export function getNiveauLabel(niveau) {
  if (niveau === 'intermediaire') return 'Intermédiaire';
  if (niveau === 'expert') return 'Expert';
  return 'Débutant';
}

export function getNiveauBadge(niveau) {
  if (niveau === 'expert')       return { emoji: '🔥',  label: 'Expert',        cls: 'bg-error/10 text-error' };
  if (niveau === 'intermediaire') return { emoji: '⭐⭐', label: 'Intermédiaire', cls: 'bg-amber-500/10 text-amber-500' };
  return                                 { emoji: '⭐',  label: 'Débutant',      cls: 'bg-success/10 text-success' };
}

export function getProgressionText(total, niveau) {
  if (niveau === 'expert')        return 'Niveau maximum atteint 🏆';
  if (niveau === 'intermediaire') return `Intermédiaire : ${total - 15}/25 bonnes réponses`;
  return                                 `Débutant : ${total}/15 bonnes réponses`;
}

// ─── Public API ───────────────────────────────────────────────────────

/**
 * Increment correct-answer counter for a category+sub pair.
 * Returns the new total.
 */
export function incrementerBonnesReponses(categorie, sousCategorie = '') {
  const actuel  = lireCompteur(categorie, sousCategorie);
  const nouveau = actuel + 1;
  ecrireCompteur(categorie, sousCategorie, nouveau);
  return nouveau;
}

/**
 * Returns { total, niveau } for a category+sub pair.
 */
export function getProgression(categorie, sousCategorie = '') {
  const total = lireCompteur(categorie, sousCategorie);
  return { total, niveau: calculerNiveau(total) };
}

/**
 * Add `count` correct answers for a category+sub pair.
 * Returns { prevNiveau, newNiveau, levelUp }.
 */
export function addCorrectAnswers(categorie, count, sousCategorie = '') {
  const prev      = lireCompteur(categorie, sousCategorie);
  const prevNiveau = calculerNiveau(prev);
  const nouveau    = prev + count;
  ecrireCompteur(categorie, sousCategorie, nouveau);
  const newNiveau  = calculerNiveau(nouveau);
  return { prevNiveau, newNiveau, levelUp: newNiveau !== prevNiveau };
}

/**
 * Simulate N correct answers for every active session (dev/test helper).
 * sessions: array of { category, sub } objects.
 */
export function simulerBonnesReponses(sessions, count = 20) {
  sessions.forEach(({ category, sub }) => {
    const actuel  = lireCompteur(category, sub);
    ecrireCompteur(category, sub, actuel + count);
  });
}

/**
 * Returns all localStorage keys managed by this store.
 * Used by Settings reset to clean up.
 */
export function getAllProgressionKeys() {
  const keys = [];
  for (let i = 0; i < localStorage.length; i++) {
    const k = localStorage.key(i);
    if (k && k.startsWith('bonnes_reponses_')) keys.push(k);
  }
  return keys;
}
