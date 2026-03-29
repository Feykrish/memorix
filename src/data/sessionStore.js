import { getSimulatedToday } from './reviewStore';
import { syncSession, deleteRemoteSession } from '../lib/supabaseSync';
import { clearHistory } from './questionHistory';

const STORAGE_KEY = 'memorix-sessions';
const ERRORS_KEY = 'memorix-daily-errors';

function getStore() {
  try { return JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]'); }
  catch { return []; }
}

function saveStore(sessions) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(sessions));
}

function today() {
  return getSimulatedToday();
}

export function getSessions() {
  return getStore();
}

// Crée une session "Apprenons ensemble" pré-configurée avec topic/level/aspect
export function addFreeLearnSession(topic, level, aspect, goalCount) {
  const sessions = getStore();
  // Éviter les doublons sur même topic
  const existing = sessions.find((s) => s.category === 'freelearn' && s.sub === topic);
  if (existing) return existing.id;
  const id = `freelearn::${topic}::${Date.now()}`;
  sessions.push({
    id,
    category: 'freelearn',
    sub: topic,
    topic,
    level,
    aspect,
    createdAt: today(),
    todayCompleted: false,
    todayDate: null,
    knowledgeCount: 0,
    pendingCount: 0,
    questionCount: goalCount,
    difficulty: 'auto',
    configured: true,
  });
  saveStore(sessions);
  return id;
}

export function addSession(category, sub) {
  const sessions = getStore();
  const id = `${category}::${sub}::${Date.now()}`;
  sessions.push({
    id,
    category,
    sub,
    createdAt: today(),
    todayCompleted: false,
    todayDate: null,
    knowledgeCount: 0,
    pendingCount: 0,
    // Config — set once on first launch, never changed after
    questionCount: null,
    difficulty: null,
    configured: false,
  });
  saveStore(sessions);
  return id;
}

export function removeSession(id) {
  const session = getSessionById(id);
  const sessions = getStore().filter((s) => s.id !== id);
  saveStore(sessions);
  // Sync deletion to Supabase + clear question history (non-blocking)
  if (session) {
    deleteRemoteSession(session.category, session.sub).catch(() => {});
    clearHistory(session.category, session.sub);
  }
  try {
    const reviews = JSON.parse(localStorage.getItem('memorix-reviews') || '{}');
    // Find session before it was removed (from old store)
    Object.keys(reviews).forEach((key) => {
      if (key.startsWith(id.split('::').slice(0, 2).join('::'))) {
        delete reviews[key];
      }
    });
    localStorage.setItem('memorix-reviews', JSON.stringify(reviews));
  } catch {}
  // Clean up daily errors
  clearDailyErrors(id);
}

export function getSessionById(id) {
  return getStore().find((s) => s.id === id) || null;
}

export function findSessionByCategorySub(category, sub) {
  return getStore().find((s) => s.category === category && s.sub === sub) || null;
}

export function updateSession(id, updates) {
  const sessions = getStore();
  const idx = sessions.findIndex((s) => s.id === id);
  if (idx === -1) return;
  sessions[idx] = { ...sessions[idx], ...updates };
  saveStore(sessions);
}

export function configureSession(id, questionCount, difficulty) {
  updateSession(id, { questionCount, difficulty, configured: true });
}

export function markSessionCompleted(id, learned) {
  const session = getSessionById(id);
  const newKnowledge = (session?.knowledgeCount || 0) + (learned || 0);
  updateSession(id, {
    todayCompleted: true,
    todayDate: today(),
    knowledgeCount: newKnowledge,
  });
  // Sync to Supabase (non-blocking)
  if (session) {
    syncSession({
      category: session.category,
      sub: session.sub,
      difficulty: session.difficulty || 'auto',
      questionCount: session.questionCount || 5,
      completed: true,
      knowledgeCount: newKnowledge,
    }).catch(() => {});
  }
}

export function isSessionCompletedToday(category, sub) {
  const session = findSessionByCategorySub(category, sub);
  return session?.todayCompleted && session?.todayDate === today();
}

export function resetDailySessions() {
  const d = today();
  const sessions = getStore();
  sessions.forEach((s) => {
    if (s.todayDate !== d) {
      s.todayCompleted = false;
      s.todayDate = null;
    }
  });
  saveStore(sessions);
}

export function sessionExists(category, sub) {
  return getStore().some((s) => s.category === category && s.sub === sub);
}

// Daily errors storage
export function saveDailyErrors(sessionId, errors) {
  try {
    const store = JSON.parse(localStorage.getItem(ERRORS_KEY) || '{}');
    store[`${sessionId}::${today()}`] = errors;
    localStorage.setItem(ERRORS_KEY, JSON.stringify(store));
  } catch {}
}

export function getDailyErrors(sessionId) {
  try {
    const store = JSON.parse(localStorage.getItem(ERRORS_KEY) || '{}');
    return store[`${sessionId}::${today()}`] || [];
  } catch { return []; }
}

export function clearDailyErrors(sessionId) {
  try {
    const store = JSON.parse(localStorage.getItem(ERRORS_KEY) || '{}');
    Object.keys(store).forEach((key) => {
      if (key.startsWith(sessionId)) delete store[key];
    });
    localStorage.setItem(ERRORS_KEY, JSON.stringify(store));
  } catch {}
}
