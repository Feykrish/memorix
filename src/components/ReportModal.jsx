/**
 * ReportModal — bouton 🚩 + modale de signalement d'erreur.
 * Utilisé dans Session et VocabularySession.
 *
 * Props:
 *   subject  — sujet de mail (ex: "Erreur signalée — Histoire · Antiquité")
 *   context  — texte de contexte affiché en gris (la question ou le mot actuel)
 */

import { useState } from 'react';

const REPORT_EMAIL = 'contact@memorix.app';

const OPTIONS = [
  'La question est mal formulée',
  'La réponse correcte est incorrecte',
  "L'anecdote contient une erreur",
  'Autre',
];

/**
 * inline=true  → bouton texte discret "🚩 Signaler une erreur sur cette question"
 * inline=false → icône ronde (usage futur)
 */
export default function ReportModal({ subject, context, inline = false }) {
  const [open, setOpen] = useState(false);
  const [checked, setChecked] = useState([]);
  const [comment, setComment] = useState('');

  const toggle = (opt) =>
    setChecked((prev) =>
      prev.includes(opt) ? prev.filter((o) => o !== opt) : [...prev, opt]
    );

  const handleSend = () => {
    const types = checked.length > 0 ? checked.join(', ') : 'Non précisé';
    const body = [
      `Contexte : ${context || '—'}`,
      `Type d'erreur : ${types}`,
      comment ? `Commentaire : ${comment}` : null,
    ]
      .filter(Boolean)
      .join('\n');

    const mailto = `mailto:${REPORT_EMAIL}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
    window.open(mailto, '_blank');
    setOpen(false);
    setChecked([]);
    setComment('');
  };

  const handleClose = () => {
    setOpen(false);
    setChecked([]);
    setComment('');
  };

  return (
    <>
      {/* Bouton déclencheur */}
      {inline ? (
        <button
          onClick={() => setOpen(true)}
          className="w-full text-center text-xs text-text3 hover:text-error transition-colors cursor-pointer py-1"
        >
          🚩 Signaler une erreur sur cette question
        </button>
      ) : (
        <button
          onClick={() => setOpen(true)}
          className="w-7 h-7 rounded-full flex items-center justify-center text-text3 hover:text-error hover:bg-error/10 transition-colors cursor-pointer"
          title="Signaler une erreur"
          aria-label="Signaler une erreur"
        >
          <svg viewBox="0 0 20 20" fill="currentColor" className="w-4 h-4">
            <path fillRule="evenodd" d="M3 6a1 1 0 0 1 1-1h.5L6 3h8l1.5 2H16a1 1 0 0 1 1 1v8a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V6zm7 1a1 1 0 0 0-1 1v3a1 1 0 1 0 2 0V8a1 1 0 0 0-1-1zm0 6a1 1 0 1 0 0 2 1 1 0 0 0 0-2z" clipRule="evenodd" />
          </svg>
        </button>
      )}

      {/* Overlay + modale */}
      {open && (
        <div
          className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/40 backdrop-blur-sm px-4 pb-4 sm:pb-0"
          onClick={(e) => { if (e.target === e.currentTarget) handleClose(); }}
        >
          <div className="w-full max-w-sm bg-card rounded-2xl border border-border shadow-xl p-5 flex flex-col gap-4">
            <h3 className="text-base font-bold text-text">🚩 Signaler une erreur</h3>

            {/* Contexte */}
            {context && (
              <p className="text-xs text-text3 bg-bg2 rounded-lg px-3 py-2 leading-relaxed line-clamp-3">
                {context}
              </p>
            )}

            {/* Options */}
            <div className="flex flex-col gap-2">
              {OPTIONS.map((opt) => (
                <label
                  key={opt}
                  className="flex items-center gap-3 cursor-pointer group"
                >
                  <input
                    type="checkbox"
                    checked={checked.includes(opt)}
                    onChange={() => toggle(opt)}
                    className="w-4 h-4 accent-primary cursor-pointer"
                  />
                  <span className="text-sm text-text group-hover:text-primary transition-colors">
                    {opt}
                  </span>
                </label>
              ))}
            </div>

            {/* Commentaire libre */}
            <textarea
              value={comment}
              onChange={(e) => setComment(e.target.value)}
              placeholder="Précisez (optionnel)"
              rows={2}
              className="w-full px-3 py-2 rounded-xl border border-border bg-bg2 text-sm text-text resize-none outline-none focus:border-primary/40 transition-colors"
            />

            {/* Actions */}
            <div className="flex gap-2">
              <button
                onClick={handleClose}
                className="flex-1 py-2.5 rounded-xl border-2 border-border text-text2 text-sm font-semibold cursor-pointer hover:bg-bg2 transition-colors"
              >
                Annuler
              </button>
              <button
                onClick={handleSend}
                className="flex-1 py-2.5 rounded-xl bg-primary text-white text-sm font-semibold cursor-pointer hover:bg-primary-dark transition-colors"
              >
                Envoyer
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
