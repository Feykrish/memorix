import { useNavigate, useSearchParams } from 'react-router-dom';
import { useLang } from '../context/LangContext';
import { getDailyErrors, findSessionByCategorySub } from '../data/sessionStore';
import { categories } from '../data/categories';
import HomeButton from '../components/HomeButton';
import BackButton from '../components/BackButton';
import ThemeToggle from '../components/ThemeToggle';

export default function DailyErrors() {
  const { t } = useLang();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();

  const category = searchParams.get('category') || '';
  const sub = searchParams.get('sub') || '';

  const session = findSessionByCategorySub(category, sub);
  const errors = session ? getDailyErrors(session.id) : [];
  const h = t.home;
  const cat = categories.find((c) => c.key === category);
  const categoryLabel = t.categories?.[category] || category;
  const subLabel = (() => {
    if (sub === 'ai-mix') return t.subcategoriesScreen?.aiMix || 'Mix';
    if (t.subcategories?.[category]?.[sub]) return t.subcategories[category][sub];
    return sub;
  })();

  return (
    <div className="min-h-dvh bg-bg2 flex flex-col">
      <div className="max-w-lg mx-auto w-full px-5 py-6 flex flex-col gap-5">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <BackButton />
            <HomeButton />
            <div>
              <p className="text-base font-bold text-text">{h.errorsTitle}</p>
              <p className="text-xs text-text3">{cat?.emoji} {categoryLabel} · {subLabel}</p>
            </div>
          </div>
          <ThemeToggle />
        </div>

        {errors.length === 0 ? (
          <div className="rounded-2xl bg-card border border-border p-8 text-center">
            <span className="text-4xl mb-3 block">🎉</span>
            <p className="text-success font-semibold">{h.noErrorsToday}</p>
          </div>
        ) : (
          <>
            <div className="flex flex-col gap-3">
              {errors.map((err, i) => (
                <div key={i} className="rounded-xl bg-card border border-border p-4">
                  {/* Question */}
                  <p className="text-sm font-bold text-text mb-3">{err.text}</p>

                  {/* Correct answer */}
                  <div className="p-3 rounded-lg bg-success/5 border border-success/20 mb-2">
                    <p className="text-xs font-semibold text-success/70 uppercase mb-0.5">{t.session.theCorrectAnswer}</p>
                    <p className="text-sm font-bold text-text">{err.answer}</p>
                  </div>

                  {/* Anecdote */}
                  {err.anecdote && (
                    <div className="p-3 rounded-lg bg-reminder/5 border border-reminder/20 mb-2">
                      <p className="text-xs font-semibold text-reminder/70 uppercase mb-0.5">{t.session.didYouKnow}</p>
                      <p className="text-xs text-text2 leading-relaxed">{err.anecdote}</p>
                    </div>
                  )}

                  {/* Badge */}
                  <span className="inline-block text-xs font-semibold px-2.5 py-1 rounded-full bg-primary/10 text-primary">
                    {h.comesBackTomorrow}
                  </span>
                </div>
              ))}
            </div>

            {/* Footer message */}
            <div className="p-4 rounded-xl bg-primary/5 border border-primary/20 text-center">
              <p className="text-sm text-primary font-medium">{h.errorsFooter}</p>
            </div>
          </>
        )}

        {/* Back button */}
        <button
          onClick={() => navigate('/home')}
          className="w-full py-4 bg-primary hover:bg-primary-dark text-white font-semibold text-lg rounded-2xl transition-colors cursor-pointer active:scale-[0.98]"
        >
          {t.results.backHome}
        </button>
      </div>
    </div>
  );
}
