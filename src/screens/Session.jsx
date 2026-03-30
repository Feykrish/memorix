import { useState, useEffect, useRef, useCallback } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useLang } from '../context/LangContext';
import { addToReview, getReviewsDueToday, removeFromReview } from '../data/reviewStore';
import { addJournalEntry } from '../data/journalStore';
import { findSessionByCategorySub, markSessionCompleted, saveDailyErrors } from '../data/sessionStore';
import { getAskedQuestions, addToHistory, getPendingCount } from '../data/questionHistory';
import { generateQuestions, evaluateAnswer, generateHarderQuestions, generateFreeLearnQuestions, generateChoicesForQuestions } from '../api/claude';
import { syncSession } from '../lib/supabaseSync';
import HomeButton from '../components/HomeButton';
import BackButton from '../components/BackButton';
import ThemeToggle from '../components/ThemeToggle';
import ReportModal from '../components/ReportModal';

function formatTime(seconds) {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m}:${s.toString().padStart(2, '0')}`;
}

export default function Session() {
  const { t, lang } = useLang();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const hasStarted = useRef(false);

  const category = searchParams.get('category') || '';
  const sub = decodeURIComponent(searchParams.get('sub') || '');
  const questionCount = parseInt(searchParams.get('count') || '5', 10);
  const difficulty = searchParams.get('difficulty') || 'auto';
  const flTopic  = decodeURIComponent(searchParams.get('topic')  || sub);
  const flLevel  = decodeURIComponent(searchParams.get('level')  || '');
  const flAspect = decodeURIComponent(searchParams.get('aspect') || '');
  const isFreeLearn = category === 'freelearn';

  const LEARN_GOAL = questionCount;
  const MAX_PENDING = questionCount * 3;

  const [phase, setPhase] = useState('loading');
  const [questions, setQuestions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [apiError, setApiError] = useState(null);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [selectedChoice, setSelectedChoice] = useState('');
  const [shuffledChoices, setShuffledChoices] = useState([]);
  const [showResult, setShowResult] = useState(false);
  const [isCorrect, setIsCorrect] = useState(false);
  const [evalData, setEvalData] = useState(null);
  const [timer, setTimer] = useState(0);
  const [allResults, setAllResults] = useState([]);
  const [pendingCount, setPendingCount] = useState(0);
  const [newWrongCount, setNewWrongCount] = useState(0);
  const [loadingFromAPI, setLoadingFromAPI] = useState(false);
  const [reviewCount, setReviewCount] = useState(0);
  const [showPerfectMessage, setShowPerfectMessage] = useState(false);
  const [showMaxPending, setShowMaxPending] = useState(false);

  const question = questions[currentIndex];
  const s = t.session;

  const categoryLabel = t.categories?.[category] || category;
  const subLabel = (() => {
    if (isFreeLearn) return flTopic;
    if (sub === 'ai-mix') return t.subcategoriesScreen?.aiMix || 'Mix';
    if (t.subcategories?.[category]?.[sub]) return t.subcategories[category][sub];
    return sub;
  })();

  // Shuffle choices when question changes — always ensure correct answer is present
  useEffect(() => {
    if (question?.choices?.length) {
      let choices = [...question.choices];
      // Client-side safety: if correct answer missing, inject it
      if (question.answer && !choices.includes(question.answer)) {
        choices = [question.answer, ...choices.slice(0, 3)];
      }
      setShuffledChoices(choices.sort(() => Math.random() - 0.5));
    } else {
      setShuffledChoices([]);
    }
    setSelectedChoice('');
    setShowResult(false);
    setEvalData(null);
  }, [question?.id]);

  // Timer
  useEffect(() => {
    const interval = setInterval(() => setTimer((prev) => prev + 1), 1000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    if (hasStarted.current) return;
    hasStarted.current = true;
    startSession();
  }, []);

  // ─── SESSION ORCHESTRATOR ──────────────────────────────────────────

  async function startSession() {
    setLoading(true);
    setApiError(null);
    setSelectedChoice('');
    setShowResult(false);
    setEvalData(null);

    const pending = getPendingCount(category, sub);
    setPendingCount(pending);
    console.log(`\n═══ SESSION START: ${category} · ${sub} ═══`);
    console.log(`📅 Questions en attente: ${pending}`);

    const reviewsDue = getReviewsDueToday();
    const key = `${category}::${sub}`;
    const reviewItems = reviewsDue[key] || [];

    if (reviewItems.length > 0) {
      console.log(`🔄 ${reviewItems.length} questions à revoir`);
      setReviewCount(reviewItems.length);
      const reviewQuestions = reviewItems.map((r, i) => ({
        id: `review-${i}-${Date.now()}`,
        text: r.text,
        answer: r.answer,
        anecdote: r.anecdote || '',
        hint: r.hint || '',
        keywords: r.keywords || [],
        choices: r.choices || [],
        isReview: true,
      }));
      const withChoices = await generateChoicesForQuestions(reviewQuestions);
      setQuestions(withChoices);
      setCurrentIndex(0);
      setPhase('review');
      setLoading(false);
      return;
    }

    setReviewCount(0);
    await loadNewQuestions(pending);
  }

  async function loadNewQuestions(currentPending) {
    if (currentPending >= MAX_PENDING) {
      console.log(`⚠️ ${currentPending} questions en attente ≥ ${MAX_PENDING} — STOP`);
      setShowMaxPending(true);
      setLoading(false);
      return;
    }

    console.log(`🆕 Génération de nouvelles questions (${currentPending} en attente < ${MAX_PENDING})`);
    setLoading(true);
    setLoadingFromAPI(false);
    setApiError(null);

    const apiTimer = setTimeout(() => setLoadingFromAPI(true), 800);

    try {
      const history = getAskedQuestions(category, sub);
      console.log(`📝 Historique: ${history.length} questions déjà posées`);

      const newQuestions = isFreeLearn
        ? await generateFreeLearnQuestions(flTopic, flLevel, flAspect, questionCount, history)
        : await generateQuestions(categoryLabel, subLabel, difficulty, questionCount, history, lang);

      addToHistory(category, sub, newQuestions.map((q) => q.text));

      const withChoices = await generateChoicesForQuestions(newQuestions);

      console.log(`✅ Questions générées: ${withChoices.length}`);
      withChoices.forEach((q, i) => console.log(`   ${i + 1}. ${q.text.slice(0, 60)}...`));

      setQuestions(withChoices);
      setCurrentIndex(0);
      setSelectedChoice('');
      setShowResult(false);
      setEvalData(null);
      setPhase('new');
    } catch (err) {
      console.error('❌ Failed to generate questions:', err);
      setApiError(err.message);
    } finally {
      clearTimeout(apiTimer);
      setLoading(false);
      setLoadingFromAPI(false);
    }
  }

  async function loadHarderQuestions() {
    console.log(`🔥 ${newWrongCount}/${LEARN_GOAL} mauvaises réponses — génération de questions plus difficiles`);
    setShowPerfectMessage(true);

    try {
      const history = getAskedQuestions(category, sub);
      const harder = isFreeLearn
        ? await generateFreeLearnQuestions(flTopic, flLevel, flAspect, LEARN_GOAL, history)
        : await generateHarderQuestions(categoryLabel, subLabel, questions, history);

      addToHistory(category, sub, harder.map((q) => q.text));
      const withChoices = await generateChoicesForQuestions(harder);
      console.log(`✅ Questions difficiles générées: ${withChoices.length}`);

      setQuestions(withChoices);
      setCurrentIndex(0);
      setSelectedChoice('');
      setShowResult(false);
      setEvalData(null);
      setPhase('harder');
      setShowPerfectMessage(false);
    } catch {
      console.log('❌ Failed harder questions — finishing session');
      setShowPerfectMessage(false);
      finishSession();
    }
  }

  // ─── ANSWER HANDLING ───────────────────────────────────────────────

  const handleValidate = useCallback(() => {
    if (!selectedChoice) return;
    if (!question) return;
    if (showResult) return;

    const evaluation = evaluateAnswer(question.answer, selectedChoice);
    const correct = evaluation.isCorrect;

    console.log(`📝 Réponse évaluée: ${correct ? '✅ correct' : '❌ incorrect'} — "${question.text.slice(0, 40)}..."`);

    setIsCorrect(correct);
    setEvalData(evaluation);
    setShowResult(true);

    const result = {
      questionId: question.id,
      correct,
      userAnswer: selectedChoice,
      text: question.text,
      answer: question.answer,
      anecdote: question.anecdote,
      isReview: question.isReview,
    };
    setAllResults((prev) => [...prev, result]);

    if (question.isReview) {
      if (correct) {
        removeFromReview(category, sub, [question.text]);
        setPendingCount((p) => Math.max(0, p - 1));
        console.log(`   ✅ Question maîtrisée — retirée`);
      } else {
        removeFromReview(category, sub, [question.text]);
        addToReview(category, sub, [{
          text: question.text, answer: question.answer,
          anecdote: question.anecdote, hint: question.hint, keywords: question.keywords,
          choices: question.choices,
        }]);
        console.log(`   📅 Ratée à nouveau — repart pour demain`);
      }
    } else if (!correct) {
      addToReview(category, sub, [{
        text: question.text, answer: question.answer,
        anecdote: question.anecdote, hint: question.hint, keywords: question.keywords,
        choices: question.choices,
      }]);
      setPendingCount((p) => p + 1);
      setNewWrongCount((w) => {
        const next = w + 1;
        console.log(`   📊 Mauvaises réponses nouvelles: ${next}/${LEARN_GOAL}`);
        return next;
      });
    }

    const sess = findSessionByCategorySub(category, sub);
    if (sess) {
      syncSession({
        category, sub,
        difficulty: sess.difficulty || difficulty,
        questionCount: sess.questionCount || questionCount,
        completed: false,
        knowledgeCount: sess.knowledgeCount || 0,
      }).catch(() => {});
    }
  }, [selectedChoice, question, showResult, category, sub, difficulty, questionCount]);

  const handleNext = useCallback(async () => {
    if (currentIndex < questions.length - 1) {
      setCurrentIndex((i) => i + 1);
      setSelectedChoice('');
      setShowResult(false);
      setEvalData(null);
      return;
    }

    if (phase === 'review') {
      console.log(`\n─── Review phase complete ───`);
      const updatedPending = getPendingCount(category, sub);
      setPendingCount(updatedPending);
      console.log(`📅 Questions en attente après review: ${updatedPending}`);
      await loadNewQuestions(updatedPending);
      return;
    }

    if (phase === 'new' || phase === 'harder') {
      console.log(`📊 Bilan: ${newWrongCount} mauvaises réponses sur nouvelles (minimum: ${LEARN_GOAL})`);

      if (newWrongCount < LEARN_GOAL) {
        await loadHarderQuestions();
        return;
      }

      finishSession();
    }
  }, [currentIndex, questions.length, phase, newWrongCount, category, sub]);

  function finishSession() {
    console.log(`\n═══ SESSION COMPLETE ═══`);
    console.log(`   Total: ${allResults.length} | Correct: ${allResults.filter((r) => r.correct).length} | Wrong: ${allResults.filter((r) => !r.correct).length}`);

    const state = {
      questions: allResults.map((r) => ({
        text: r.text, answer: r.answer, anecdote: r.anecdote,
        correct: r.correct, userAnswer: r.userAnswer, isReview: r.isReview,
      })),
      category, sub, time: timer,
    };

    sessionStorage.setItem('memorix-results', JSON.stringify(state));
    const errorQuestions = state.questions.filter((q) => !q.correct);
    const errors = errorQuestions.length;
    addJournalEntry({ type: 'session', category, sub, learned: errors });

    const sess = findSessionByCategorySub(category, sub);
    if (sess) {
      markSessionCompleted(sess.id, errors);
      saveDailyErrors(sess.id, errorQuestions.map((q) => ({
        text: q.text, answer: q.answer, anecdote: q.anecdote,
      })));
    }

    navigate('/results', { state });
  }

  // ─── RENDER STATES ─────────────────────────────────────────────────

  if (loading) {
    return (
      <div className="min-h-dvh bg-bg flex flex-col items-center justify-center px-8">
        <div className="text-5xl mb-6 animate-pulse">🧠</div>
        <p className="text-lg font-semibold text-primary text-center">
          {loadingFromAPI
            ? '🧠 L\'IA prépare vos questions personnalisées...'
            : '📚 Chargement de vos questions...'}
        </p>
        {loadingFromAPI && (
          <p className="text-sm text-text3 mt-2 animate-pulse">quelques secondes...</p>
        )}
      </div>
    );
  }

  if (apiError) {
    return (
      <div className="min-h-dvh bg-bg flex flex-col items-center justify-center px-8 gap-4">
        <div className="text-5xl mb-2">⚠️</div>
        <p className="text-sm text-error text-center font-medium">{s.apiError}</p>
        <p className="text-xs text-text3 text-center max-w-xs">{apiError}</p>
        <div className="flex gap-3 mt-4">
          <button onClick={() => navigate('/home')} className="px-6 py-3 border-2 border-border text-text font-semibold rounded-xl cursor-pointer hover:bg-bg2 transition-colors">
            {t.results.backHome}
          </button>
          <button onClick={() => { hasStarted.current = false; startSession(); }} className="px-6 py-3 bg-primary text-white font-semibold rounded-xl cursor-pointer hover:bg-primary-dark transition-colors">
            {s.retry}
          </button>
        </div>
      </div>
    );
  }

  if (showPerfectMessage) {
    return (
      <div className="min-h-dvh bg-bg flex flex-col items-center justify-center px-8">
        <div className="text-6xl mb-6 animate-pulse">🔥</div>
        <p className="text-xl font-bold text-primary text-center leading-relaxed">
          {s.harderMessage || s.perfectScore}
        </p>
        <p className="text-sm text-text3 mt-2">
          {(s.learnedProgress || '{count} / {goal} choses apprises').replace('{count}', newWrongCount).replace('{goal}', LEARN_GOAL)}
        </p>
        <p className="text-sm text-text3 mt-3 animate-pulse">{s.loadingQuestions}</p>
      </div>
    );
  }

  if (showMaxPending) {
    return (
      <div className="min-h-dvh bg-bg flex flex-col items-center justify-center px-8 gap-4">
        <div className="text-5xl mb-2">⚠️</div>
        <p className="text-base font-bold text-primary text-center">
          {(t.home.pendingMax || '').replace('{n}', pendingCount)}
        </p>
        <button onClick={() => navigate('/home')} className="mt-4 px-8 py-3 bg-primary text-white font-semibold rounded-xl cursor-pointer hover:bg-primary-dark transition-colors">
          {t.results.backHome}
        </button>
      </div>
    );
  }

  if (!question) return null;

  const summaryText = (() => {
    if (reviewCount > 0 && phase === 'review') {
      return (s.sessionSummary || '').replace('{review}', reviewCount).replace('{new}', questionCount);
    }
    return (s.sessionSummaryNewOnly || '').replace('{new}', questions.length);
  })();

  return (
    <div className="min-h-dvh bg-bg flex flex-col">
      <div className="max-w-lg mx-auto w-full px-5 py-5 flex flex-col flex-1">
        {/* Header */}
        <div className="flex items-center justify-between mb-1">
          <div className="flex items-center gap-1.5 min-w-0">
            <BackButton />
            <HomeButton />
            <p className="text-sm font-medium text-text2 truncate">
              {categoryLabel} · {subLabel}
            </p>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <span className="text-xs text-text3 font-mono">{formatTime(timer)}</span>
            <span className="text-sm font-bold text-primary">{s.q} {currentIndex + 1}/{questions.length}</span>
            <ThemeToggle />
          </div>
        </div>

        {/* Session summary */}
        <p className="text-xs text-text3 mb-2">{summaryText}</p>

        {/* Progress bar */}
        {(phase === 'new' || phase === 'harder') ? (
          <div className="mb-5">
            <div className="flex justify-between items-center mb-1.5">
              <span className="text-xs font-semibold text-primary">
                {(s.learnedProgress || '{count} / {goal} choses apprises')
                  .replace('{count}', newWrongCount)
                  .replace('{goal}', LEARN_GOAL)}
              </span>
              <span className="text-xs text-text3">{LEARN_GOAL - newWrongCount > 0 ? `${LEARN_GOAL - newWrongCount} restantes` : '✅'}</span>
            </div>
            <div className="w-full h-2.5 rounded-full bg-border overflow-hidden">
              <div
                className="h-full bg-primary rounded-full transition-all duration-500"
                style={{ width: `${Math.min(100, (newWrongCount / LEARN_GOAL) * 100)}%` }}
              />
            </div>
          </div>
        ) : (
          <div className="flex gap-2 mb-5">
            {questions.map((_, i) => (
              <div key={i} className={`h-1.5 flex-1 rounded-full transition-all ${
                i < currentIndex ? 'bg-reminder' : i === currentIndex ? 'bg-reminder/40' : 'bg-border'
              }`} />
            ))}
          </div>
        )}

        {/* Question card */}
        <div className={`flex-1 flex flex-col rounded-xl p-4 border-l-4 ${
          question.isReview
            ? 'border-l-reminder bg-reminder/[0.03]'
            : phase === 'harder'
            ? 'border-l-error bg-error/[0.03]'
            : 'border-l-primary bg-primary/[0.03]'
        }`}>
          {/* Badge row */}
          <div className="mb-3 flex gap-2 flex-wrap items-center">
            {question.isReview ? (
              <span className="inline-block text-xs font-semibold px-3 py-1 rounded-full bg-reminder/10 text-reminder">
                {s.toReview}
              </span>
            ) : (
              <span className="inline-block text-xs font-semibold px-3 py-1 rounded-full bg-primary/10 text-primary">
                {s.newBadge || s.newQuestion}
              </span>
            )}
            {phase === 'harder' && (
              <span className="inline-block text-xs font-semibold px-3 py-1 rounded-full bg-error/10 text-error">
                🔥 Expert
              </span>
            )}
          </div>

          {question.isReview && (
            <p className="text-xs text-reminder/70 mb-2 italic">{s.reviewHint}</p>
          )}

          <h2 className="text-xl font-bold text-text leading-relaxed mb-5">{question.text}</h2>

          {/* MCQ choices */}
          <div className="flex flex-col gap-3">
            {shuffledChoices.length > 0 ? shuffledChoices.map((choice) => {
              let cls;
              if (!showResult) {
                cls = selectedChoice === choice
                  ? 'bg-primary/10 border-primary text-primary font-semibold'
                  : 'bg-card border-border text-text hover:border-primary/40 cursor-pointer';
              } else {
                if (choice === question.answer) {
                  cls = 'bg-success/10 border-success text-success font-semibold';
                } else if (choice === selectedChoice && !isCorrect) {
                  cls = 'bg-error/10 border-error text-error';
                } else {
                  cls = 'bg-card border-border text-text3 opacity-50';
                }
              }
              return (
                <button
                  key={choice}
                  onClick={() => !showResult && setSelectedChoice(choice)}
                  className={`w-full py-3 px-4 rounded-xl border-2 text-left text-sm transition-all ${cls}`}
                >
                  {showResult && choice === question.answer && '✅ '}
                  {showResult && choice === selectedChoice && !isCorrect && '❌ '}
                  {choice}
                </button>
              );
            }) : (
              <p className="text-sm text-text3 animate-pulse">Chargement des choix...</p>
            )}
          </div>

          {/* Result feedback (shown below choices after validation) */}
          {showResult && (
            <div className="flex flex-col gap-3 mt-4">
              {isCorrect ? (
                <>
                  <div className="p-4 rounded-xl bg-success/5 border border-success/20">
                    <p className="text-xs font-semibold text-success/70 uppercase mb-1">{s.didYouKnow}</p>
                    <p className="text-sm text-text2 leading-relaxed">{question.anecdote}</p>
                  </div>
                  {question.isReview && (
                    <div className="p-3 rounded-xl bg-success/10 text-success text-sm font-semibold text-center">
                      {s.mastered}
                    </div>
                  )}
                </>
              ) : (
                <>
                  <div className="p-4 rounded-xl bg-reminder/5 border border-reminder/20">
                    <p className="text-xs font-semibold text-reminder/70 uppercase mb-1">{s.didYouKnow}</p>
                    <p className="text-sm text-text2 leading-relaxed">{question.anecdote}</p>
                  </div>
                  <div className="p-3 rounded-xl bg-primary/10 text-primary text-sm font-semibold text-center">
                    {s.comeBackTomorrow}
                  </div>
                  <ReportModal
                    subject={`Erreur signalée — ${categoryLabel} · ${subLabel}`}
                    context={question?.text}
                    inline
                  />
                </>
              )}
            </div>
          )}
        </div>

        {/* Motivational message */}
        {(phase === 'new' || phase === 'harder') && !question.isReview && showResult && !isCorrect && (() => {
          const msg = newWrongCount === 0 ? s.motivZero
            : newWrongCount === 1 ? s.motivOne
            : newWrongCount >= LEARN_GOAL ? (s.motivDone || '').replace('{n}', newWrongCount)
            : newWrongCount >= Math.ceil(LEARN_GOAL / 2) ? s.motivHalf
            : null;
          return msg ? <p className="text-xs font-semibold text-primary text-center mt-2">{msg}</p> : null;
        })()}

        {/* Bottom button */}
        <div className="pt-4 pb-2">
          {!showResult ? (
            <button
              onClick={handleValidate}
              disabled={!selectedChoice}
              className={`w-full py-4 font-semibold text-lg rounded-2xl transition-colors flex items-center justify-center gap-2 ${
                !selectedChoice
                  ? 'bg-border text-text3 cursor-not-allowed'
                  : 'bg-primary hover:bg-primary-dark text-white cursor-pointer active:scale-[0.98]'
              }`}
            >
              {s.validate} <span className="text-white/70">→</span>
            </button>
          ) : (
            <button onClick={handleNext} className="w-full py-4 bg-primary hover:bg-primary-dark text-white font-semibold text-lg rounded-2xl transition-colors cursor-pointer active:scale-[0.98] flex items-center justify-center gap-2">
              {s.next} <span className="text-white/70">→</span>
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
