import { supabase } from './supabase';

const CACHE_THRESHOLD = 10; // Réduit de 20 → 10 pour utiliser le cache plus souvent

/**
 * Get cached questions for a category/sub/level combo.
 * Returns null if not enough cached or Supabase is offline.
 */
export async function getCachedQuestions(categorie, sousCategorie, niveau, langue, count) {
  if (!supabase) return null;

  try {
    const fetchCount = Math.max(count * 2, 20);
    const { data, error } = await supabase
      .from('questions_cache')
      .select('id, contenu, utilisation_count')
      .eq('categorie', categorie)
      .eq('sous_categorie', sousCategorie)
      .eq('niveau', niveau)
      .eq('langue', langue)
      .order('utilisation_count', { ascending: true }) // moins utilisées en premier
      .limit(fetchCount);                               // ← limit() côté Supabase, pas en mémoire

    if (error) {
      console.warn('Cache read error:', error.message);
      return null;
    }

    if (!data || data.length < CACHE_THRESHOLD) {
      console.log(`📭 Cache MISS — ${data?.length || 0} questions (min ${CACHE_THRESHOLD})`);
      return null;
    }

    console.log(`✅ Cache HIT — ${data.length} questions disponibles`);

    // Shuffler et prendre les `count` premières
    const shuffled = data.sort(() => Math.random() - 0.5).slice(0, count);

    // Incrémenter le compteur en une seule requête (batch update via in())
    const ids = shuffled.map((q) => q.id);
    supabase
      .from('questions_cache')
      .update({ utilisation_count: supabase.rpc ? undefined : 1 }) // no-op placeholder
      .in('id', ids)
      .catch(() => {});
    // Update simple non-bloquant (best-effort, pas attendu)
    Promise.all(
      shuffled.map((q) =>
        supabase
          .from('questions_cache')
          .update({ utilisation_count: (q.utilisation_count || 0) + 1 })
          .eq('id', q.id)
      )
    ).catch(() => {});

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
 * Prefetch — lance le chargement en arrière-plan sans bloquer l'UI.
 * Stocke le résultat dans un Map global pour que Session.jsx le récupère.
 */
const prefetchStore = new Map();

export function prefetchQuestions(category, subCategory, difficulty, langue, count) {
  const key = `${category}::${subCategory}::${difficulty}::${langue}`;
  if (prefetchStore.has(key)) return; // déjà en cours

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

  prefetchStore.set(key, promise); // stocke la Promise pendant le chargement
}

export function getPrefetched(category, subCategory, difficulty, langue) {
  const key = `${category}::${subCategory}::${difficulty}::${langue}`;
  const val = prefetchStore.get(key);
  prefetchStore.delete(key); // consommer une seule fois
  return val; // peut être une Promise, un tableau, ou null
}
