import { useState, useEffect, useRef, useCallback } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useLang } from '../context/LangContext';
import { addToReview, getReviewsDueToday, removeFromReview } from '../data/reviewStore';
import { addJournalEntry } from '../data/journalStore';
import { findSessionByCategorySub, markSessionCompleted, saveDailyErrors } from '../data/sessionStore';
import { getAskedQuestions, addToHistory, getPendingCount } from '../data/questionHistory';
import { generateQuestions, evaluateAnswer, generateHarderQuestions, generateFreeLearnQuestions } from '../api/claude';
import { syncSession } from '../lib/supabaseSync';
import HomeButton from '../components/HomeButton';
import BackButton from '../components/BackButton';
import ThemeToggle from '../components/ThemeToggle';
import ReportModal from '../components/ReportModal';

// Both thresholds are now dynamic based on the user's chosen goal
// MAX_PENDING = goal × 3, LEARN_GOAL = goal (calculated per session below)

function formatTime(seconds) {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m}:${s.toString().padStart(2, '0')}`;
}

export default function Session() {
  const { t, lang } = useLang();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const textareaRef = useRef(null);
  const hasStarted = useRef(false); // Prevent double-start in StrictMode

  const category = searchParams.get('category') || '';
  const sub = decodeURIComponent(searchParams.get('sub') || '');
  const questionCount = parseInt(searchParams.get('count') || '5', 10);
  const difficulty = searchParams.get('difficulty') || 'auto';
  // FreeLearn params (only set when category=freelearn)
  const flTopic  = decodeURIComponent(searchParams.get('topic')  || sub);
  const flLevel  = decodeURIComponent(searchParams.get('level')  || '');
  const flAspect = decodeURIComponent(searchParams.get('aspect') || '');
  const isFreeLearn = category === 'freelearn';

  // Dynamic thresholds based on chosen goal
  const LEARN_GOAL = questionCount;         // target wrong answers = learning goal
  const MAX_PENDING = questionCount * 3;    // max pending = goal × 3

  // Phase: 'loading' → 'review' → 'new' → 'harder' → 'done'
  const [phase, setPhase] = useState('loading');
  const [questions, setQuestions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [evaluating, setEvaluating] = useState(false);
  const [apiError, setApiError] = useState(null);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [answer, setAnswer] = useState('');
  const [showResult, setShowResult] = useState(false);
  const [isCorrect, setIsCorrect] = useState(false);
  const [evalData, setEvalData] = useState(null);
  const [showHint, setShowHint] = useState(false);
  const [emptyError, setEmptyError] = useState(false);
  const [timer, setTimer] = useState(0);
  const [allResults, setAllResults] = useState([]);
  const [pendingCount, setPendingCount] = useState(0);
  const [newWrongCount, setNewWrongCount] = useState(0); // Only counts wrong on NEW questions
  const [reviewCount, setReviewCount] = useState(0); // How many review questions at start
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

  // Timer
  useEffect(() => {
    const interval = setInterval(() => setTimer((prev) => prev + 1), 1000);
    return () => clearInterval(interval);
  }, []);

  // Load session on mount — guard against StrictMode double-call
  useEffect(() => {
    if (hasStarted.current) return;
    hasStarted.current = true;
    startSession();
  }, []);

  // ─── SESSION ORCHESTRATOR ──────────────────────────────────────────

  async function startSession() {
    setLoading(true);
    setApiError(null);
    setAnswer('');
    setShowResult(false);
    setEvalData(null);

    const pending = getPendingCount(category, sub);
    setPendingCount(pending);
    console.log(`\n═══ SESSION START: ${category} · ${sub} ═══`);
    console.log(`📅 Questions en attente: ${pending}`);

    // STEP 1: Load review questions
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
        isReview: true,
      }));
      setQuestions(reviewQuestions);
      setCurrentIndex(0);
      setAnswer('');
      setShowResult(false);
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
    setApiError(null);

    try {
      const history = getAskedQuestions(category, sub);
      console.log(`📝 Historique: ${history.length} questions déjà posées`);

      const newQuestions = isFreeLearn
        ? await generateFreeLearnQuestions(flTopic, flLevel, flAspect, questionCount, history)
        : await generateQuestions(categoryLabel, subLabel, difficulty, questionCount, history, lang);

      addToHistory(category, sub, newQuestions.map((q) => q.text));

      console.log(`✅ Questions générées: ${newQuestions.length}`);
      newQuestions.forEach((q, i) => console.log(`   ${i + 1}. ${q.text.slice(0, 60)}...`));

      setQuestions(newQuestions);
      setCurrentIndex(0);
      setAnswer('');
      setShowResult(false);
      setEvalData(null);
      setPhase('new');
    } catch (err) {
      console.error('❌ Failed to generate questions:', err);
      setApiError(err.message);
    } finally {
      setLoading(false);
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
      console.log(`✅ Questions difficiles générées: ${harder.length}`);

      setQuestions(harder);
      setCurrentIndex(0);
      setAnswer('');
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

  const handleValidate = useCallback(async () => {
    // BUG FIX #3: Triple-check answer is not empty
    const trimmed = answer.trim();
    if (!trimmed) {
      setEmptyError(true);
      setTimeout(() => setEmptyError(false), 2000);
      return;
    }
    if (!question) return;
    if (showResult) return; // Already showing result
    if (evaluating) return; // Already evaluating

    setEvaluating(true);
    let correct = false;
    let evaluation = null;

    try {
      evaluation = await evaluateAnswer(
        question.text, question.answer, question.keywords || [], trimmed
      );
      correct = evaluation.isCorrect;
    } catch {
      const userAns = trimmed.toLowerCase();
      const correctAns = question.answer.toLowerCase();
      correct = userAns === correctAns || correctAns.includes(userAns) || userAns.includes(correctAns);
      evaluation = { isCorrect: correct, result: correct ? 'correct' : 'incorrect', message: '', correction: question.answer, missing: null };
    }

    console.log(`📝 Réponse évaluée: ${correct ? '✅ correct' : '❌ incorrect'} — "${question.text.slice(0, 40)}..."`);

    setIsCorrect(correct);
    setEvalData(evaluation);
    setShowResult(true);

    const result = {
      questionId: question.id,
      correct,
      userAnswer: trimmed,
      text: question.text,
      answer: question.answer,
      anecdote: question.anecdote,
      isReview: question.isReview,
    };
    setAllResults((prev) => [...prev, result]);

    // Handle review question
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
        }]);
        console.log(`   📅 Ratée à nouveau — repart pour demain`);
      }
    } else if (!correct) {
      // BUG FIX #2: Count wrong only on NEW questions
      addToReview(category, sub, [{
        text: question.text, answer: question.answer,
        anecdote: question.anecdote, hint: question.hint, keywords: question.keywords,
      }]);
      setPendingCount((p) => p + 1);
      setNewWrongCount((w) => {
        const next = w + 1;
        console.log(`   📊 Mauvaises réponses nouvelles: ${next}/${LEARN_GOAL}`);
        return next;
      });
    }

    // Sync Supabase
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

    setEvaluating(false);
  }, [answer, question, showResult, evaluating, category, sub, difficulty, questionCount]);

  const handleNext = useCallback(async () => {
    if (currentIndex < questions.length - 1) {
      setCurrentIndex((i) => i + 1);
      setAnswer('');
      setShowResult(false);
      setShowHint(false);
      setEmptyError(false);
      setEvalData(null);
      setTimeout(() => textareaRef.current?.focus(), 50);
      return;
    }

    // Batch complete
    if (phase === 'review') {
      console.log(`\n─── Review phase complete ───`);
      const updatedPending = getPendingCount(category, sub);
      setPendingCount(updatedPending);
      console.log(`📅 Questions en attente après review: ${updatedPending}`);
      await loadNewQuestions(updatedPending);
      return;
    }

    if (phase === 'new' || phase === 'harder') {
      // BUG FIX #2: Check if we need more questions to reach LEARN_GOAL
      console.log(`📊 Bilan: ${newWrongCount} mauvaises réponses sur nouvelles (minimum: ${LEARN_GOAL})`);

      if (newWrongCount < LEARN_GOAL) {
        // Not enough wrong answers — generate harder questions
        await loadHarderQuestions();
        return;
      }

      // Enough wrong answers — session done
      finishSession();
    }
  }, [currentIndex, questions.length, phase, newWrongCount, category, sub]);

  function finishSession() {
    console.log(`\n═══ SESSION COMPLETE ═══`);
    console.log(`   Total: ${allResults.length} | Correct: ${allResults.filter((r) => r.correct).length} | Wrong: ${allResults.filter((r) => !r.correct).length}`);
    console.log(`   Wrong on new: ${newWrongCount} | Pending: ${getPendingCount(category, sub)}`);

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
        <p className="text-lg font-semibold text-primary text-center">{s.loadingQuestions}</p>
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

  // Session summary text
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

        {/* Goal progress bar — tracks wrong answers (= learned things) */}
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
          /* Review phase: show question dots */
          <div className="flex gap-2 mb-5">
            {questions.map((_, i) => (
              <div key={i} className={`h-1.5 flex-1 rounded-full transition-all ${
                i < currentIndex ? 'bg-reminder' : i === currentIndex ? 'bg-reminder/40' : 'bg-border'
              }`} />
            ))}
          </div>
        )}

        {/* FIX #1: Question card with colored left border */}
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

          {/* FIX #1: Review hint */}
          {question.isReview && (
            <p className="text-xs text-reminder/70 mb-2 italic">{s.reviewHint}</p>
          )}

          <h2 className="text-xl font-bold text-text leading-relaxed mb-5">{question.text}</h2>

          {!showResult ? (
            <>
              <textarea
                ref={textareaRef}
                value={answer}
                onChange={(e) => { setAnswer(e.target.value); setEmptyError(false); }}
                placeholder={s.placeholder}
                rows={3}
                className={`w-full p-4 rounded-xl border-2 text-base text-text resize-none outline-none transition-colors ${
                  emptyError ? 'border-error bg-error/5' : 'border-border focus:border-primary/40 bg-bg2'
                }`}
              />
              {emptyError && <p className="text-error text-sm font-medium mt-2">{s.emptyAnswer}</p>}
              {!showHint ? (
                <button onClick={() => setShowHint(true)} className="mt-3 text-sm text-text3 hover:text-text2 transition-colors cursor-pointer self-start">
                  {s.hint}
                </button>
              ) : (
                <p className="mt-3 text-sm text-reminder/80 bg-reminder/5 px-3 py-2 rounded-lg">💡 {question.hint}</p>
              )}
            </>
          ) : (
            <div className="flex flex-col gap-3">
              {isCorrect ? (
                <>
                  <div className="p-4 rounded-2xl bg-success/5 border-2 border-success/20">
                    <div className="flex items-center gap-2 mb-2">
                      <span className="text-lg">✅</span>
                      <span className="font-bold text-success">{evalData?.result === 'partiel' ? s.partialAnswer : s.correct}</span>
                    </div>
                    {evalData?.message && <p className="text-sm text-text2 leading-relaxed mb-2">{evalData.message}</p>}
                    <p className="text-sm text-text2 leading-relaxed">{question.anecdote}</p>
                  </div>
                  {evalData?.result === 'partiel' && evalData?.missing && (
                    <div className="p-3 rounded-xl bg-reminder/5 border border-reminder/20">
                      <p className="text-xs font-semibold text-reminder/70 uppercase mb-1">{s.partialMessage}</p>
                      <p className="text-sm text-text2">{evalData.missing}</p>
                    </div>
                  )}
                  {question.isReview && (
                    <div className="p-3 rounded-xl bg-success/10 text-success text-sm font-semibold text-center">
                      {s.mastered}
                    </div>
                  )}
                </>
              ) : (
                <>
                  <span className="self-start inline-block text-xs font-semibold px-3 py-1 rounded-full bg-error/10 text-error">
                    {s.newKnowledgeBadge}
                  </span>
                  {evalData?.message && <p className="text-sm text-text2">{evalData.message}</p>}
                  <div className="p-4 rounded-xl bg-success/5 border border-success/20">
                    <p className="text-xs font-semibold text-success/70 uppercase mb-1">{s.theCorrectAnswer}</p>
                    <p className="text-base font-bold text-text">{evalData?.correction || question.answer}</p>
                  </div>
                  <div className="p-4 rounded-xl bg-reminder/5 border border-reminder/20">
                    <p className="text-xs font-semibold text-reminder/70 uppercase mb-1">{s.didYouKnow}</p>
                    <p className="text-sm text-text2 leading-relaxed">{question.anecdote}</p>
                  </div>
                  <div className="p-3 rounded-xl bg-primary/10 text-primary text-sm font-semibold text-center">
                    {s.comeBackTomorrow}
                  </div>
                  {/* Signalement discret — visible uniquement sur l'écran de correction */}
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

        {/* Motivational message for new/harder questions */}
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
              disabled={evaluating || !answer.trim()}
              className={`w-full py-4 font-semibold text-lg rounded-2xl transition-colors flex items-center justify-center gap-2 ${
                evaluating
                  ? 'bg-primary/60 text-white/70 cursor-wait'
                  : !answer.trim()
                  ? 'bg-border text-text3 cursor-not-allowed'
                  : 'bg-primary hover:bg-primary-dark text-white cursor-pointer active:scale-[0.98]'
              }`}
            >
              {evaluating ? s.evaluating : <>{s.validate} <span className="text-white/70">→</span></>}
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
