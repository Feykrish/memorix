const STORAGE_KEY = 'memorix-reviews';
const SIMDAY_KEY = 'memorix-sim-day-offset';

function getStore() {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY) || '{}');
  } catch {
    return {};
  }
}

function saveStore(store) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(store));
}

// Returns simulated "today" date string (real date + offset days)
export function getSimulatedToday() {
  const offset = parseInt(localStorage.getItem(SIMDAY_KEY) || '0', 10);
  const d = new Date();
  d.setDate(d.getDate() + offset);
  return d.toISOString().slice(0, 10);
}

export function getSimDayOffset() {
  return parseInt(localStorage.getItem(SIMDAY_KEY) || '0', 10);
}

function today() {
  return getSimulatedToday();
}

// Add questions to review for tomorrow
export function addToReview(category, sub, questions) {
  const store = getStore();
  const tomorrow = new Date();
  const offset = getSimDayOffset();
  tomorrow.setDate(tomorrow.getDate() + 1 + offset);
  const date = tomorrow.toISOString().slice(0, 10);

  const key = `${category}::${sub}`;
  if (!store[key]) store[key] = [];

  questions.forEach((q) => {
    store[key].push({ ...q, reviewDate: date });
  });

  saveStore(store);
}

// Get all questions due today grouped by category::sub
export function getReviewsDueToday() {
  const store = getStore();
  const d = today();
  const due = {};

  Object.entries(store).forEach(([key, items]) => {
    const dueItems = items.filter((item) => item.reviewDate <= d);
    if (dueItems.length > 0) {
      due[key] = dueItems;
    }
  });

  return due;
}

// Get total count of reviews due today
export function getReviewCount() {
  const due = getReviewsDueToday();
  return Object.values(due).reduce((sum, items) => sum + items.length, 0);
}

// Remove mastered questions (answered correctly on review)
export function removeFromReview(category, sub, questionTexts) {
  const store = getStore();
  const key = `${category}::${sub}`;
  if (!store[key]) return;
  store[key] = store[key].filter((item) => !questionTexts.includes(item.text));
  if (store[key].length === 0) delete store[key];
  saveStore(store);
}

// Simulate next day (dev mode) — increment offset by 1
export function simulateNextDay() {
  const current = getSimDayOffset();
  localStorage.setItem(SIMDAY_KEY, String(current + 1));
}

// Reset simulation
export function resetSimulation() {
  localStorage.removeItem(SIMDAY_KEY);
}
