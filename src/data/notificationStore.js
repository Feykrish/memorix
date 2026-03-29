const NOTIF_ENABLED_KEY = 'memorix-notif-enabled';
const NOTIF_ASKED_KEY = 'memorix-notif-asked';
const LAST_ACTIVITY_KEY = 'memorix-last-activity';
const NOTIF_TIMER_KEY = 'memorix-notif-timer';

const DELAY_MS = 24 * 60 * 60 * 1000; // 24 hours

const MESSAGES = [
  {
    title: '🧠 Memorix — Il est temps de tester votre mémoire !',
    body: 'Vos questions vous attendent — revenez tester votre mémoire !',
  },
  {
    title: '📅 Memorix — 24h se sont écoulées',
    body: '24h se sont écoulées — de nouvelles questions sont prêtes !',
  },
  {
    title: '💡 Memorix — Le saviez-vous ?',
    body: 'Saviez-vous que réviser chaque jour triple la mémorisation ? Revenez !',
  },
  {
    title: '🔥 Memorix — Ne cassez pas votre streak',
    body: 'Ne cassez pas votre streak — revenez apprendre quelque chose aujourd\'hui !',
  },
  {
    title: '📖 Memorix — Vos sessions vous attendent',
    body: 'Vos sessions vous attendent — quelques minutes suffisent !',
  },
];

function getRandomMessage() {
  return MESSAGES[Math.floor(Math.random() * MESSAGES.length)];
}

export function isNotifAsked() {
  return localStorage.getItem(NOTIF_ASKED_KEY) === 'true';
}

export function setNotifAsked() {
  localStorage.setItem(NOTIF_ASKED_KEY, 'true');
}

export function isNotifEnabled() {
  return localStorage.getItem(NOTIF_ENABLED_KEY) === 'true';
}

export function setNotifEnabled(enabled) {
  localStorage.setItem(NOTIF_ENABLED_KEY, enabled ? 'true' : 'false');
  if (!enabled) {
    cancelScheduledNotification();
  }
}

export async function requestPermission() {
  if (!('Notification' in window)) return false;
  const result = await Notification.requestPermission();
  const granted = result === 'granted';
  setNotifEnabled(granted);
  setNotifAsked();
  if (granted) {
    recordActivity();
  }
  return granted;
}

export function declinePermission() {
  setNotifEnabled(false);
  setNotifAsked();
}

export function getPermissionState() {
  if (!('Notification' in window)) return 'unsupported';
  return Notification.permission; // 'granted' | 'denied' | 'default'
}

// Record last activity and schedule notification 24h later
export function recordActivity() {
  const now = Date.now();
  localStorage.setItem(LAST_ACTIVITY_KEY, String(now));
  if (isNotifEnabled()) {
    scheduleNotification(now + DELAY_MS);
  }
}

function scheduleNotification(fireAt) {
  // Clear any existing timer
  cancelScheduledNotification();

  const delay = fireAt - Date.now();
  if (delay <= 0) return;

  const timerId = setTimeout(() => {
    sendNotification();
  }, delay);

  // Store timer ID so we can cancel
  localStorage.setItem(NOTIF_TIMER_KEY, String(timerId));
}

function cancelScheduledNotification() {
  const existingTimer = localStorage.getItem(NOTIF_TIMER_KEY);
  if (existingTimer) {
    clearTimeout(parseInt(existingTimer, 10));
    localStorage.removeItem(NOTIF_TIMER_KEY);
  }
}

function sendNotification() {
  if (!isNotifEnabled()) return;
  if (!('Notification' in window) || Notification.permission !== 'granted') return;

  const msg = getRandomMessage();
  try {
    new Notification(msg.title, {
      body: msg.body,
      icon: '/memorix-icon.png',
      badge: '/memorix-icon.png',
      tag: 'memorix-daily-reminder',
    });
  } catch {
    // Fallback: some browsers require service worker for notifications
  }
}

// Initialize on app load — reschedule if needed
export function initNotifications() {
  if (!isNotifEnabled()) return;

  const lastActivity = localStorage.getItem(LAST_ACTIVITY_KEY);
  if (!lastActivity) {
    recordActivity();
    return;
  }

  const lastTime = parseInt(lastActivity, 10);
  const fireAt = lastTime + DELAY_MS;

  if (fireAt > Date.now()) {
    // Still waiting — reschedule
    scheduleNotification(fireAt);
  }
  // else: already past 24h, record new activity for next cycle
  recordActivity();
}
