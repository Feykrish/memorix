/**
 * Client-side translation layer for Memorix.
 * Questions live in Supabase in French. When the UI language is not French,
 * this module translates them via /api/translate and caches results in:
 *   - Supabase table: traductions_cache  (persistent, shared)
 *   - localStorage: memorix-translations (fast, per-device)
 */

import { supabase } from './supabase';

const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:3001';
const LOCAL_KEY = 'memorix-translations';

// ─── localStorage helpers ─────────────────────────────────────────────

function localGet(questionText, langue) {
  try {
    const store = JSON.parse(localStorage.getItem(LOCAL_KEY) || '{}');
    return store[`${questionText.slice(0, 150)}::${langue}`] || null;
  } catch { return null; }
}

function localSet(questionText, langue, translated) {
  try {
    const store = JSON.parse(localStorage.getItem(LOCAL_KEY) || '{}');
    const key = `${questionText.slice(0, 150)}::${langue}`;
    store[key] = translated;
    // Cap at 500 entries
    const keys = Object.keys(store);
    if (keys.length > 500) delete store[keys[0]];
    localStorage.setItem(LOCAL_KEY, JSON.stringify(store));
  } catch {}
}

// ─── Supabase helpers ─────────────────────────────────────────────────

async function supabaseGet(questionText, langue) {
  if (!supabase) return null;
  try {
    const { data } = await supabase
      .from('traductions_cache')
      .select('contenu')
      .eq('question_id', questionText.slice(0, 200))
      .eq('langue', langue)
      .maybeSingle();
    return data?.contenu || null;
  } catch { return null; }
}

function supabaseSave(questionText, langue, contenu) {
  if (!supabase) return;
  supabase.from('traductions_cache').upsert({
    question_id: questionText.slice(0, 200),
    langue,
    contenu,
  }, { onConflict: 'question_id,langue' }).catch(() => {});
}

// ─── Merge translated fields into a question object ───────────────────

function applyTranslation(original, tr) {
  if (!tr) return original;
  return {
    ...original,
    text:     tr.text     || original.text,
    answer:   tr.answer   || original.answer,
    choices:  tr.choices?.length ? tr.choices : original.choices,
    anecdote: tr.anecdote || original.anecdote,
    hint:     tr.hint     || original.hint,
  };
}

// ─── Main export ──────────────────────────────────────────────────────

/**
 * Translate an array of question objects to `langue`.
 * - Returns immediately if langue === 'fr'
 * - Checks localStorage → Supabase before calling API
 * - Saves new translations to both caches
 */
export async function translateQuestions(questions, langue) {
  if (!langue || langue === 'fr') return questions;

  const results = new Array(questions.length);
  const toTranslate = [];   // questions that need API translation
  const toTranslateIdx = []; // their original indices

  // 1. Fill from caches
  for (let i = 0; i < questions.length; i++) {
    const q = questions[i];

    // Local cache (fastest)
    const local = localGet(q.text, langue);
    if (local) { results[i] = applyTranslation(q, local); continue; }

    // Supabase cache
    const remote = await supabaseGet(q.text, langue);
    if (remote) {
      localSet(q.text, langue, remote); // warm local cache
      results[i] = applyTranslation(q, remote);
      continue;
    }

    // Needs fresh translation
    results[i] = q; // placeholder
    toTranslate.push(q);
    toTranslateIdx.push(i);
  }

  if (toTranslate.length === 0) return results;

  // 2. Batch API call
  console.log(`🌍 Translating ${toTranslate.length} questions → ${langue}`);
  try {
    const res = await fetch(`${API_BASE}/api/translate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        questions: toTranslate.map((q) => ({
          text: q.text,
          answer: q.answer,
          choices: q.choices || [],
          anecdote: q.anecdote || '',
          hint: q.hint || '',
        })),
        langueCible: langue,
      }),
    });

    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const { translated } = await res.json();

    // 3. Apply + save translations
    for (let i = 0; i < toTranslate.length; i++) {
      const orig = toTranslate[i];
      const tr   = translated?.[i];
      if (!tr) continue;

      const translationData = {
        text: tr.text, answer: tr.answer,
        choices: tr.choices, anecdote: tr.anecdote, hint: tr.hint,
      };

      results[toTranslateIdx[i]] = applyTranslation(orig, translationData);
      localSet(orig.text, langue, translationData);
      supabaseSave(orig.text, langue, translationData);
    }
  } catch (err) {
    console.warn('⚠️ Translation API failed, using French fallback:', err.message);
    // results already contain the French originals as placeholders — safe fallback
  }

  return results;
}
