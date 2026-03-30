import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useLang } from '../context/LangContext';
import { categories } from '../data/categories';
import { getSessions, removeSession, resetDailySessions, getDailyErrors } from '../data/sessionStore';
import { getReviewsDueToday, getReviewCount, simulateNextDay, getSimDayOffset, getSimulatedToday } from '../data/reviewStore';
import { getProgression, getNiveauBadge } from '../data/progressionStore';
import { isNotifAsked, initNotifications, recordActivity } from '../data/notificationStore';
import LangSelector from '../components/LangSelector';
import ThemeToggle from '../components/ThemeToggle';
import ContactModal from '../components/ContactModal';

const isDev = true; // visible pour tests — à passer false avant lancement public

function formatDate() {
  const offset = getSimDayOffset();
  const d = new Date();
  d.setDate(d.getDate() + offset);
  const jour  = String(d.getDate()).padStart(2, '0');
  const mois  = String(d.getMonth() + 1).padStart(2, '0');
  const annee = d.getFullYear();
  return `${jour}/${mois}/${annee}`;
}

export default function Home() {
  const { t, lang } = useLang();
  const navigate = useNavigate();
  const [sessions, setSessions] = useState([]);
  const [reviewDetails, setReviewDetails] = useState({});
  const [reviewCount, setReviewCount] = useState(0);
  const [deleteId, setDeleteId] = useState(null);
  const [showTutorial, setShowTutorial] = useState(false);

  const h = t.home;
  const streak = 7;

  const load = () => {
    resetDailySessions();
    const s = getSessions();
    console.log('🏠 Sessions actives:', s.map((x) => `${x.category}::${x.sub} [completed=${x.todayCompleted}]`));
    setSessions(s);
    setReviewDetails(getReviewsDueToday());
    setReviewCount(getReviewCount());
  };

  useEffect(() => {
    // First visit after onboarding? Show notification permission screen
    if (!isNotifAsked()) {
      navigate('/notification-permission', { replace: true });
      return;
    }
    // Record activity for notification timer & initialize
    recordActivity();
    initNotifications();
    load();
  }, []);

  const getSessionStatus = (s) => {
    const key = `${s.category}::${s.sub}`;
    const pending = reviewDetails[key]?.length || 0;
    if (s.todayCompleted) return { label: h.sessionCompleted, color: 'text-success' };
    if (pending > 0) return { label: `🔄 ${pending} ${h.questionsToReview}`, color: 'text-reminder' };
    return { label: h.newSession, color: 'text-primary' };
  };

  const getCatInfo = (s) => {
    const cat = categories.find((c) => c.key === s.category);
    const catLabel = t.categories?.[s.category] || s.category;
    const subLabel = (() => {
      if (s.category === 'freelearn') return s.sub; // topic text displayed directly
      if (s.sub === 'ai-mix') return t.subcategoriesScreen?.aiMix || 'Mix';
      if (t.subcategories?.[s.category]?.[s.sub]) return t.subcategories[s.category][s.sub];
      return s.sub;
    })();
    return { emoji: cat?.emoji || '📚', catLabel, subLabel };
  };

  const handleDelete = () => {
    if (!deleteId) return;
    removeSession(deleteId);
    setDeleteId(null);
    load();
  };

  const simDay = getSimDayOffset();

  const handleSimulate = () => {
    simulateNextDay();
    // Force full re-render by navigating to same page
    window.location.reload();
  };

  return (
    <div className="min-h-dvh bg-bg2 flex flex-col">
      <div className="max-w-lg mx-auto w-full px-5 py-6 flex flex-col gap-5">
        {/* Header */}
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-extrabold text-primary tracking-tight">Memorix</h1>
          <div className="flex items-center gap-2">
            <span className="text-sm text-text3 font-medium hidden sm:block">{formatDate()}</span>
            <ThemeToggle />
            <button
              onClick={() => setShowTutorial(true)}
              className="w-8 h-8 rounded-full bg-primary/10 text-primary text-sm font-bold flex items-center justify-center cursor-pointer hover:bg-primary/20 transition-colors"
              title="Tutorial"
            >
              ?
            </button>
            <ContactModal />
            <button
              onClick={() => navigate('/settings')}
              className="w-8 h-8 rounded-full bg-card border border-border text-text3 text-sm flex items-center justify-center cursor-pointer hover:bg-bg2 transition-colors"
              title="Settings"
            >
              ⚙️
            </button>
            <LangSelector />
          </div>
        </div>

        {/* Stats row */}
        <div className="flex gap-3">
          <div className="flex-1 rounded-2xl p-4 bg-primary/10">
            <div className="flex items-baseline gap-1.5">
              <span className="text-4xl font-extrabold text-primary">{streak}</span>
              <span className="text-xs text-primary/70">🔥</span>
            </div>
            <p className="text-sm font-medium text-primary/70 mt-1">{h.streak}</p>
          </div>
          <div className="flex-1 rounded-2xl p-4 bg-reminder/10">
            <p className="text-lg font-bold text-reminder">{h.topPercent}</p>
            <p className="text-xs text-reminder/70 mt-1 leading-snug">{h.topPercentDesc}</p>
            <div className="mt-3 h-1.5 bg-reminder/20 rounded-full overflow-hidden">
              <div className="h-full bg-reminder rounded-full w-[85%]" />
            </div>
          </div>
        </div>

        {/* Active sessions */}
        <div>
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-lg font-bold text-text">{h.chooseCategory}</h2>
            <div className="flex items-center gap-2">
              <button
                onClick={() => navigate('/journal')}
                className="text-xs text-text3 hover:text-primary transition-colors cursor-pointer"
              >
                {h.myJourney}
              </button>
            </div>
          </div>

          {sessions.length === 0 ? (
            <div className="rounded-2xl bg-card border border-border p-8 text-center">
              <p className="text-text3 text-sm mb-4">{h.allUpToDate}</p>
              <button
                onClick={() => navigate('/pick-categories?from=home')}
                className="px-6 py-3 bg-primary text-white font-semibold rounded-xl cursor-pointer hover:bg-primary-dark transition-colors"
              >
                {h.addSession}
              </button>
            </div>
          ) : (
            <div className="flex flex-col gap-2.5">
              {sessions.map((s) => {
                const { emoji, catLabel, subLabel } = getCatInfo(s);
                const status = getSessionStatus(s);
                const isCompleted = s.todayCompleted;
                const dailyErrors = isCompleted ? getDailyErrors(s.id) : [];

                const handleOpen = () => {
                  if (isCompleted) return;
                  // Freelearn sessions: navigate with topic/level/aspect stored in session
                  if (s.category === 'freelearn') {
                    navigate(
                      `/session?category=freelearn&sub=${encodeURIComponent(s.sub)}&topic=${encodeURIComponent(s.topic || s.sub)}&level=${encodeURIComponent(s.level || '')}&aspect=${encodeURIComponent(s.aspect || '')}&count=${s.questionCount || 5}&difficulty=auto`
                    );
                    return;
                  }
                  if (s.configured) {
                    navigate(`/session?category=${s.category}&sub=${s.sub}&count=${s.questionCount}&difficulty=${s.difficulty}`);
                  } else {
                    navigate(`/session-config?category=${s.category}&sub=${s.sub}`);
                  }
                };

                return (
                  <div key={s.id} className="rounded-xl bg-card border border-border p-4">
                    <div className="flex items-start justify-between">
                      <div className="flex items-start gap-3 min-w-0">
                        <span className="text-xl mt-0.5">{emoji}</span>
                        <div className="min-w-0">
                          <p className="text-sm font-bold text-text flex items-center gap-1.5 flex-wrap">
                            <span>{catLabel} · {subLabel}</span>
                            {s.category !== 'freelearn' && (() => {
                              const prog = getProgression(s.category, s.sub);
                              const badge = getNiveauBadge(prog.niveau);
                              return (
                                <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${badge.cls}`}>
                                  {badge.emoji} {badge.label}
                                </span>
                              );
                            })()}
                          </p>
                          <p className={`text-xs font-medium mt-0.5 ${status.color}`}>{status.label}</p>
                          <p className="text-xs text-text3 mt-1">{s.knowledgeCount} {h.knowledge}</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-1 shrink-0">
                        {!isCompleted ? (
                          <button
                            onClick={handleOpen}
                            className="px-3 py-1.5 bg-primary/10 text-primary text-xs font-semibold rounded-lg cursor-pointer hover:bg-primary/20 transition-colors"
                          >
                            {h.open}
                          </button>
                        ) : (
                          <button
                            onClick={() => navigate(`/daily-errors?category=${s.category}&sub=${s.sub}`)}
                            className="px-3 py-1.5 bg-reminder/10 text-reminder text-xs font-semibold rounded-lg cursor-pointer hover:bg-reminder/20 transition-colors"
                          >
                            {h.viewErrors}
                          </button>
                        )}
                        <button
                          onClick={() => setDeleteId(s.id)}
                          className="w-8 h-8 flex items-center justify-center text-text3 hover:text-error cursor-pointer transition-colors rounded-lg"
                        >
                          ⋯
                        </button>
                      </div>
                    </div>
                    {isCompleted && (
                      <p className="text-xs text-success mt-2 ml-10">{h.completedToday}</p>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Add session button */}
        {sessions.length > 0 && (
          <button
            onClick={() => navigate('/pick-categories?from=home')}
            className="w-full py-3 border-2 border-dashed border-border text-text3 font-medium text-sm rounded-xl cursor-pointer hover:border-primary/30 hover:text-primary transition-all"
          >
            + {h.addSession}
          </button>
        )}

        {/* Review section */}
        {reviewCount > 0 && (
          <div className="rounded-2xl bg-card border border-border p-4">
            <p className="text-sm font-bold text-text flex items-center gap-2 mb-2">📅 {h.reviewToday}</p>
            <div className="flex flex-col gap-1.5">
              {Object.entries(reviewDetails).map(([key, items]) => {
                const [cat, sub] = key.split('::');
                const catLabel = t.categories?.[cat] || cat;
                const subLabel = t.subcategories?.[cat]?.[sub] || t.vocabularyTypes?.[sub] || sub;
                return (
                  <div key={key} className="flex items-center justify-between text-sm">
                    <span className="text-text2">{catLabel} · {subLabel}</span>
                    <span className="font-semibold text-reminder">{items.length} {h.questionsToReview}</span>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Dev button */}
        {isDev && (
          <div className="flex flex-col items-center gap-1">
            {simDay > 0 && (
              <span className="text-xs font-bold text-primary bg-primary/10 px-3 py-1 rounded-full">
                📅 Jour {simDay + 1}
              </span>
            )}
            <button onClick={handleSimulate} className="text-xs text-text3 hover:text-primary transition-colors cursor-pointer py-2 text-center">
              {h.simulateNextDay}
            </button>
          </div>
        )}
      </div>

      {/* Tutorial modal */}
      {showTutorial && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 px-6" onClick={() => setShowTutorial(false)}>
          <div className="bg-card rounded-2xl p-6 max-w-sm w-full max-h-[85vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
            <h2 className="text-lg font-bold text-text mb-4">{t.tutorial.title}</h2>
            {[
              { title: t.tutorial.block1, desc: t.tutorial.block1Desc },
              { title: t.tutorial.block2, desc: t.tutorial.block2Desc },
              { title: t.tutorial.block3, desc: t.tutorial.block3Desc },
              { title: t.tutorial.block4, desc: t.tutorial.block4Desc },
              { title: t.tutorial.block5, desc: t.tutorial.block5Desc },
            ].map((block, i) => (
              <div key={i} className="mb-3">
                <p className="text-sm font-semibold text-text">{block.title}</p>
                <p className="text-xs text-text2 leading-relaxed mt-0.5">{block.desc}</p>
              </div>
            ))}
            <button
              onClick={() => setShowTutorial(false)}
              className="w-full mt-2 py-3 bg-primary text-white font-semibold rounded-xl cursor-pointer hover:bg-primary-dark transition-colors"
            >
              {t.tutorial.close}
            </button>
          </div>
        </div>
      )}

      {/* Delete confirmation modal */}
      {deleteId && (() => {
        const delSession = sessions.find((s) => s.id === deleteId);
        const delInfo = delSession ? getCatInfo(delSession) : {};
        const delName = delSession ? `${delInfo.catLabel} · ${delInfo.subLabel}` : '';
        return (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 px-6" onClick={() => setDeleteId(null)}>
            <div className="bg-card rounded-2xl p-6 max-w-sm w-full" onClick={(e) => e.stopPropagation()}>
              <p className="text-base font-bold text-text mb-2">{h.deleteSessionTitle}</p>
              <p className="text-sm text-text2 mb-6">
                {(h.confirmDeleteFull || h.confirmDelete).replace('{name}', delName)}
              </p>
              <div className="flex gap-3">
                <button
                  onClick={() => setDeleteId(null)}
                  className="flex-1 py-3 rounded-xl border-2 border-border text-text font-semibold cursor-pointer hover:bg-bg2 transition-colors"
                >
                  {h.confirmNo}
                </button>
                <button
                  onClick={handleDelete}
                  className="flex-1 py-3 rounded-xl bg-error text-white font-semibold cursor-pointer hover:bg-error/90 transition-colors"
                >
                  {h.confirmYes}
                </button>
              </div>
            </div>
          </div>
        );
      })()}
    </div>
  );
}
