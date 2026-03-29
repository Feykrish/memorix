import { supabase } from './supabase';

const CACHE_THRESHOLD = 20; // Need at least 20 cached questions to skip API

/**
 * Get cached questions for a category/sub/level combo.
 * Returns null if not enough cached or Supabase is offline.
 */
export async function getCachedQuestions(categorie, sousCategorie, niveau, langue, count) {
  if (!supabase) return null;

  try {
    const { data, error } = await supabase
      .from('questions_cache')
      .select('id, contenu, utilisation_count')
      .eq('categorie', categorie)
      .eq('sous_categorie', sousCategorie)
      .eq('niveau', niveau)
      .eq('langue', langue);

    if (error) {
      console.warn('Cache read error:', error.message);
      return null;
    }

    if (!data || data.length < CACHE_THRESHOLD) {
      return null; // Not enough cached — need API call
    }

    // Pick `count` random questions, preferring less-used ones
    const sorted = data.sort((a, b) => a.utilisation_count - b.utilisation_count);
    const picked = sorted.slice(0, Math.max(count * 3, 15)); // pool of least-used
    const shuffled = picked.sort(() => Math.random() - 0.5).slice(0, count);

    // Increment usage count for picked questions
    const ids = shuffled.map((q) => q.id);
    await supabase.rpc('increment_usage', { question_ids: ids }).catch(() => {});
    // Fallback: update one by one if RPC doesn't exist
    for (const q of shuffled) {
      await supabase
        .from('questions_cache')
        .update({ utilisation_count: (q.utilisation_count || 0) + 1 })
        .eq('id', q.id)
        .catch(() => {});
    }

    return shuffled.map((q) => q.contenu);
  } catch (err) {
    console.warn('Cache error:', err.message);
    return null;
  }
}

/**
 * Save generated questions to cache.
 */
export async function saveToCache(questions, categorie, sousCategorie, niveau, langue) {
  if (!supabase) return;

  try {
    const rows = questions.map((q) => ({
      id: `${categorie}::${sousCategorie}::${niveau}::${langue}::${Date.now()}::${Math.random().toString(36).slice(2, 8)}`,
      categorie,
      sous_categorie: sousCategorie,
      niveau,
      langue,
      contenu: q,
      utilisation_count: 1,
    }));

    const { error } = await supabase
      .from('questions_cache')
      .upsert(rows, { onConflict: 'id' });

    if (error) {
      console.warn('Cache write error:', error.message);
    }
  } catch (err) {
    console.warn('Cache save error:', err.message);
  }
}
