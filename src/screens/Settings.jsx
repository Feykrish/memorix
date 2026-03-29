import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useLang } from '../context/LangContext';
import { isNotifEnabled, setNotifEnabled, getPermissionState, requestPermission } from '../data/notificationStore';
import { deleteAllUserData } from '../lib/supabaseSync';
import HomeButton from '../components/HomeButton';
import BackButton from '../components/BackButton';
import ThemeToggle from '../components/ThemeToggle';
import LangSelector from '../components/LangSelector';

const EMAIL_CONTACT = 'contact@memorix.app';

export default function Settings() {
  const { t } = useLang();
  const navigate = useNavigate();
  const s = t.settings;

  const [showReset, setShowReset] = useState(false);
  const [showSuggestion, setShowSuggestion] = useState(false);
  const [showBug, setShowBug] = useState(false);
  const [showRating, setShowRating] = useState(false);
  const [suggestionText, setSuggestionText] = useState('');
  const [bugText, setBugText] = useState('');
  const [notifOn, setNotifOn] = useState(isNotifEnabled);
  const permState = getPermissionState();

  const handleReset = () => {
    // Clear Supabase data (non-blocking)
    deleteAllUserData().catch(() => {});
    // Clear all local Memorix data
    const keysToRemove = [];
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key && key.startsWith('memorix')) {
        keysToRemove.push(key);
      }
    }
    keysToRemove.forEach((k) => localStorage.removeItem(k));
    sessionStorage.clear();
    setShowReset(false);
    navigate('/onboarding');
  };

  const handleSendSuggestion = () => {
    if (!suggestionText.trim()) return;
    window.location.href = `mailto:${EMAIL_CONTACT}?subject=${encodeURIComponent('Suggestion Memorix')}&body=${encodeURIComponent(suggestionText)}`;
    setSuggestionText('');
    setShowSuggestion(false);
  };

  const handleSendBug = () => {
    if (!bugText.trim()) return;
    window.location.href = `mailto:${EMAIL_CONTACT}?subject=${encodeURIComponent('Problème Memorix')}&body=${encodeURIComponent(bugText)}`;
    setBugText('');
    setShowBug(false);
  };

  return (
    <div className="min-h-dvh bg-bg2 flex flex-col">
      <div className="max-w-lg mx-auto w-full px-5 py-6 flex flex-col gap-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <BackButton />
            <HomeButton />
            <h1 className="text-xl font-bold text-text">{s.title}</h1>
          </div>
          <ThemeToggle />
        </div>

        {/* Language */}
        <div className="rounded-2xl bg-card border border-border p-5">
          <p className="text-sm font-bold text-text mb-3">{s.language}</p>
          <LangSelector />
        </div>

        {/* Notifications */}
        <div className="rounded-2xl bg-card border border-border p-5">
          <div className="flex items-center justify-between mb-2">
            <p className="text-sm font-bold text-text">{s.notifTitle}</p>
            <button
              onClick={async () => {
                if (!notifOn) {
                  // Turning on
                  if (permState === 'denied') return; // Can't re-ask
                  if (permState !== 'granted') {
                    const ok = await requestPermission();
                    setNotifOn(ok);
                  } else {
                    setNotifEnabled(true);
                    setNotifOn(true);
                  }
                } else {
                  // Turning off
                  setNotifEnabled(false);
                  setNotifOn(false);
                }
              }}
              className={`relative w-12 h-7 rounded-full transition-colors cursor-pointer ${
                notifOn ? 'bg-primary' : 'bg-border'
              }`}
            >
              <div className={`absolute top-0.5 w-6 h-6 rounded-full bg-white shadow transition-transform ${
                notifOn ? 'translate-x-5.5' : 'translate-x-0.5'
              }`} />
            </button>
          </div>
          <p className="text-xs text-text3 leading-relaxed">
            {notifOn ? s.notifOnDesc : (permState === 'denied' ? s.notifDenied : s.notifOffDesc)}
          </p>
        </div>

        {/* Reset */}
        <div className="rounded-2xl bg-card border border-border p-5">
          <p className="text-sm font-bold text-text mb-1">{s.dangerZone}</p>
          <p className="text-xs text-text3 mb-4">{s.dangerZoneDesc}</p>
          <button
            onClick={() => setShowReset(true)}
            className="w-full py-3 rounded-xl border-2 border-error/30 text-error font-semibold text-sm cursor-pointer hover:bg-error/5 transition-colors"
          >
            🔄 {s.resetButton}
          </button>
        </div>

        {/* Contact */}
        <div className="rounded-2xl bg-card border border-border p-5">
          <p className="text-sm font-bold text-text mb-4">{s.contactTitle}</p>
          <div className="flex flex-col gap-2.5">
            <button
              onClick={() => setShowSuggestion(true)}
              className="w-full flex items-center gap-3 p-3.5 rounded-xl border-2 border-border text-left cursor-pointer hover:border-primary/30 hover:bg-primary/[0.02] transition-all"
            >
              <span className="text-xl">💡</span>
              <div>
                <p className="text-sm font-semibold text-text">{s.suggest}</p>
                <p className="text-xs text-text3">{s.suggestDesc}</p>
              </div>
            </button>
            <button
              onClick={() => setShowBug(true)}
              className="w-full flex items-center gap-3 p-3.5 rounded-xl border-2 border-border text-left cursor-pointer hover:border-error/30 hover:bg-error/[0.02] transition-all"
            >
              <span className="text-xl">🐛</span>
              <div>
                <p className="text-sm font-semibold text-text">{s.bug}</p>
                <p className="text-xs text-text3">{s.bugDesc}</p>
              </div>
            </button>
            <button
              onClick={() => setShowRating(true)}
              className="w-full flex items-center gap-3 p-3.5 rounded-xl border-2 border-border text-left cursor-pointer hover:border-reminder/30 hover:bg-reminder/[0.02] transition-all"
            >
              <span className="text-xl">⭐</span>
              <div>
                <p className="text-sm font-semibold text-text">{s.rate}</p>
                <p className="text-xs text-text3">{s.rateDesc}</p>
              </div>
            </button>
          </div>
        </div>

        {/* Version */}
        <p className="text-xs text-text3 text-center py-2">Memorix v1.0.0</p>
      </div>

      {/* Reset modal */}
      {showReset && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 px-6" onClick={() => setShowReset(false)}>
          <div className="bg-card rounded-2xl p-6 max-w-sm w-full" onClick={(e) => e.stopPropagation()}>
            <p className="text-base font-bold text-text mb-2">{s.resetTitle}</p>
            <p className="text-sm text-text2 mb-6 leading-relaxed">{s.resetMessage}</p>
            <div className="flex gap-3">
              <button
                onClick={() => setShowReset(false)}
                className="flex-1 py-3 rounded-xl border-2 border-border text-text font-semibold cursor-pointer hover:bg-bg2 transition-colors"
              >
                {s.cancel}
              </button>
              <button
                onClick={handleReset}
                className="flex-1 py-3 rounded-xl bg-error text-white font-semibold cursor-pointer hover:bg-error/90 transition-colors"
              >
                {s.resetConfirm}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Suggestion modal */}
      {showSuggestion && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 px-6" onClick={() => setShowSuggestion(false)}>
          <div className="bg-card rounded-2xl p-6 max-w-sm w-full" onClick={(e) => e.stopPropagation()}>
            <p className="text-base font-bold text-text mb-4">💡 {s.suggest}</p>
            <textarea
              value={suggestionText}
              onChange={(e) => setSuggestionText(e.target.value)}
              placeholder={s.suggestionPlaceholder}
              rows={4}
              className="w-full p-3 rounded-xl border-2 border-border text-sm text-text resize-none outline-none focus:border-primary/40 bg-bg2 mb-4"
            />
            <div className="flex gap-3">
              <button
                onClick={() => setShowSuggestion(false)}
                className="flex-1 py-3 rounded-xl border-2 border-border text-text font-semibold cursor-pointer hover:bg-bg2 transition-colors"
              >
                {s.cancel}
              </button>
              <button
                onClick={handleSendSuggestion}
                disabled={!suggestionText.trim()}
                className={`flex-1 py-3 rounded-xl font-semibold transition-colors ${
                  suggestionText.trim()
                    ? 'bg-primary text-white cursor-pointer hover:bg-primary-dark'
                    : 'bg-border text-text3 cursor-not-allowed'
                }`}
              >
                {s.send}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Bug modal */}
      {showBug && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 px-6" onClick={() => setShowBug(false)}>
          <div className="bg-card rounded-2xl p-6 max-w-sm w-full" onClick={(e) => e.stopPropagation()}>
            <p className="text-base font-bold text-text mb-4">🐛 {s.bug}</p>
            <textarea
              value={bugText}
              onChange={(e) => setBugText(e.target.value)}
              placeholder={s.bugPlaceholder}
              rows={4}
              className="w-full p-3 rounded-xl border-2 border-border text-sm text-text resize-none outline-none focus:border-primary/40 bg-bg2 mb-4"
            />
            <div className="flex gap-3">
              <button
                onClick={() => setShowBug(false)}
                className="flex-1 py-3 rounded-xl border-2 border-border text-text font-semibold cursor-pointer hover:bg-bg2 transition-colors"
              >
                {s.cancel}
              </button>
              <button
                onClick={handleSendBug}
                disabled={!bugText.trim()}
                className={`flex-1 py-3 rounded-xl font-semibold transition-colors ${
                  bugText.trim()
                    ? 'bg-error text-white cursor-pointer hover:bg-error/90'
                    : 'bg-border text-text3 cursor-not-allowed'
                }`}
              >
                {s.send}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Rating modal */}
      {showRating && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 px-6" onClick={() => setShowRating(false)}>
          <div className="bg-card rounded-2xl p-6 max-w-sm w-full text-center" onClick={(e) => e.stopPropagation()}>
            <span className="text-4xl block mb-3">⭐</span>
            <p className="text-base font-bold text-text mb-2">{s.rate}</p>
            <p className="text-sm text-text2 mb-5">{s.rateComingSoon}</p>
            <button
              onClick={() => setShowRating(false)}
              className="w-full py-3 rounded-xl bg-primary text-white font-semibold cursor-pointer hover:bg-primary-dark transition-colors"
            >
              OK
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
