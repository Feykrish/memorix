import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import express from 'express';
import cors from 'cors';

// ─── Load .env ───────────────────────────────────────────────────────
const __dirname = dirname(fileURLToPath(import.meta.url));
const envPath = join(__dirname, '.env');
console.log('📂 Loading .env from:', envPath);

try {
  const envContent = readFileSync(envPath, 'utf8');
  for (const line of envContent.split('\n')) {
    const match = line.match(/^([^#=]+)=(.*)$/);
    if (match) {
      const key = match[1].trim();
      const val = match[2].trim();
      process.env[key] = val;
      console.log(`   ✅ ${key} = ${val.slice(0, 15)}...`);
    }
  }
} catch (err) {
  console.error('❌ Failed to load .env:', err.message);
}

// ─── Config ──────────────────────────────────────────────────────────
const API_KEY = process.env.ANTHROPIC_API_KEY;
const PORT = process.env.PORT || 3001;
const API_URL = 'https://api.anthropic.com/v1/messages';
const MODEL = 'claude-sonnet-4-20250514';

console.log('');
console.log('Clé API présente :', !!API_KEY);
if (API_KEY) {
  console.log('Clé API (début)  :', API_KEY.slice(0, 20) + '...');
} else {
  console.error('❌ ANTHROPIC_API_KEY is not set in .env — server will NOT work');
}

// ─── Express app ─────────────────────────────────────────────────────
const app = express();

app.use(cors());
app.use(express.json({ limit: '1mb' }));

// ─── GET /test — quick diagnostic ───────────────────────────────────
app.get('/test', (req, res) => {
  res.json({
    status: 'ok',
    apiKey: !!API_KEY,
    apiKeyPreview: API_KEY ? `${API_KEY.slice(0, 12)}...${API_KEY.slice(-4)}` : null,
    model: MODEL,
    timestamp: new Date().toISOString(),
  });
});

// ─── GET /health ─────────────────────────────────────────────────────
app.get('/health', (req, res) => {
  res.json({ status: 'ok', hasKey: !!API_KEY });
});

// ─── POST /api/claude — main proxy route ─────────────────────────────
app.post('/api/claude', async (req, res) => {
  console.log('\n📨 POST /api/claude');
  console.log('   Body keys:', Object.keys(req.body));

  const { system, userMessage, maxTokens } = req.body;

  if (!system || !userMessage) {
    console.error('   ❌ Missing system or userMessage');
    return res.status(400).json({ error: 'Missing system or userMessage' });
  }

  if (!API_KEY) {
    console.error('   ❌ No API key configured');
    return res.status(500).json({ error: 'Server has no API key configured' });
  }

  console.log('   System prompt:', system.slice(0, 80) + '...');
  console.log('   User message:', userMessage.slice(0, 80) + '...');
  console.log('   Calling Claude API...');

  try {
    const payload = {
      model: MODEL,
      max_tokens: maxTokens || 4096,
      system,
      messages: [{ role: 'user', content: userMessage }],
    };

    const response = await fetch(API_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': API_KEY,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify(payload),
    });

    console.log('   Response status:', response.status);

    if (!response.ok) {
      const errText = await response.text().catch(() => '');
      console.error('   ❌ Erreur API:', errText);
      return res.status(response.status).json({
        error: `Claude API error ${response.status}`,
        details: errText,
      });
    }

    const data = await response.json();
    const textLen = data.content?.[0]?.text?.length || 0;
    console.log('   ✅ Success — response length:', textLen, 'chars');
    res.json(data);
  } catch (err) {
    console.error('   ❌ Erreur API:', err.message);
    res.status(500).json({ error: 'Proxy server error', details: err.message });
  }
});

// ─── POST /api/translate — batch question translator ─────────────────
app.post('/api/translate', async (req, res) => {
  console.log('\n📨 POST /api/translate');
  const { questions, langueCible } = req.body;

  if (!questions?.length || !langueCible) {
    return res.status(400).json({ error: 'Missing questions or langueCible' });
  }
  if (!API_KEY) return res.status(500).json({ error: 'No API key' });

  const LANG_NAMES = { en: 'anglais', es: 'espagnol', de: 'allemand', tr: 'turc' };
  const nomLangue = LANG_NAMES[langueCible] || langueCible;

  const prompt = `Traduis ces ${questions.length} question(s) de quiz du français en ${nomLangue}.

${questions.map((q, i) => `--- Q${i + 1} ---
Question : "${q.text}"
Bonne réponse : "${q.answer}"
Choix : ${JSON.stringify(q.choices || [])}
Anecdote : "${q.anecdote || ''}"
Indice : "${q.hint || ''}"`).join('\n\n')}

RÈGLES DE TRADUCTION :
- Traduis naturellement, pas mot à mot
- Garde les noms propres, dates et chiffres IDENTIQUES (ex: "Muhammad", "1453", "La Mecque")
- Les mauvaises réponses doivent rester du même TYPE que la bonne réponse
- Conserve l'ordre des choix tel quel

Réponds UNIQUEMENT avec ce JSON valide (sans markdown) :
{
  "translated": [
    {
      "text": "question traduite",
      "answer": "bonne réponse traduite",
      "choices": ["choix1 traduit", "choix2 traduit", "choix3 traduit", "choix4 traduit"],
      "anecdote": "anecdote traduite",
      "hint": "indice traduit"
    }
  ]
}`;

  try {
    const response = await fetch(API_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-api-key': API_KEY, 'anthropic-version': '2023-06-01' },
      body: JSON.stringify({ model: MODEL, max_tokens: 1500, messages: [{ role: 'user', content: prompt }] }),
    });
    if (!response.ok) {
      const errText = await response.text().catch(() => '');
      return res.status(response.status).json({ error: `Claude API error ${response.status}`, details: errText });
    }
    const data = await response.json();
    const text = data.content?.[0]?.text || '';
    const jsonStr = text.replace(/```json|```/g, '').trim();
    const match = jsonStr.match(/\{[\s\S]*\}/);
    const result = JSON.parse(match?.[0] || jsonStr);
    console.log(`   ✅ Translated ${result.translated?.length || 0} questions → ${nomLangue}`);
    res.json(result);
  } catch (err) {
    console.error('   ❌ translate error:', err.message);
    res.status(500).json({ error: 'Translation failed', details: err.message });
  }
});

// ─── POST /api/generate-choices — dedicated MCQ choice generator ─────
app.post('/api/generate-choices', async (req, res) => {
  console.log('\n📨 POST /api/generate-choices');
  const { question, reponse_correcte, categorie } = req.body;

  if (!question || !reponse_correcte) {
    return res.status(400).json({ error: 'Missing question or reponse_correcte' });
  }
  if (!API_KEY) {
    return res.status(500).json({ error: 'Server has no API key configured' });
  }

  const prompt = `Pour cette question de ${categorie || 'culture générale'} : "${question}"
La bonne réponse est : "${reponse_correcte}"

Génère EXACTEMENT 3 mauvaises réponses pour un QCM. Ces réponses doivent :
- Être du même TYPE que la bonne réponse (si c'est un chiffre, proposer d'autres chiffres plausibles ; si c'est un nom propre, proposer d'autres noms propres)
- Ne PAS contenir de mots significatifs de la question
- Ne PAS être des variantes orthographiques ou translittérations de "${reponse_correcte}"
- Être des concepts complètement différents, plausibles mais clairement faux pour quelqu'un qui connaît le sujet

Réponds UNIQUEMENT avec ce JSON : { "mauvaises_reponses": ["réponse1", "réponse2", "réponse3"] }`;

  try {
    const response = await fetch(API_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': API_KEY,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: MODEL,
        max_tokens: 200,
        messages: [{ role: 'user', content: prompt }],
      }),
    });

    if (!response.ok) {
      const errText = await response.text().catch(() => '');
      return res.status(response.status).json({ error: `Claude API error ${response.status}`, details: errText });
    }

    const data = await response.json();
    const text = data.content?.[0]?.text || '';
    const jsonStr = text.replace(/```json|```/g, '').trim();
    const result = JSON.parse(jsonStr.match(/\{[\s\S]*\}/)?.[0] || jsonStr);

    console.log('   ✅ Choix générés:', result.mauvaises_reponses);
    res.json(result);
  } catch (err) {
    console.error('   ❌ generate-choices error:', err.message);
    res.status(500).json({ error: 'Failed to generate choices', details: err.message });
  }
});

// ─── Servir le frontend React buildé ─────────────────────────────────
app.use(express.static(join(__dirname, 'dist')));

// Toutes les routes non-API → index.html (SPA routing)
app.get(/.*/, (req, res) => {
  res.sendFile(join(__dirname, 'dist', 'index.html'));
});

// ─── Start ───────────────────────────────────────────────────────────
app.listen(PORT, () => {
  console.log('');
  console.log(`Serveur démarré sur port ${PORT}`);
  console.log(`  → Test:   http://localhost:${PORT}/test`);
  console.log(`  → Health: http://localhost:${PORT}/health`);
  console.log(`  → API:    POST http://localhost:${PORT}/api/claude`);
  console.log('');
});
