/**
 * Tracks all questions ever asked to a user per category::sub.
 * Stored in localStorage under "memorix-history_{category}_{sub}".
 * Used to prevent question repetition across days and sessions.
 */

function getKey(category, sub) {
  return `memorix-history_${category}_${sub}`;
}

/**
 * Get all question texts ever asked for this category/sub.
 */
export function getAskedQuestions(category, sub) {
  try {
    return JSON.parse(localStorage.getItem(getKey(category, sub)) || '[]');
  } catch {
    return [];
  }
}

/**
 * Add new question texts to the history.
 */
export function addToHistory(category, sub, questionTexts) {
  const existing = getAskedQuestions(category, sub);
  const combined = [...new Set([...existing, ...questionTexts])];
  localStorage.setItem(getKey(category, sub), JSON.stringify(combined));
  console.log(`📝 History updated for ${category}::${sub} — ${combined.length} total questions tracked`);
}

/**
 * Get the count of pending (failed, waiting for review) questions for a category/sub.
 */
export function getPendingCount(category, sub) {
  try {
    const reviews = JSON.parse(localStorage.getItem('memorix-reviews') || '{}');
    const key = `${category}::${sub}`;
    return (reviews[key] || []).length;
  } catch {
    return 0;
  }
}

/**
 * Clear history for a category/sub (used on session delete).
 */
export function clearHistory(category, sub) {
  localStorage.removeItem(getKey(category, sub));
}
