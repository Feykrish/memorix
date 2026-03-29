/**
 * Memorix — Seed Script
 * Pre-fills Supabase questions_cache with ~100 questions per category/subcategory.
 * Run once: npm run seed
 */

import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, resolve } from 'path';
import { createClient } from '@supabase/supabase-js';

const __dirname = dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: resolve(__dirname, '..', '.env'), override: true });

const ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY;
const SUPABASE_URL = process.env.VITE_SUPABASE_URL;
const SUPABASE_KEY = process.env.VITE_SUPABASE_ANON_KEY;

if (!ANTHROPIC_API_KEY) { console.error('Missing ANTHROPIC_API_KEY in .env'); process.exit(1); }
if (!SUPABASE_URL || !SUPABASE_KEY) { console.error('Missing SUPABASE_URL or SUPABASE_KEY in .env'); process.exit(1); }

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

// ─── Categories to seed ──────────────────────────────────────────────

const CATEGORIES = {
  history: ['antiquity', 'middle-ages', 'revolutions', 'world-wars', 'modern-history', 'civilizations', 'great-figures'],
  sciences: ['physics', 'chemistry', 'biology', 'astronomy', 'mathematics', 'medicine', 'discoveries'],
  geography: ['capitals', 'rivers-mountains', 'countries-borders', 'world-cultures', 'oceans-seas', 'famous-cities'],
  'arts-culture': ['painting', 'classical-music', 'cinema', 'literature', 'architecture', 'sculpture', 'modern-music'],
  philosophy: ['greek-philosophy', 'modern-philosophy', 'ethics', 'metaphysics', 'eastern-philosophy', 'great-thinkers'],
  nature: ['wild-animals', 'oceans-marine', 'plants-trees', 'ecosystems', 'natural-phenomena', 'environment', 'insects'],
  mythology: ['greek-mythology', 'roman-mythology', 'norse-mythology', 'egyptian-mythology', 'celtic-mythology', 'heroes-legends'],
  technology: ['historical-inventions', 'computing', 'artificial-intelligence', 'internet-web', 'space-aerospace', 'energy'],
  islam: ['pillars-quran', 'sunni-history', 'sunni-jurisprudence', 'prophet-companions', 'sunni-great-figures'],
  christianity: ['bible', 'church-history', 'christian-holidays', 'biblical-figures', 'christian-movements'],
  judaism: ['torah', 'jewish-holidays', 'jewish-history', 'biblical-figures-judaism', 'jewish-traditions'],
};

const VOCAB_CATEGORIES = {
  'fr': ['rare-words', 'formal-register', 'expressions', 'etymology'],
  'en': ['rare-words', 'expressions', 'etymology'],
  'es': ['rare-words', 'expressions'],
  'de': ['rare-words', 'expressions'],
  'tr': ['rare-words', 'expressions'],
};

// Human-readable labels for prompts
const CAT_LABELS = {
  history: 'Histoire', sciences: 'Sciences', geography: 'Géographie',
  'arts-culture': 'Arts et culture', philosophy: 'Philosophie', nature: 'Nature',
  mythology: 'Mythologie', technology: 'Technologie',
  islam: 'Islam', christianity: 'Christianisme', judaism: 'Judaïsme',
};

const SUB_LABELS = {
  antiquity: 'Antiquité', 'middle-ages': 'Moyen Âge', revolutions: 'Révolutions',
  'world-wars': 'Guerres mondiales', 'modern-history': 'Histoire moderne',
  civilizations: 'Civilisations', 'great-figures': 'Grandes figures',
  physics: 'Physique', chemistry: 'Chimie', biology: 'Biologie',
  astronomy: 'Astronomie', mathematics: 'Mathématiques', medicine: 'Médecine', discoveries: 'Découvertes',
  capitals: 'Capitales', 'rivers-mountains': 'Fleuves et montagnes',
  'countries-borders': 'Pays et frontières', 'world-cultures': 'Cultures du monde',
  'oceans-seas': 'Océans et mers', 'famous-cities': 'Villes célèbres',
  painting: 'Peinture', 'classical-music': 'Musique classique', cinema: 'Cinéma',
  literature: 'Littérature', architecture: 'Architecture', sculpture: 'Sculpture', 'modern-music': 'Musique moderne',
  'greek-philosophy': 'Philosophie grecque', 'modern-philosophy': 'Philosophie moderne',
  ethics: 'Éthique', metaphysics: 'Métaphysique', 'eastern-philosophy': 'Philosophie orientale',
  'great-thinkers': 'Grands penseurs',
  'wild-animals': 'Animaux sauvages', 'oceans-marine': 'Océans et vie marine',
  'plants-trees': 'Plantes et arbres', ecosystems: 'Écosystèmes',
  'natural-phenomena': 'Phénomènes naturels', environment: 'Environnement', insects: 'Insectes',
  'greek-mythology': 'Mythologie grecque', 'roman-mythology': 'Mythologie romaine',
  'norse-mythology': 'Mythologie nordique', 'egyptian-mythology': 'Mythologie égyptienne',
  'celtic-mythology': 'Mythologie celtique', 'heroes-legends': 'Héros et légendes',
  'historical-inventions': 'Inventions historiques', computing: 'Informatique',
  'artificial-intelligence': 'Intelligence artificielle', 'internet-web': 'Internet et web',
  'space-aerospace': 'Spatial et aérospatial', energy: 'Énergie',
  'pillars-quran': 'Piliers et Coran', 'sunni-history': 'Histoire sunnite',
  'sunni-jurisprudence': 'Jurisprudence sunnite', 'prophet-companions': 'Compagnons du Prophète',
  'sunni-great-figures': 'Grandes figures islam sunnite',
  bible: 'Bible', 'church-history': "Histoire de l'Église",
  'christian-holidays': 'Fêtes chrétiennes', 'biblical-figures': 'Figures bibliques',
  'christian-movements': 'Courants chrétiens',
  torah: 'Torah', 'jewish-holidays': 'Fêtes juives', 'jewish-history': 'Histoire juive',
  'biblical-figures-judaism': 'Figures bibliques', 'jewish-traditions': 'Traditions juives',
};

const LANG_LABELS = { fr: 'Français', en: 'Anglais', es: 'Espagnol', de: 'Allemand', tr: 'Turc' };
const VOCAB_TYPE_LABELS = {
  'rare-words': 'Mots rares', 'formal-register': 'Registre soutenu',
  expressions: 'Expressions et idiomes', etymology: 'Étymologie',
};

const LEVELS = ['débutant', 'intermédiaire', 'expert'];

// ─── Claude API call ─────────────────────────────────────────────────

const SYSTEM_PROMPT = `Tu es le moteur de questions de Memorix. Génère des questions culturelles précises, variées et engageantes. Chaque question doit être unique et différente des autres. Niveau débutant = grand public. Intermédiaire = détails importants. Expert = très précis et nuancé. Pour Islam : UNIQUEMENT islam sunnite. Réponds UNIQUEMENT en JSON valide, sans markdown.`;

const VOCAB_SYSTEM_PROMPT = `Tu es le moteur de vocabulaire de Memorix. Génère des fiches de mots rares ou méconnus. Chaque mot doit être unique. Réponds UNIQUEMENT en JSON valide, sans markdown.`;

async function callClaude(systemPrompt, userPrompt, retries = 1) {
  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      const res = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': ANTHROPIC_API_KEY,
          'anthropic-version': '2023-06-01',
        },
        body: JSON.stringify({
          model: 'claude-sonnet-4-20250514',
          max_tokens: 4096,
          system: systemPrompt,
          messages: [{ role: 'user', content: userPrompt }],
        }),
      });

      if (!res.ok) {
        const err = await res.text();
        throw new Error(`API ${res.status}: ${err.slice(0, 200)}`);
      }

      const data = await res.json();
      const text = data.content?.[0]?.text || '';
      // Extract JSON from response (handle potential markdown wrapping)
      const jsonMatch = text.match(/\{[\s\S]*\}/);
      if (!jsonMatch) throw new Error('No JSON found in response');
      return JSON.parse(jsonMatch[0]);
    } catch (err) {
      if (attempt < retries) {
        console.log(`  ⚠️  Retry (${err.message.slice(0, 60)})`);
        await sleep(3000);
      } else {
        throw err;
      }
    }
  }
}

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

// ─── Generate & save questions ───────────────────────────────────────

async function generateQuestionBatch(catKey, subKey, level, batchNum) {
  const catLabel = CAT_LABELS[catKey] || catKey;
  const subLabel = SUB_LABELS[subKey] || subKey;

  const islamRestriction = ['islam'].includes(catKey)
    ? '\nIMPORTANT : Génère UNIQUEMENT des questions sur l\'islam sunnite. Aucune question chiite.'
    : '';

  const userPrompt = `Génère exactement 10 questions sur ${catLabel} · ${subLabel}. Niveau : ${level}. Batch ${batchNum}/3 — assure-toi que chaque question est unique et différente.${islamRestriction}

Réponds avec ce JSON :
{
  "questions": [
    {
      "id": "string unique",
      "question": "texte de la question",
      "reponse_correcte": "réponse",
      "mots_cles": ["mot1", "mot2"],
      "anecdote": "fait intéressant lié",
      "indice": "un indice",
      "difficulte": "${level}"
    }
  ]
}`;

  const result = await callClaude(SYSTEM_PROMPT, userPrompt);
  return result.questions || [];
}

async function generateVocabBatch(lang, type, batchNum) {
  const langLabel = LANG_LABELS[lang];
  const typeLabel = VOCAB_TYPE_LABELS[type];

  const userPrompt = `Génère exactement 10 fiches de vocabulaire en ${langLabel}, type "${typeLabel}". Batch ${batchNum}/3 — chaque mot doit être unique.

Réponds avec ce JSON :
{
  "mots": [
    {
      "id": "string unique",
      "mot": "le mot",
      "phonetique": "transcription phonétique",
      "nature": "nom/verbe/adjectif/etc",
      "definition": "définition claire",
      "exemple": "phrase d'exemple",
      "etymologie": "origine du mot",
      "synonymes": ["syn1", "syn2"],
      "mot_test": "un autre mot du même registre",
      "definition_mot_test": "définition du mot_test",
      "mots_cles_mot_test": ["clé1", "clé2"]
    }
  ]
}`;

  const result = await callClaude(VOCAB_SYSTEM_PROMPT, userPrompt);
  return result.mots || [];
}

async function saveToDB(categorie, sous_categorie, niveau, langue, questions) {
  const rows = questions.map((q, i) => ({
    id: `${categorie}::${sous_categorie}::${niveau}::${langue}::${Date.now()}-${i}-${Math.random().toString(36).slice(2, 8)}`,
    categorie,
    sous_categorie,
    niveau,
    langue,
    contenu: q,
    utilisation_count: 0,
  }));

  const { error } = await supabase.from('questions_cache').upsert(rows, { onConflict: 'id' });
  if (error) console.error(`  ❌ Supabase error: ${error.message}`);
  return !error;
}

// ─── Main ────────────────────────────────────────────────────────────

async function main() {
  console.log('\n╔══════════════════════════════════════════════╗');
  console.log('║     MEMORIX — Seed Script                    ║');
  console.log('║     Pre-filling questions_cache               ║');
  console.log('╚══════════════════════════════════════════════╝\n');

  let totalGenerated = 0;
  let totalFailed = 0;

  // ─── Regular categories ──────────────────────────────────────────
  const catEntries = Object.entries(CATEGORIES);
  for (let ci = 0; ci < catEntries.length; ci++) {
    const [catKey, subs] = catEntries[ci];
    const catLabel = CAT_LABELS[catKey] || catKey;

    console.log(`\n━━━ ${catLabel} (${ci + 1}/${catEntries.length}) ━━━`);

    for (let si = 0; si < subs.length; si++) {
      const subKey = subs[si];
      const subLabel = SUB_LABELS[subKey] || subKey;

      for (let li = 0; li < LEVELS.length; li++) {
        const level = LEVELS[li];
        const progress = `${catLabel} · ${subLabel} · ${level}`;
        process.stdout.write(`  ${progress}... `);

        try {
          const questions = await generateQuestionBatch(catKey, subKey, level, li + 1);
          if (questions.length > 0) {
            const ok = await saveToDB(catKey, subKey, level, 'fr', questions);
            totalGenerated += questions.length;
            console.log(`✅ ${questions.length} questions${ok ? '' : ' (DB error)'}`);
          } else {
            console.log('⚠️  0 questions returned');
            totalFailed++;
          }
        } catch (err) {
          console.log(`❌ ${err.message.slice(0, 60)}`);
          totalFailed++;
        }

        // Rate limiting: 1s between batches
        await sleep(1000);
      }
    }
  }

  // ─── Vocabulary categories ───────────────────────────────────────
  console.log('\n━━━ Vocabulaire ━━━');
  const vocabEntries = Object.entries(VOCAB_CATEGORIES);
  for (const [lang, types] of vocabEntries) {
    const langLabel = LANG_LABELS[lang];
    for (const type of types) {
      const typeLabel = VOCAB_TYPE_LABELS[type];

      for (let li = 0; li < LEVELS.length; li++) {
        const level = LEVELS[li];
        process.stdout.write(`  ${langLabel} · ${typeLabel} · ${level}... `);

        try {
          const words = await generateVocabBatch(lang, type, li + 1);
          if (words.length > 0) {
            // Save vocab as questions_cache too
            const ok = await saveToDB(`vocabulary_${lang}`, type, level, lang, words);
            totalGenerated += words.length;
            console.log(`✅ ${words.length} mots${ok ? '' : ' (DB error)'}`);
          } else {
            console.log('⚠️  0 mots returned');
            totalFailed++;
          }
        } catch (err) {
          console.log(`❌ ${err.message.slice(0, 60)}`);
          totalFailed++;
        }

        await sleep(1000);
      }
    }
  }

  // ─── Summary ─────────────────────────────────────────────────────
  console.log('\n╔══════════════════════════════════════════════╗');
  console.log(`║  Total généré : ${String(totalGenerated).padStart(5)} questions/mots        ║`);
  console.log(`║  Échecs       : ${String(totalFailed).padStart(5)} batches                ║`);
  console.log('╚══════════════════════════════════════════════╝\n');
}

main().catch((err) => {
  console.error('\n💥 Fatal error:', err);
  process.exit(1);
});
