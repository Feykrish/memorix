import { useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useLang } from '../context/LangContext';
import HomeButton from '../components/HomeButton';
import BackButton from '../components/BackButton';
import ThemeToggle from '../components/ThemeToggle';

function formatTime(seconds) {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m}:${s.toString().padStart(2, '0')}`;
}

export default function Results() {
  const { t } = useLang();
  const navigate = useNavigate();
  const location = useLocation();
  const [copied, setCopied] = useState(false);

  const data = location.state || (() => {
    try { return JSON.parse(sessionStorage.getItem('memorix-results') || '{}'); } catch { return {}; }
  })();
  const questions = data.questions || [];
  const category = data.category || '';
  const sub = data.sub || '';
  const time = data.time || 0;

  const total = questions.length || 5;
  const score = questions.filter((q) => q.correct).length;
  const errors = total - score;
  const r = t.results;

  const categoryLabel = t.categories?.[category] || category;
  const subLabel = (() => {
    if (sub === 'ai-mix') return t.subcategoriesScreen?.aiMix || 'Mix';
    if (t.subcategories?.[category]?.[sub]) return t.subcategories[category][sub];
    if (t.vocabularyTypes?.[sub]) return t.vocabularyTypes[sub];
    return sub;
  })();

  // Dynamic message
  const getMessage = () => {
    if (score === total) return r.perfect;
    if (score >= 3) return r.good.replace('{n}', errors);
    return r.low.replace('{n}', errors);
  };

  const shareText = r.shareText
    .replace('{n}', errors)
    .replace('{cat}', categoryLabel);

  const handleShare = async () => {
    if (navigator.share) {
      try {
        await navigator.share({ text: shareText });
      } catch {}
    }
  };

  const handleCopy = () => {
    navigator.clipboard?.writeText(shareText);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleWhatsApp = () => {
    window.open(`https://wa.me/?text=${encodeURIComponent(shareText)}`, '_blank');
  };

  const handleX = () => {
    window.open(`https://x.com/intent/tweet?text=${encodeURIComponent(shareText)}`, '_blank');
  };

  const handleInstagram = () => {
    navigator.clipboard?.writeText(shareText);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  // If no data, redirect home
  if (questions.length === 0) {
    return (
      <div className="min-h-dvh bg-bg flex flex-col items-center justify-center px-8">
        <p className="text-text3 mb-4">No results data</p>
        <button onClick={() => navigate('/home')} className="text-primary font-semibold cursor-pointer">
          {r.backHome}
        </button>
      </div>
    );
  }

  return (
    <div className="min-h-dvh bg-bg2 flex flex-col">
      <div className="max-w-lg mx-auto w-full px-5 py-6 flex flex-col gap-6">
        {/* Header */}
        <div className="flex items-center gap-2">
          <BackButton />
          <HomeButton />
        </div>
        {/* Learned count — replaces score circle */}
        <div className="flex flex-col items-center pt-4">
          <div className="w-28 h-28 rounded-full bg-primary/10 border-4 border-primary flex flex-col items-center justify-center mb-4">
            <span className="text-4xl font-extrabold text-primary leading-none">{errors}</span>
            <span className="text-xs font-semibold text-primary/60 mt-1">appris</span>
          </div>
          <h2 className="text-lg font-bold text-text text-center leading-snug max-w-xs">
            {(r.learnedTitle || 'Vous avez appris {n} nouvelles choses !').replace('{n}', errors)}
          </h2>
          <p className="text-sm text-text3 text-center mt-1 leading-relaxed max-w-xs">
            {getMessage()}
          </p>
          <p className="text-xs text-text3 mt-2 font-mono">
            {categoryLabel} · {subLabel} · {formatTime(time)}
          </p>
        </div>

        {/* Stats row */}
        <div className="flex gap-3">
          <div className="flex-1 rounded-xl p-3 bg-primary/5 text-center">
            <p className="text-2xl font-extrabold text-primary">42</p>
            <p className="text-xs font-medium text-primary/60 mt-0.5">{r.totalKnowledge}</p>
          </div>
          <div className="flex-1 rounded-xl p-3 bg-reminder/5 text-center">
            <p className="text-2xl font-extrabold text-reminder">{r.topPercent}</p>
            <p className="text-xs font-medium text-reminder/60 mt-0.5">🏆</p>
          </div>
          <div className="flex-1 rounded-xl p-3 bg-success/5 text-center">
            <p className="text-2xl font-extrabold text-success">7</p>
            <p className="text-xs font-medium text-success/60 mt-0.5">{r.streak} ({r.days})</p>
          </div>
        </div>

        {/* Questions summary */}
        <div className="flex flex-col gap-2.5">
          {questions.map((q, i) => (
            <div
              key={i}
              className={`rounded-xl p-4 ${q.correct ? 'bg-card border border-border' : 'bg-card border border-border'}`}
            >
              <div className="flex items-start gap-3">
                {/* Dot */}
                <div className={`w-5 h-5 rounded-full shrink-0 mt-0.5 flex items-center justify-center ${
                  q.correct ? 'bg-success' : 'bg-error'
                }`}>
                  {q.correct ? (
                    <svg viewBox="0 0 24 24" className="w-3 h-3 text-white" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                      <polyline points="20 6 9 17 4 12" />
                    </svg>
                  ) : (
                    <svg viewBox="0 0 24 24" className="w-3 h-3 text-white" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round">
                      <line x1="18" y1="6" x2="6" y2="18" />
                      <line x1="6" y1="6" x2="18" y2="18" />
                    </svg>
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-text leading-snug">{q.text}</p>
                  {!q.correct && (
                    <>
                      <p className="text-xs text-text3 mt-1.5">
                        {r.correctAnswer} <span className="font-semibold text-text">{q.answer}</span>
                      </p>
                      <div className="mt-2 pl-3 border-l-2 border-reminder/40">
                        <p className="text-xs text-text3 italic leading-relaxed">{q.anecdote}</p>
                      </div>
                    </>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>

        {/* Share block */}
        <div className="rounded-2xl bg-card border border-border p-5">
          <p className="text-sm font-bold text-text mb-2">{r.shareTitle}</p>
          <p className="text-xs text-text3 leading-relaxed mb-4">{shareText}</p>
          <div className="grid grid-cols-3 gap-2">
            <button onClick={handleWhatsApp} className="py-2.5 rounded-xl bg-[#25D366]/10 text-[#25D366] text-xs font-semibold cursor-pointer hover:bg-[#25D366]/20 transition-colors">
              {r.whatsapp}
            </button>
            <button onClick={handleX} className="py-2.5 rounded-xl bg-bg2 text-text2 text-xs font-semibold cursor-pointer hover:bg-border transition-colors">
              {r.shareX}
            </button>
            <button onClick={handleInstagram} className="py-2.5 rounded-xl bg-[#E1306C]/10 text-[#E1306C] text-xs font-semibold cursor-pointer hover:bg-[#E1306C]/20 transition-colors">
              {r.shareInstagram}
            </button>
            <button
              onClick={handleCopy}
              className={`py-2.5 rounded-xl text-xs font-semibold cursor-pointer transition-colors ${
                copied ? 'bg-success/10 text-success' : 'bg-bg2 text-text2 hover:bg-border'
              }`}
            >
              {copied ? r.copied : r.copy}
            </button>
            <button onClick={handleShare} className="py-2.5 rounded-xl bg-primary/10 text-primary text-xs font-semibold cursor-pointer hover:bg-primary/20 transition-colors col-span-2">
              {r.moreOptions}
            </button>
          </div>
        </div>

        {/* Bottom actions */}
        <div className="flex flex-col gap-3 pb-4">
          <button
            onClick={() => navigate('/home')}
            className="w-full py-4 bg-primary hover:bg-primary-dark text-white font-semibold text-lg rounded-2xl transition-colors cursor-pointer active:scale-[0.98] flex items-center justify-center gap-2"
          >
            {r.anotherCategory} <span className="text-white/70">→</span>
          </button>
          <button
            onClick={() => navigate('/home')}
            className="w-full py-2 text-sm text-text3 hover:text-text2 font-medium transition-colors cursor-pointer"
          >
            {r.backHome}
          </button>
        </div>
      </div>
    </div>
  );
}
