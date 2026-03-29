import { useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useLang } from '../context/LangContext';
import { categories, FREELEARN_CATEGORY } from '../data/categories';
import { isNotifAsked } from '../data/notificationStore';
import HomeButton from '../components/HomeButton';
import BackButton from '../components/BackButton';
import ThemeToggle from '../components/ThemeToggle';

export default function CategoryPicker() {
  const { t } = useLang();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const fromHome = searchParams.get('from') === 'home';

  const [selected, setSelected] = useState([]);
  const [error, setError] = useState(false);
  const cp = t.categoryPicker;

  const toggle = (key) => {
    if (fromHome) {
      // Single selection mode from Home
      setSelected((prev) => prev[0] === key ? [] : [key]);
    } else {
      // Multi selection mode from Onboarding
      setSelected((prev) =>
        prev.includes(key) ? prev.filter((k) => k !== key) : [...prev, key]
      );
    }
    setError(false);
  };

  const handleContinue = () => {
    if (selected.length === 0) {
      setError(true);
      return;
    }

    if (fromHome) {
      const cat = selected[0];
      if (cat === FREELEARN_CATEGORY) {
        navigate('/freelearn-dialog?addSession=true');
        return;
      }
      navigate(`/subcategories/${cat}?addSession=true`);
    } else {
      // Onboarding flow
      localStorage.setItem('memorix-onboarded', 'true');
      const allSelected = selected;
      if (allSelected.length > 0) {
        sessionStorage.setItem('memorix-pending-categories', JSON.stringify(allSelected));
        navigate(`/subcategories/${allSelected[0]}?addSession=true&pending=${allSelected.length > 1 ? 'true' : 'false'}`);
      } else {
        // Only freelearn was selected
        navigate('/freelearn-dialog?addSession=true');
      }
    }
  };

  return (
    <div className="min-h-dvh bg-bg flex flex-col">
      <div className="flex items-center justify-between px-6 pt-5">
        {fromHome ? (
          <div className="flex items-center gap-2">
            <BackButton />
            <HomeButton />
          </div>
        ) : <div />}
        <ThemeToggle />
      </div>

      <div className="flex-1 flex flex-col items-center px-6 pt-4 pb-6 max-w-lg mx-auto w-full">
        <h1 className="text-2xl font-bold text-text text-center">
          {fromHome ? (cp.titleSingle || cp.title) : cp.title}
        </h1>
        <p className="mt-2 text-text3 text-sm text-center">
          {fromHome
            ? (cp.subtitleSingle || 'Sélectionnez 1 catégorie pour créer votre session.')
            : cp.subtitle}
        </p>

        <div className="mt-8 w-full grid grid-cols-2 gap-2.5">
          {categories.map((cat) => {
            const isSelected = selected.includes(cat.key);
            const isDisabled = fromHome && selected.length > 0 && !isSelected;
            return (
              <button
                key={cat.key}
                onClick={() => !isDisabled && toggle(cat.key)}
                className={`flex items-center gap-2.5 p-3.5 rounded-xl border-2 transition-all text-left ${
                  isDisabled
                    ? 'border-border bg-card opacity-40 cursor-not-allowed'
                    : isSelected
                    ? 'border-primary bg-primary/5 cursor-pointer'
                    : 'border-border bg-card hover:border-border2 cursor-pointer'
                }`}
              >
                <span className="text-xl">{cat.emoji}</span>
                <span className={`text-sm font-semibold ${isSelected ? 'text-primary' : 'text-text'}`}>
                  {t.categories[cat.key]}
                </span>
              </button>
            );
          })}
        </div>

        {error && (
          <p className="text-error text-sm font-medium mt-4">{cp.minOne}</p>
        )}

        <div className="flex-1 min-h-6" />

        <button
          onClick={handleContinue}
          disabled={selected.length === 0}
          className={`w-full py-4 font-semibold text-lg rounded-2xl transition-colors flex items-center justify-center gap-2 ${
            selected.length > 0
              ? 'bg-primary hover:bg-primary-dark text-white cursor-pointer active:scale-[0.98]'
              : 'bg-border text-text3 cursor-not-allowed'
          }`}
        >
          {fromHome ? (cp.createSession || 'Créer cette session →') : cp.continue} {selected.length > 0 && !fromHome && <span className="text-white/70">→</span>}
        </button>
      </div>
    </div>
  );
}
