/**
 * Memorix — Seed MCQ Choices (rate-limit safe, resumable)
 * Generates 3 wrong answers for every question in Supabase that lacks choices.
 * Run: node scripts/seed-choices.js
 *
 * - Processes 3 questions at a time, 4s delay between batches (~45 req/min)
 * - Auto-retries on 429 with 15s pause (up to 3 retries per question)
 * - Saves progress to scripts/seed-progress.json — resumes after interruption
 */

import { fileURLToPath } from 'url';
import { dirname, resolve } from 'path';
import { readFileSync, writeFileSync, existsSync } from 'fs';
import { createClient } from '@supabase/supabase-js';

// ─── Load .env ────────────────────────────────────────────────────────
const __dirname = dirname(fileURLToPath(import.meta.url));
const envPath   = resolve(__dirname, '..', '.env');
const PROGRESS_FILE = resolve(__dirname, 'seed-progress.json');

try {
  const envContent = readFileSync(envPath, 'utf8');
  for (const line of envContent.split('\n')) {
    const match = line.match(/^([^#=]+)=(.*)$/);
    if (match) process.env[match[1].trim()] = match[2].trim();
  }
  console.log('✅ .env loaded');
} catch (e) {
  console.error('❌ Could not load .env:', e.message);
  process.exit(1);
}

const ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY;
const SUPABASE_URL      = process.env.VITE_SUPABASE_URL;
const SUPABASE_KEY      = process.env.VITE_SUPABASE_ANON_KEY;

if (!ANTHROPIC_API_KEY) { console.error('❌ ANTHROPIC_API_KEY missing'); process.exit(1); }
if (!SUPABASE_URL || !SUPABASE_KEY) { console.error('❌ Supabase credentials missing'); process.exit(1); }

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);
const MODEL    = 'claude-sonnet-4-20250514';

// ─── Rate-limit config ────────────────────────────────────────────────
const BATCH_SIZE           = 3;     // questions per batch (sequential within batch)
const DELAY_BETWEEN_BATCHES = 4000; // ms — keeps us ~15 req/min (well under 50/min)
const DELAY_ON_RATE_LIMIT  = 15000; // ms pause on 429
const MAX_RETRIES          = 3;

// ─── Progress file helpers ────────────────────────────────────────────
function loadProgress() {
  try {
    if (existsSync(PROGRESS_FILE)) {
      const data = JSON.parse(readFileSync(PROGRESS_FILE, 'utf8'));
      console.log(`📂 Progress file found — ${data.done?.length || 0} already done, resuming...`);
      return new Set(data.done || []);
    }
  } catch {}
  return new Set();
}

function saveProgress(doneSet) {
  try {
    writeFileSync(PROGRESS_FILE, JSON.stringify({ done: [...doneSet], savedAt: new Date().toISOString() }, null, 2));
  } catch (e) {
    console.warn('⚠️ Could not save progress:', e.message);
  }
}

// ─── Sleep ────────────────────────────────────────────────────────────
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// ─── Claude API with retry on 429 ────────────────────────────────────
async function callClaudeWithRetry(prompt, retries = 0) {
  const res = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': ANTHROPIC_API_KEY,
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify({
      model: MODEL,
      max_tokens: 300,
      messages: [{ role: 'user', content: prompt }],
    }),
  });

  if (res.status === 429) {
    if (retries >= MAX_RETRIES) throw new Error('Rate limit — max retries reached');
    console.log(`\n   ⏳ Rate limit atteint — pause ${DELAY_ON_RATE_LIMIT / 1000}s avant retry ${retries + 1}/${MAX_RETRIES}...`);
    await sleep(DELAY_ON_RATE_LIMIT);
    return callClaudeWithRetry(prompt, retries + 1);
  }

  if (!res.ok) {
    const txt = await res.text().catch(() => '');
    const err = new Error(`Claude API ${res.status}: ${txt.slice(0, 200)}`);
    err.status = res.status;
    throw err;
  }

  const data = await res.json();
  return data.content?.[0]?.text || '';
}

// ─── Generate choices for one question (with retry) ───────────────────
async function generateChoices(question, answer, categorie, sousCategorie) {
  const prompt = `Catégorie : ${categorie} · ${sousCategorie}
Question : "${question}"
Bonne réponse : "${answer}"

Génère EXACTEMENT 3 mauvaises réponses pour un QCM. Règles STRICTES :
- Les mauvaises réponses doivent être du MÊME TYPE que la bonne réponse
  * Si la réponse est un nom propre → mauvaises réponses = autres noms propres du même domaine
  * Si la réponse est un chiffre → mauvaises réponses = autres chiffres plausibles
  * Si la réponse est un lieu → mauvaises réponses = autres lieux du même type
  * Si la réponse est un concept → mauvaises réponses = autres concepts du même domaine
- NE JAMAIS mélanger les types
- NE PAS réutiliser des mots de la question
- NE PAS générer des variantes orthographiques de "${answer}"
- Les mauvaises réponses doivent être plausibles mais clairement fausses

Réponds UNIQUEMENT avec ce JSON (sans markdown) :
{ "choix": ["${answer}", "mauvaise1", "mauvaise2", "mauvaise3"] }`;

  const text = await callClaudeWithRetry(prompt);
  const match = text.replace(/```json|```/g, '').trim().match(/\{[\s\S]*\}/);
  if (!match) throw new Error('No JSON in response: ' + text.slice(0, 80));

  let choix = (JSON.parse(match[0]).choix || []);
  if (!choix.includes(answer)) choix = [answer, ...choix.slice(0, 3)];
  if (choix.length < 4) throw new Error(`Only ${choix.length} choices returned`);
  return choix.slice(0, 4);
}

// ─── Fetch all rows without choices (paginated) ───────────────────────
async function fetchRowsWithoutChoices() {
  console.log('\n📥 Fetching questions from Supabase...');
  const PAGE = 1000;
  let all  = [];
  let from = 0;

  while (true) {
    const { data, error } = await supabase
      .from('questions_cache')
      .select('id, contenu, categorie, sous_categorie')
      .range(from, from + PAGE - 1);

    if (error) { console.error('Supabase error:', error.message); break; }
    if (!data?.length) break;

    const missing = data.filter((row) => {
      const c = row.contenu;
      return c && typeof c === 'object' && (!Array.isArray(c.choices) || c.choices.length < 4);
    });

    all.push(...missing);
    console.log(`   ${from + data.length} rows fetched — ${all.length} need choices`);
    if (data.length < PAGE) break;
    from += PAGE;
  }

  return all;
}

// ─── Main ─────────────────────────────────────────────────────────────
async function main() {
  console.log('🚀 Memorix — Seed MCQ Choices (rate-limit safe)');
  console.log(`   Batch: ${BATCH_SIZE} | Delay: ${DELAY_BETWEEN_BATCHES}ms | Rate-limit pause: ${DELAY_ON_RATE_LIMIT}ms\n`);

  const doneIds = loadProgress();
  const rows    = await fetchRowsWithoutChoices();

  // Skip rows already processed in a previous run
  const pending = rows.filter((r) => !doneIds.has(r.id));
  const total   = rows.length;
  const skip    = total - pending.length;

  if (pending.length === 0) {
    console.log('\n✅ All questions already have choices — nothing to do.');
    if (existsSync(PROGRESS_FILE)) writeFileSync(PROGRESS_FILE, JSON.stringify({ done: [], finished: true }));
    return;
  }

  console.log(`\n📊 ${total} need choices | ${skip} already done | ${pending.length} remaining\n`);

  let updated = 0;
  let errors  = 0;
  const globalIdx = () => skip + updated + errors + 1;

  // Process sequentially within each batch (not parallel) to avoid burst
  for (let i = 0; i < pending.length; i += BATCH_SIZE) {
    const batch = pending.slice(i, i + BATCH_SIZE);

    for (const row of batch) {
      const idx    = globalIdx();
      const c      = row.contenu;
      const q      = c?.text || c?.question || '';
      const answer = c?.answer || c?.reponse_correcte || '';

      if (!q || !answer) {
        console.log(`   [${idx}/${total}] ⚠️  Skip — no text/answer (id: ${row.id})`);
        errors++;
        doneIds.add(row.id); // mark so we don't retry
        saveProgress(doneIds);
        continue;
      }

      process.stdout.write(
        `   [${idx}/${total}] ${row.categorie} · ${row.sous_categorie} — "${q.slice(0, 45)}"... `
      );

      try {
        const choix = await generateChoices(q, answer, row.categorie, row.sous_categorie);

        const { error: updateError } = await supabase
          .from('questions_cache')
          .update({ contenu: { ...c, choices: choix } })
          .eq('id', row.id);

        if (updateError) throw new Error(updateError.message);

        updated++;
        doneIds.add(row.id);
        saveProgress(doneIds);
        console.log(`✅ ${JSON.stringify(choix)}`);
      } catch (err) {
        errors++;
        console.log(`❌ ${err.message}`);
        // Don't mark as done — will retry next run
      }
    }

    // Wait between batches (skip after last)
    if (i + BATCH_SIZE < pending.length) {
      await sleep(DELAY_BETWEEN_BATCHES);
    }
  }

  // Print summary
  const eta = Math.round((pending.length * (DELAY_BETWEEN_BATCHES / BATCH_SIZE)) / 60000);
  console.log(`\n${'─'.repeat(60)}`);
  console.log(`✅ Mis à jour cette session : ${updated}`);
  console.log(`⚠️  Erreurs cette session   : ${errors}`);
  console.log(`📦 Total traités (tous runs): ${doneIds.size}`);
  if (errors > 0) console.log(`   → Relancez le script pour réessayer les ${errors} erreurs`);
  console.log(`${'─'.repeat(60)}\n`);
}

main().catch((err) => {
  console.error('Fatal:', err);
  process.exit(1);
});
