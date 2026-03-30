/**
 * Memorix — Seed MCQ Choices
 * Generates 3 wrong answers for every question in Supabase that lacks choices.
 * Run: node scripts/seed-choices.js
 */

import { fileURLToPath } from 'url';
import { dirname, resolve } from 'path';
import { readFileSync } from 'fs';
import { createClient } from '@supabase/supabase-js';

// ─── Load .env manually (same pattern as server.js) ──────────────────
const __dirname = dirname(fileURLToPath(import.meta.url));
const envPath = resolve(__dirname, '..', '.env');
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
const BATCH    = 5;   // questions per batch
const DELAY_MS = 1000; // wait between batches

// ─── Claude API call ──────────────────────────────────────────────────
async function callClaude(prompt) {
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
  if (!res.ok) {
    const txt = await res.text().catch(() => '');
    throw new Error(`Claude API ${res.status}: ${txt.slice(0, 200)}`);
  }
  const data = await res.json();
  return data.content?.[0]?.text || '';
}

// ─── Generate choices for a single question ───────────────────────────
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
- Les mauvaises réponses doivent être plausibles mais clairement fausses pour quelqu'un qui connaît le sujet

Réponds UNIQUEMENT avec ce JSON (sans markdown) :
{ "choix": ["${answer}", "mauvaise1", "mauvaise2", "mauvaise3"] }`;

  const text = await callClaude(prompt);
  const jsonStr = text.replace(/```json|```/g, '').trim();
  const match = jsonStr.match(/\{[\s\S]*\}/);
  if (!match) throw new Error('No JSON in response: ' + text.slice(0, 100));
  const parsed = JSON.parse(match[0]);

  // Ensure correct answer is always present
  let choix = parsed.choix || [];
  if (!choix.includes(answer)) choix = [answer, ...choix.slice(0, 3)];
  if (choix.length < 4) throw new Error(`Not enough choices: ${JSON.stringify(choix)}`);
  return choix.slice(0, 4);
}

// ─── Fetch all rows without choices (paginated) ───────────────────────
async function fetchRowsWithoutChoices() {
  console.log('\n📥 Fetching questions from Supabase...');
  const PAGE = 1000;
  let all = [];
  let from = 0;

  while (true) {
    const { data, error } = await supabase
      .from('questions_cache')
      .select('id, contenu, categorie, sous_categorie')
      .range(from, from + PAGE - 1);

    if (error) { console.error('Supabase fetch error:', error.message); break; }
    if (!data || data.length === 0) break;

    // Filter: keep only rows where contenu.choices is missing or incomplete
    const missing = data.filter((row) => {
      const c = row.contenu;
      if (!c || typeof c !== 'object') return false; // skip malformed rows
      return !Array.isArray(c.choices) || c.choices.length < 4;
    });

    all.push(...missing);
    console.log(`   fetched ${from + data.length} rows total, ${all.length} need choices so far...`);
    if (data.length < PAGE) break;
    from += PAGE;
  }

  return all;
}

// ─── Sleep helper ─────────────────────────────────────────────────────
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// ─── Main ─────────────────────────────────────────────────────────────
async function main() {
  console.log('🚀 Memorix — Seed MCQ Choices');
  console.log(`   Model: ${MODEL} | Batch: ${BATCH} | Delay: ${DELAY_MS}ms`);

  const rows = await fetchRowsWithoutChoices();
  const total = rows.length;

  if (total === 0) {
    console.log('\n✅ All questions already have choices — nothing to do.');
    return;
  }

  console.log(`\n📊 ${total} questions need choices\n`);

  let updated = 0;
  let errors  = 0;

  for (let i = 0; i < rows.length; i += BATCH) {
    const batch = rows.slice(i, i + BATCH);

    await Promise.all(batch.map(async (row, bi) => {
      const idx    = i + bi + 1;
      const c      = row.contenu;
      const q      = c?.text || c?.question || '';
      const answer = c?.answer || c?.reponse_correcte || '';

      if (!q || !answer) {
        console.log(`   [${idx}/${total}] ⚠️ Skipping — missing text or answer (id: ${row.id})`);
        errors++;
        return;
      }

      try {
        process.stdout.write(
          `   [${idx}/${total}] ${row.categorie} · ${row.sous_categorie} — "${q.slice(0, 50)}"... `
        );

        const choix = await generateChoices(q, answer, row.categorie, row.sous_categorie);

        // Update contenu with choices merged in
        const newContenu = { ...c, choices: choix };
        const { error: updateError } = await supabase
          .from('questions_cache')
          .update({ contenu: newContenu })
          .eq('id', row.id);

        if (updateError) throw new Error(updateError.message);

        updated++;
        console.log(`✅ ${JSON.stringify(choix)}`);
      } catch (err) {
        errors++;
        console.log(`❌ ${err.message}`);
      }
    }));

    // Wait between batches (skip wait after last batch)
    if (i + BATCH < rows.length) {
      await sleep(DELAY_MS);
    }
  }

  console.log(`\n${'─'.repeat(60)}`);
  console.log(`✅ Total mis à jour : ${updated} questions`);
  if (errors > 0) console.log(`⚠️  Erreurs / skippées : ${errors} questions`);
  console.log(`${'─'.repeat(60)}\n`);
}

main().catch((err) => {
  console.error('Fatal error:', err);
  process.exit(1);
});
