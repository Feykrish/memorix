/**
 * ContactModal — bouton ✉️ + modale de contact dans l'Accueil.
 */

import { useState } from 'react';

const CONTACT_EMAIL = 'contact@memorix.app';

export default function ContactModal() {
  const [open, setOpen] = useState(false);
  const [storeMsg, setStoreMsg] = useState(false);

  const handleSuggestion = () => {
    window.open(
      `mailto:${CONTACT_EMAIL}?subject=${encodeURIComponent('Suggestion Memorix')}`,
      '_blank'
    );
    setOpen(false);
  };

  const handleBug = () => {
    window.open(
      `mailto:${CONTACT_EMAIL}?subject=${encodeURIComponent('Problème technique Memorix')}`,
      '_blank'
    );
    setOpen(false);
  };

  const handleRate = () => {
    setStoreMsg(true);
    setTimeout(() => setStoreMsg(false), 3000);
  };

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="w-8 h-8 rounded-full bg-card border border-border text-text3 text-sm flex items-center justify-center cursor-pointer hover:bg-bg2 transition-colors"
        title="Contact"
      >
        ✉️
      </button>

      {open && (
        <div
          className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/40 backdrop-blur-sm px-4 pb-4 sm:pb-0"
          onClick={(e) => { if (e.target === e.currentTarget) setOpen(false); }}
        >
          <div className="w-full max-w-sm bg-card rounded-2xl border border-border shadow-xl p-5 flex flex-col gap-3">
            <h3 className="text-base font-bold text-text mb-1">Nous contacter</h3>

            <button
              onClick={handleSuggestion}
              className="w-full py-3 px-4 rounded-xl bg-primary/10 text-primary font-semibold text-sm text-left cursor-pointer hover:bg-primary/20 transition-colors"
            >
              💡 Suggérer une amélioration
            </button>

            <button
              onClick={handleBug}
              className="w-full py-3 px-4 rounded-xl bg-error/10 text-error font-semibold text-sm text-left cursor-pointer hover:bg-error/20 transition-colors"
            >
              🐛 Signaler un problème technique
            </button>

            <button
              onClick={handleRate}
              className="w-full py-3 px-4 rounded-xl bg-reminder/10 text-reminder font-semibold text-sm text-left cursor-pointer hover:bg-reminder/20 transition-colors"
            >
              ⭐ Noter l'application
            </button>

            {storeMsg && (
              <p className="text-xs text-text3 text-center -mt-1">
                Bientôt disponible sur les stores !
              </p>
            )}

            <button
              onClick={() => setOpen(false)}
              className="w-full py-2.5 rounded-xl border-2 border-border text-text2 text-sm font-semibold cursor-pointer hover:bg-bg2 transition-colors mt-1"
            >
              Fermer
            </button>
          </div>
        </div>
      )}
    </>
  );
}
