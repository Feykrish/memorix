import { syncJournalEntry } from '../lib/supabaseSync';

const STORAGE_KEY = 'memorix-journal';

function getStore() {
  try { return JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]'); }
  catch { return []; }
}

function saveStore(journal) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(journal));
}

function today() {
  return new Date().toISOString().slice(0, 10);
}

export function addJournalEntry(entry) {
  const journal = getStore();
  const d = today();
  let dayEntry = journal.find((j) => j.date === d);
  if (!dayEntry) {
    dayEntry = { date: d, entries: [] };
    journal.push(dayEntry);
  }
  dayEntry.entries.push(entry);
  saveStore(journal);
  // Sync to Supabase (non-blocking)
  syncJournalEntry(d, dayEntry.entries).catch(() => {});
}

export function getJournal() {
  return getStore().sort((a, b) => b.date.localeCompare(a.date));
}

export function getTodayEntries() {
  const d = today();
  const journal = getStore();
  const dayEntry = journal.find((j) => j.date === d);
  return dayEntry?.entries || [];
}
