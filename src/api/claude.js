import { getCachedQuestions, saveToCache, getPrefetched } from '../lib/questionsCache';

const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:3001';

async function callClaude(system, userMessage) {
  const res = await fetch(`${API_BASE}/api/claude`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ system, userMessage }),
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.details || err.error || `Server error ${res.status}`);
  }

  const data = await res.json();
  const text = data.content?.[0]?.text || '';

  // Extract JSON from response (handle markdown code blocks)
  const jsonMatch = text.match(/```(?:json)?\s*([\s\S]*?)```/) || [null, text];
  const jsonStr = jsonMatch[1].trim();

  try {
    return JSON.parse(jsonStr);
  } catch {
    const objMatch = jsonStr.match(/\{[\s\S]*\}/);
    if (objMatch) return JSON.parse(objMatch[0]);
    throw new Error('Failed to parse Claude response as JSON');
  }
}

// ─── 1. Generate Questions ───────────────────────────────────────────

const SYSTEM_QUESTIONS = `Tu es le moteur de questions de Memorix, une app de mémorisation.
Tu génères des questions culturelles précises et engageantes.
Niveau facile = faits connus du grand public.
Niveau moyen = détails importants que les curieux connaissent.
Niveau difficile = questions précises et nuancées pour les experts.
Niveau auto = mélange équilibré des trois niveaux.
Pour la catégorie Monothéismes : sois factuel, neutre et respectueux.
IMPORTANT pour l'Islam : tu génères UNIQUEMENT des questions sur l'islam sunnite. Ne génère aucune question sur les chiites, l'islam chiite, les différences sunnites/chiites, ou toute autre branche de l'islam. Concentre-toi exclusivement sur les piliers, le Coran, le Prophète Muhammad, les compagnons, l'histoire sunnite, la jurisprudence sunnite (fiqh), et les grandes figures de l'islam sunnite.
Réponds UNIQUEMENT en JSON valide, sans texte supplémentaire.`;

export async function generateQuestions(category, subCategory, difficulty, count, alreadyAsked = [], langue = 'fr') {
  console.log(`🔍 generateQuestions: ${category} · ${subCategory}, difficulty=${difficulty}, count=${count}, alreadyAsked=${alreadyAsked.length}`);

  // 1. Vérifier d'abord le prefetch (résultat déjà chargé depuis SessionConfig)
  const prefetched = getPrefetched(category, subCategory, difficulty, langue);
  let cached = null;
  if (prefetched instanceof Promise) {
    console.log('⚡ Prefetch en cours — attente du résultat...');
    cached = await prefetched;
  } else if (prefetched !== undefined) {
    cached = prefetched;
  }

  // 2. Si pas de prefetch, requête directe
  if (cached === null || cached === undefined) {
    cached = await getCachedQuestions(category, subCategory, difficulty, langue, count * 2);
  }

  // Normalize: handle flat array or {questions:[...]} wrapper
  const cachedArr = Array.isArray(cached)
    ? cached
    : cached?.questions && Array.isArray(cached.questions)
    ? cached.questions
    : null;

  console.log(`📦 Questions disponibles après filtre: ${cachedArr?.length ?? 0}`);

  if (cachedArr && cachedArr.length > 0) {
    const filtered = cachedArr.filter(
      (q) => !alreadyAsked.includes(q.id) && !alreadyAsked.includes(q.text)
    );
    console.log(`Cache utilisé : oui — ${cachedArr.length} total, ${filtered.length} après filtrage`);
    if (filtered.length >= count) {
      return filtered.slice(0, count);
    }
    console.log(`⚠️ Cache insuffisant après filtrage (${filtered.length} < ${count}) — appel API`);
  } else {
    console.log('Cache utilisé : non — appel API Claude');
  }

  // 3. Call Claude API with full history to avoid repeats
  console.log(`🤖 Calling Claude API — ${alreadyAsked.length} questions to avoid`);

  // Only send last 50 questions to avoid exceeding token limits
  const recentHistory = alreadyAsked.slice(-50);
  const avoidBlock = recentHistory.length > 0
    ? `\n\nIMPORTANT — Tu NE DOIS PAS générer ces questions déjà posées à cet utilisateur. Génère des questions complètement différentes sur d'autres aspects du sujet :\n${recentHistory.map((q, i) => `${i + 1}. "${q}"`).join('\n')}`
    : '';

  const user = `Génère exactement ${count} questions sur "${category}" · "${subCategory}".
Niveau : ${difficulty}.${avoidBlock}

Réponds avec ce JSON exactement :
{
  "questions": [
    {
      "id": 1,
      "question": "texte de la question",
      "reponse_correcte": "la réponse attendue",
      "mots_cles": ["mot1", "mot2", "mot3"],
      "anecdote": "fait intéressant lié à la réponse (2-3 phrases)",
      "indice": "un indice court sans donner la réponse",
      "difficulte": "facile|moyen|difficile"
    }
  ]
}`;

  const data = await callClaude(SYSTEM_QUESTIONS, user);
  const questions = (data.questions || []).map((q, i) => ({
    id: q.id || i + 1,
    text: q.question,
    answer: q.reponse_correcte,
    keywords: q.mots_cles || [],
    anecdote: q.anecdote || '',
    hint: q.indice || '',
    difficulty: q.difficulte || difficulty,
    isReview: false,
  }));

  console.log(`✅ Generated ${questions.length} questions:`, questions.map((q) => q.text.slice(0, 50)));

  // 3. Save to cache (non-blocking)
  saveToCache(questions, category, subCategory, difficulty, langue).catch(() => {});

  return questions;
}

// ─── 2. Evaluate Answer ──────────────────────────────────────────────

const SYSTEM_EVALUATE = `Tu es un correcteur bienveillant de Memorix.
Évalue la réponse de l'utilisateur :
- correct = les éléments essentiels sont présents, même formulés avec ses propres mots.
- partiel = partiellement juste, il manque des éléments importants.
- incorrect = faux, hors sujet ou vide.
Sois indulgent sur l'orthographe et la formulation exacte.
Réponds UNIQUEMENT en JSON valide, sans texte supplémentaire.`;

export async function evaluateAnswer(question, correctAnswer, keywords, userAnswer) {
  const user = `Question : "${question}"
Bonne réponse : "${correctAnswer}"
Mots-clés importants : ${JSON.stringify(keywords)}
Réponse de l'utilisateur : "${userAnswer}"

Réponds avec ce JSON exactement :
{
  "resultat": "correct|partiel|incorrect",
  "score": 1,
  "message": "message court d'encouragement ou de correction",
  "correction": "explication courte de la bonne réponse",
  "ce_qui_manquait": "ce qui manquait dans la réponse, ou null si correct"
}

Pour le score : correct = 1, partiel = 1, incorrect = 0.`;

  const data = await callClaude(SYSTEM_EVALUATE, user);
  return {
    result: data.resultat || 'incorrect',
    score: data.score ?? (data.resultat === 'incorrect' ? 0 : 1),
    isCorrect: (data.resultat || 'incorrect') !== 'incorrect',
    message: data.message || '',
    correction: data.correction || correctAnswer,
    missing: data.ce_qui_manquait || null,
  };
}

// ─── 3. Generate Vocabulary ──────────────────────────────────────────

const SYSTEM_VOCABULARY = `Tu es le moteur de vocabulaire de Memorix.
Génère des fiches de mots rares, soutenus ou méconnus.
Chaque mot doit être réellement peu connu et intéressant à apprendre.
Le mot_test doit être un mot différent mais du même registre/thème.
Réponds UNIQUEMENT en JSON valide, sans texte supplémentaire.`;

export async function generateVocabulaire(langue, type, difficulty, alreadyProposed = [], count = 5) {
  const avoid = alreadyProposed.length > 0
    ? `\nÉvite ces mots déjà proposés : ${JSON.stringify(alreadyProposed)}`
    : '';

  const user = `Génère exactement ${count} fiches de vocabulaire en ${langue}, type "${type}", niveau ${difficulty}.${avoid}

Réponds avec ce JSON exactement :
{
  "mots": [
    {
      "id": 1,
      "mot": "le mot",
      "phonetique": "/fɔ.ne.tik/",
      "nature": "Nom féminin|Adjectif|Verbe|etc.",
      "definition": "définition claire et concise",
      "exemple": "phrase d'exemple utilisant le mot",
      "etymologie": "origine du mot",
      "synonymes": ["syn1", "syn2"],
      "mot_test": "un autre mot rare du même registre",
      "definition_mot_test": "définition du mot test",
      "mots_cles_mot_test": ["mot1", "mot2"]
    }
  ]
}`;

  const data = await callClaude(SYSTEM_VOCABULARY, user);
  return (data.mots || []).map((m, i) => ({
    id: m.id || i + 1,
    word: m.mot,
    phonetic: m.phonetique || '',
    grammar: m.nature || '',
    definition: m.definition || '',
    example: m.exemple || '',
    etymology: m.etymologie || '',
    synonyms: m.synonymes || [],
    testWord: m.mot_test || '',
    testDefinition: m.definition_mot_test || '',
    testKeywords: m.mots_cles_mot_test || [],
  }));
}

// ─── 4. Generate FreeLearn Questions ─────────────────────────────────

export async function generateFreeLearnQuestions(topic, level, aspect, count, alreadyAsked = []) {
  const system = `Tu es le moteur de questions personnalisé de Memorix.
L'utilisateur veut apprendre sur : ${topic}.
Niveau : ${level}.
Aspect privilégié : ${aspect}.
Génère des questions précises, progressives et engageantes sur exactement ce sujet.
Les questions doivent aller du plus simple au plus complexe.
Chaque question doit apporter une vraie connaissance nouvelle et mémorable.
Réponds UNIQUEMENT en JSON valide, sans texte supplémentaire.`;

  const avoid = alreadyAsked.length > 0
    ? `\n\nÉvite ces questions déjà posées : ${JSON.stringify(alreadyAsked.slice(-40))}`
    : '';

  const user = `Génère exactement ${count} questions sur "${topic}" pour un niveau "${level}" en te concentrant sur "${aspect}".${avoid}

Réponds avec ce JSON exactement :
{
  "questions": [
    {
      "id": 1,
      "question": "texte de la question",
      "reponse_correcte": "la réponse attendue",
      "mots_cles": ["mot1", "mot2", "mot3"],
      "anecdote": "fait intéressant lié à la réponse (2-3 phrases)",
      "indice": "un indice court sans donner la réponse",
      "difficulte": "facile|moyen|difficile"
    }
  ]
}`;

  const data = await callClaude(system, user);
  return (data.questions || []).map((q, i) => ({
    id: q.id || i + 1,
    text: q.question,
    answer: q.reponse_correcte,
    keywords: q.mots_cles || [],
    anecdote: q.anecdote || '',
    hint: q.indice || '',
    difficulty: q.difficulte || 'moyen',
    isReview: false,
  }));
}

// ─── 5. Generate Harder Questions ────────────────────────────────────

export async function generateHarderQuestions(category, subCategory, previousQuestions = [], fullHistory = []) {
  const avoid = [...new Set([...fullHistory, ...previousQuestions.map((q) => q.text || q.question || q)])];

  const user = `L'utilisateur a répondu correctement à TOUTES les questions précédentes sur "${category}" · "${subCategory}".
Génère exactement 3 questions PLUS DIFFICILES sur le même sujet.
Niveau : difficile (questions pointues, détails précis, pièges subtils).

Évite ces questions déjà posées : ${JSON.stringify(avoid)}

Réponds avec ce JSON exactement :
{
  "questions": [
    {
      "id": 1,
      "question": "texte de la question",
      "reponse_correcte": "la réponse attendue",
      "mots_cles": ["mot1", "mot2", "mot3"],
      "anecdote": "fait intéressant lié à la réponse (2-3 phrases)",
      "indice": "un indice court sans donner la réponse",
      "difficulte": "difficile"
    }
  ]
}`;

  const data = await callClaude(SYSTEM_QUESTIONS, user);
  return (data.questions || []).map((q, i) => ({
    id: q.id || i + 1,
    text: q.question,
    answer: q.reponse_correcte,
    keywords: q.mots_cles || [],
    anecdote: q.anecdote || '',
    hint: q.indice || '',
    difficulty: q.difficulte || 'difficile',
    isReview: false,
  }));
}
