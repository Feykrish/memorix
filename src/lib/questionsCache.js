import { supabase } from './supabase';

const CACHE_THRESHOLD = 5;

/**
 * Get cached questions for a category/sub combo.
 * Ignores niveau/langue filters to maximize cache hits.
 * Returns array of question objects or null.
 */
export async function getCachedQuestions(categorie, sousCategorie, niveau, langue, count) {
  if (!supabase) return null;

  console.log('🔍 Recherche cache pour:', categorie, sousCategorie);

  try {
    const { data, error } = await supabase
      .from('questions_cache')
      .select('id, contenu, utilisation_count')
      .eq('categorie', categorie)
      .eq('sous_categorie', sousCategorie)
      .order('utilisation_count', { ascending: true })
      .limit(50);

    if (error) {
      console.warn('Cache read error:', error.message);
      return null;
    }

    console.log('📊 Résultat cache:', data?.length ?? 0, 'entrées trouvées');

    if (!data || data.length < CACHE_THRESHOLD) {
      console.log(`📭 Cache MISS — ${data?.length || 0} questions (min ${CACHE_THRESHOLD})`);
      return null;
    }

    // flatMap handles: single object, array, or {questions:[...]} per row
    const rawQuestions = data.flatMap((row) => {
      const c = row.contenu;
      if (Array.isArray(c)) return c;
      if (c?.questions && Array.isArray(c.questions)) return c.questions;
      if (c && typeof c === 'object') return [c];
      return [];
    });

    // Normalize inconsistent field names from seeded/legacy data
    const allQuestions = rawQuestions
      .map((raw) => {
        const text    = raw.text    || raw.question            || '';
        const answer  = raw.answer  || raw.reponse_correcte    || '';
        const choices = raw.choices || raw.choix               || [];
        // Inject correct answer if missing
        const safeChoices = choices.includes(answer) ? choices : (answer ? [answer, ...choices] : choices);
        return {
          id:         raw.id        || undefined,
          text,
          answer,
          choices:    safeChoices,
          keywords:   raw.keywords  || raw.mots_cles           || [],
          anecdote:   raw.anecdote  || '',
          hint:       raw.hint      || raw.indice              || '',
          difficulty: raw.difficulty || raw.difficulte         || 'moyen',
          isReview:   false,
        };
      })
      .filter((q) => q.text && q.choices.length >= 4);

    console.log(`✅ Cache HIT — ${allQuestions.length} questions disponibles après flatMap`);

    if (allQuestions.length < CACHE_THRESHOLD) {
      console.log('📭 Pas assez de questions après extraction contenu');
      return null;
    }

    // Shuffle and take count
    const shuffled = allQuestions.sort(() => Math.random() - 0.5).slice(0, count);

    // Increment usage counts (best-effort, non-blocking)
    const ids = data.map((q) => q.id);
    Promise.all(
      data.map((q) =>
        supabase
          .from('questions_cache')
          .update({ utilisation_count: (q.utilisation_count || 0) + 1 })
          .eq('id', q.id)
      )
    ).catch(() => {});

    return shuffled;
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
      utilisation_count: 0,
    }));

    const { error } = await supabase
      .from('questions_cache')
      .upsert(rows, { onConflict: 'id' });

    if (error) {
      console.warn('Cache write error:', error.message);
    } else {
      console.log(`💾 Cache saved — ${rows.length} questions pour ${categorie}·${sousCategorie}·${niveau}`);
    }
  } catch (err) {
    console.warn('Cache save error:', err.message);
  }
}

/**
 * Prefetch — load in background, store result in Map for Session to consume.
 */
const prefetchStore = new Map();

export function prefetchQuestions(category, subCategory, difficulty, langue, count) {
  const key = `${category}::${subCategory}::${difficulty}::${langue}`;
  if (prefetchStore.has(key)) return;

  console.log(`⚡ Prefetch lancé: ${key}`);
  const promise = getCachedQuestions(category, subCategory, difficulty, langue, count * 2)
    .then((result) => {
      prefetchStore.set(key, result);
      console.log(`⚡ Prefetch terminé: ${key} → ${result ? result.length + ' questions' : 'null (API needed)'}`);
      return result;
    })
    .catch(() => {
      prefetchStore.set(key, null);
    });

  prefetchStore.set(key, promise);
}

export function getPrefetched(category, subCategory, difficulty, langue) {
  const key = `${category}::${subCategory}::${difficulty}::${langue}`;
  const val = prefetchStore.get(key);
  prefetchStore.delete(key);
  return val;
}
