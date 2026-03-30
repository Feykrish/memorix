import { useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useLang } from '../context/LangContext';
import { SUPPORTED_LANGS } from '../i18n';

// Static multilingual strings — independent of the i18n system
// (language not yet chosen when this screen appears)
const TITLES = {
  fr: 'Choisissez votre langue',
  en: 'Choose your language',
  es: 'Elige tu idioma',
  de: 'Sprache wählen',
  tr: 'Dil seçin',
};

const SUBTITLES = {
  fr: 'Vous pourrez changer cela dans les paramètres',
  en: 'You can change this in settings',
  es: 'Puedes cambiarlo en los ajustes',
  de: 'Du kannst das in den Einstellungen ändern',
  tr: 'Bunu ayarlardan değiştirebilirsin',
};

const CONTINUE_LABELS = {
  fr: 'Continuer',
  en: 'Continue',
  es: 'Continuar',
  de: 'Weiter',
  tr: 'Devam et',
};

const BACK_LABELS = {
  fr: 'Retour',
  en: 'Back',
  es: 'Volver',
  de: 'Zurück',
  tr: 'Geri',
};

export default function LanguagePicker() {
  const { lang: currentLang, changeLang } = useLang();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const isSettings = searchParams.get('mode') === 'settings';

  // In settings mode: pre-select current lang; in onboarding mode: nothing pre-selected
  const [selected, setSelected] = useState(isSettings ? currentLang : '');

  // Title/subtitle follow the selected lang (or browser-detected lang for onboarding)
  const displayLang = selected || currentLang || 'fr';
  const title = TITLES[displayLang] || TITLES.fr;
  const subtitle = SUBTITLES[displayLang] || SUBTITLES.fr;
  const continueLabel = CONTINUE_LABELS[displayLang] || CONTINUE_LABELS.fr;
  const backLabel = BACK_LABELS[displayLang] || BACK_LABELS.fr;

  const handleSelect = (code) => {
    setSelected(code);
    if (isSettings) {
      // Settings mode: save immediately and go back
      changeLang(code);
      localStorage.setItem('langue_interface', code);
      navigate(-1);
    }
  };

  const handleContinue = () => {
    if (!selected) return;
    changeLang(selected);
    localStorage.setItem('langue_interface', selected);
    const isOnboarded = localStorage.getItem('memorix-onboarded') === 'true';
    navigate(isOnboarded ? '/home' : '/onboarding', { replace: true });
  };

  return (
    <div className="min-h-dvh bg-bg flex flex-col items-center justify-center px-6">
      <div className="w-full max-w-sm flex flex-col gap-6">

        {/* Title */}
        <div className="text-center">
          <div className="text-5xl mb-5">🌍</div>
          <h1 className="text-2xl font-bold text-text leading-tight">{title}</h1>
          {!isSettings && (
            <p className="text-sm text-text3 mt-2">{subtitle}</p>
          )}
        </div>

        {/* Language buttons */}
        <div className="flex flex-col gap-3">
          {SUPPORTED_LANGS.map((l) => {
            const isSelected = selected === l.code;
            return (
              <button
                key={l.code}
                onClick={() => handleSelect(l.code)}
                className={`w-full flex items-center justify-between px-5 py-4 rounded-2xl border-2 font-semibold text-base transition-all cursor-pointer active:scale-[0.98] ${
                  isSelected
                    ? 'border-primary bg-primary/10 text-primary'
                    : 'border-border bg-card text-text hover:border-primary/40 hover:bg-primary/[0.02]'
                }`}
              >
                <div className="flex items-center gap-3">
                  <span className="text-2xl">{l.flag}</span>
                  <span>{l.label}</span>
                </div>
                {isSelected && (
                  <span className="text-primary font-bold text-xl">✓</span>
                )}
              </button>
            );
          })}
        </div>

        {/* Continue button — onboarding mode only */}
        {!isSettings && (
          <button
            onClick={handleContinue}
            disabled={!selected}
            className={`w-full py-4 rounded-2xl font-semibold text-lg transition-all ${
              selected
                ? 'bg-primary text-white cursor-pointer hover:bg-primary-dark active:scale-[0.98]'
                : 'bg-border text-text3 cursor-not-allowed opacity-60'
            }`}
          >
            {continueLabel} →
          </button>
        )}

        {/* Back button — settings mode (if user changes mind) */}
        {isSettings && (
          <button
            onClick={() => navigate(-1)}
            className="w-full py-3 rounded-2xl border-2 border-border text-text font-semibold cursor-pointer hover:bg-bg2 transition-colors"
          >
            ← {backLabel}
          </button>
        )}

      </div>
    </div>
  );
}
