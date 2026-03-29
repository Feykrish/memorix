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

// ─── Servir le frontend React buildé ─────────────────────────────────
app.use(express.static(join(__dirname, 'dist')));

// Toutes les routes non-API → index.html (SPA routing)
app.get('*', (req, res) => {
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
