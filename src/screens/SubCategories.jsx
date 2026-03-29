import { useParams, useNavigate, useSearchParams, Navigate } from 'react-router-dom';
import { useLang } from '../context/LangContext';
import { categories, subcategoryKeys, SPECIAL_CATEGORIES, FREELEARN_CATEGORY, religionEmojis } from '../data/categories';
import { addSession, sessionExists } from '../data/sessionStore';
import { addJournalEntry } from '../data/journalStore';
import HomeButton from '../components/HomeButton';
import BackButton from '../components/BackButton';
import ThemeToggle from '../components/ThemeToggle';

export default function SubCategories() {
  const { categoryKey } = useParams();
  const { t } = useLang();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const isAddSession = searchParams.get('addSession') === 'true';

  if (categoryKey === FREELEARN_CATEGORY) {
    return <Navigate to={`/freelearn-dialog${isAddSession ? '?addSession=true' : ''}`} replace />;
  }

  const category = categories.find((c) => c.key === categoryKey);
  const subs = subcategoryKeys[categoryKey] || [];
  const isSpecial = SPECIAL_CATEGORIES[categoryKey];

  if (!category) {
    navigate('/home');
    return null;
  }

  const handleSelect = (subKey) => {
    if (isAddSession && !sessionExists(categoryKey, subKey)) {
      addSession(categoryKey, subKey);
      addJournalEntry({ type: 'newSession', category: categoryKey, sub: subKey });
      // Check if there are more pending categories from onboarding
      try {
        const pending = JSON.parse(sessionStorage.getItem('memorix-pending-categories') || '[]');
        const remaining = pending.filter((c) => c !== categoryKey);
        if (remaining.length > 0) {
          sessionStorage.setItem('memorix-pending-categories', JSON.stringify(remaining));
          navigate(`/subcategories/${remaining[0]}?addSession=true&pending=true`);
          return;
        }
        sessionStorage.removeItem('memorix-pending-categories');
      } catch {}
    }
    navigate(`/session-config?category=${categoryKey}&sub=${subKey}`);
  };

  const handleAiMix = () => {
    if (isAddSession && !sessionExists(categoryKey, 'ai-mix')) {
      addSession(categoryKey, 'ai-mix');
      addJournalEntry({ type: 'newSession', category: categoryKey, sub: 'ai-mix' });
    }
    navigate(`/session-config?category=${categoryKey}&sub=ai-mix`);
  };

  const texts = t.subcategoriesScreen;
  const subTranslations = t.subcategories[categoryKey] || {};

  return (
    <div className="min-h-dvh bg-bg2 flex flex-col">
      <div className="max-w-lg mx-auto w-full px-5 py-6 flex flex-col gap-5">
        {/* Header */}
        <div className="flex items-center gap-3">
          <BackButton />
          <HomeButton />
          <div className="flex items-center gap-2">
            <span className="text-2xl">{category.emoji}</span>
            <h1 className="text-xl font-bold text-text">
              {t.categories[categoryKey]}
            </h1>
          </div>
        </div>

        {/* Section title */}
        <h2 className="text-base font-semibold text-text2">
          {isSpecial ? texts.chooseReligion : texts.choose}
        </h2>

        {/* AI Mix card — only for non-special categories */}
        {!isSpecial && (
          <button
            onClick={handleAiMix}
            className="w-full flex items-center gap-4 p-4 rounded-2xl bg-gradient-to-r from-primary to-primary-light text-white cursor-pointer hover:opacity-95 transition-opacity active:scale-[0.98]"
          >
            <div className="w-11 h-11 rounded-xl bg-white/20 flex items-center justify-center shrink-0">
              <svg viewBox="0 0 24 24" className="w-6 h-6" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M12 2l2.4 7.4H22l-6.2 4.5 2.4 7.4L12 16.8l-6.2 4.5 2.4-7.4L2 9.4h7.6z" />
              </svg>
            </div>
            <div className="text-left">
              <p className="font-bold text-base">{texts.aiMix}</p>
              <p className="text-sm text-white/70">{texts.aiMixDesc}</p>
            </div>
          </button>
        )}

        {/* Subcategory / Religion list */}
        <div className="flex flex-col gap-2.5">
          {subs.map((subKey) => {
            const isReligion = isSpecial;
            return (
              <button
                key={subKey}
                onClick={() => handleSelect(subKey)}
                className="w-full flex items-center gap-3.5 p-4 rounded-xl border-2 border-border bg-card hover:border-primary/30 hover:bg-primary/[0.02] transition-all cursor-pointer text-left active:scale-[0.98]"
              >
                {isReligion && (
                  <span className="text-2xl">{religionEmojis[subKey]}</span>
                )}
                <span className="text-[15px] font-semibold text-text">
                  {subTranslations[subKey] || subKey}
                </span>
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}
