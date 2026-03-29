import { useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useLang } from '../context/LangContext';
import { categories } from '../data/categories';
import { findSessionByCategorySub, configureSession } from '../data/sessionStore';
import HomeButton from '../components/HomeButton';
import BackButton from '../components/BackButton';
import ThemeToggle from '../components/ThemeToggle';

const LEARN_GOALS = [3, 5, 7, 9];
const DIFFICULTIES = ['easy', 'medium', 'hard', 'auto'];

export default function SessionConfig() {
  const { t } = useLang();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();

  const category = searchParams.get('category') || '';
  const sub = searchParams.get('sub') || '';

  const [learnGoal, setLearnGoal] = useState(5);
  const [difficulty, setDifficulty] = useState('auto');

  const sc = t.sessionConfig;
  const cat = categories.find((c) => c.key === category);
  const categoryLabel = t.categories?.[category] || category;
  const subLabel = (() => {
    if (sub === 'ai-mix') return t.subcategoriesScreen?.aiMix || 'Mix';
    if (t.subcategories?.[category]?.[sub]) return t.subcategories[category][sub];
    return sub;
  })();

  const subtitle = (sc.subtitle || '').replace('{n}', learnGoal);

  const handleLaunch = () => {
    const session = findSessionByCategorySub(category, sub);
    if (session && !session.configured) {
      configureSession(session.id, learnGoal, difficulty);
    }
    navigate(`/session?category=${category}&sub=${sub}&count=${learnGoal}&difficulty=${difficulty}`);
  };

  return (
    <div className="min-h-dvh bg-bg flex flex-col">
      <div className="max-w-lg mx-auto w-full px-5 py-5 flex flex-col flex-1">
        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <div className="flex items-center gap-2">
            <BackButton />
            <HomeButton />
            <span className="text-xl">{cat?.emoji}</span>
            <div>
              <p className="text-base font-bold text-text">{categoryLabel}</p>
              <p className="text-xs text-text3">{subLabel}</p>
            </div>
          </div>
          <ThemeToggle />
        </div>

        {/* Title */}
        <h1 className="text-xl font-bold text-text mb-2">{sc.title}</h1>
        <p className="text-sm text-text3 mb-8">{subtitle}</p>

        {/* Learn goal selector */}
        <div className="mb-8">
          <p className="text-sm font-semibold text-text2 mb-3">{sc.learnGoal}</p>
          <div className="flex gap-2">
            {LEARN_GOALS.map((n) => (
              <button
                key={n}
                onClick={() => setLearnGoal(n)}
                className={`flex-1 py-4 rounded-xl font-bold text-xl transition-all cursor-pointer ${
                  learnGoal === n
                    ? 'bg-primary text-white shadow-lg shadow-primary/20 scale-105'
                    : 'bg-card border-2 border-border text-text hover:border-primary/30'
                }`}
              >
                {n}
              </button>
            ))}
          </div>
          <p className="text-xs text-text3 text-center mt-3">{subtitle}</p>
        </div>

        {/* Difficulty */}
        <div className="mb-8">
          <p className="text-sm font-semibold text-text2 mb-3">{sc.difficulty}</p>
          <div className="flex flex-col gap-2">
            {DIFFICULTIES.map((d) => (
              <button
                key={d}
                onClick={() => setDifficulty(d)}
                className={`w-full py-3 px-4 rounded-xl font-semibold text-sm text-left transition-all cursor-pointer flex items-center justify-between ${
                  difficulty === d
                    ? 'bg-primary text-white'
                    : 'bg-card border-2 border-border text-text hover:border-primary/30'
                }`}
              >
                <span>{sc[d]}</span>
                {d === 'auto' && (
                  <span className={`text-xs ${difficulty === 'auto' ? 'text-white/70' : 'text-text3'}`}>
                    {sc.autoDesc}
                  </span>
                )}
              </button>
            ))}
          </div>
        </div>

        <div className="flex-1 min-h-6" />

        {/* Launch */}
        <button
          onClick={handleLaunch}
          className="w-full py-4 bg-primary hover:bg-primary-dark text-white font-semibold text-lg rounded-2xl transition-colors cursor-pointer active:scale-[0.98]"
        >
          {sc.launch}
        </button>
      </div>
    </div>
  );
}
