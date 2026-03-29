/**
 * FreeLearnDialog — Écran de dialogue IA avant la session "Apprenons ensemble".
 * Collecte : sujet, niveau, aspect, objectif → crée la session → lance la session.
 */

import { useState, useEffect, useRef } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useLang } from '../context/LangContext';
import { addFreeLearnSession, sessionExists } from '../data/sessionStore';
import { addJournalEntry } from '../data/journalStore';
import HomeButton from '../components/HomeButton';
import BackButton from '../components/BackButton';
import ThemeToggle from '../components/ThemeToggle';

const LEVELS = [
  { key: 'débutant', label: 'Débutant', desc: 'je ne sais presque rien' },
  { key: 'notions', label: 'Quelques notions', desc: "j'en ai entendu parler" },
  { key: 'intermédiaire', label: 'Intermédiaire', desc: 'je connais les bases' },
];

const ASPECTS = [
  { key: 'faits et dates clés', label: 'Les faits et dates clés' },
  { key: 'concepts et idées', label: 'Les concepts et idées' },
  { key: 'personnages et figures', label: 'Les personnages et figures' },
  { key: 'tout à la fois', label: 'Tout à la fois' },
];

const GOALS = [3, 5, 7, 9];

// Messages de l'IA pour chaque étape
const AI_QUESTIONS = [
  'Bonjour ! Sur quel sujet souhaitez-vous apprendre quelque chose aujourd\'hui ? Soyez aussi précis que possible.',
  'Quel est votre niveau actuel sur ce sujet ?',
  'Quel aspect vous intéresse le plus ?',
  'Combien de nouvelles choses voulez-vous apprendre aujourd\'hui ?',
];

export default function FreeLearnDialog() {
  const { t } = useLang();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const isAddSession = searchParams.get('addSession') === 'true';

  // Données collectées
  const [topic, setTopic]   = useState('');
  const [level, setLevel]   = useState('');
  const [aspect, setAspect] = useState('');
  const [goal, setGoal]     = useState(5);

  // UI chat
  const [messages, setMessages]   = useState([{ role: 'ai', text: AI_QUESTIONS[0] }]);
  const [step, setStep]           = useState(0);  // 0=topic, 1=level, 2=aspect, 3=goal, 4=summary
  const [inputText, setInputText] = useState('');
  const [confirmed, setConfirmed] = useState(false);

  const bottomRef = useRef(null);
  const inputRef  = useRef(null);

  // Auto-scroll to bottom on new message
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // Focus input on text step
  useEffect(() => {
    if (step === 0) inputRef.current?.focus();
  }, [step]);

  function addMessage(role, text) {
    setMessages((prev) => [...prev, { role, text }]);
  }

  // Étape 0 : l'utilisateur soumet le sujet (texte libre)
  const handleTopicSubmit = () => {
    const trimmed = inputText.trim();
    if (!trimmed) return;
    setTopic(trimmed);
    setInputText('');
    addMessage('user', trimmed);
    setTimeout(() => addMessage('ai', AI_QUESTIONS[1]), 400);
    setStep(1);
  };

  // Étape 1 : sélection du niveau
  const handleLevelSelect = (l) => {
    setLevel(l.key);
    addMessage('user', `${l.label} — ${l.desc}`);
    setTimeout(() => addMessage('ai', AI_QUESTIONS[2]), 400);
    setStep(2);
  };

  // Étape 2 : sélection de l'aspect
  const handleAspectSelect = (a) => {
    setAspect(a.key);
    addMessage('user', a.label);
    setTimeout(() => addMessage('ai', AI_QUESTIONS[3]), 400);
    setStep(3);
  };

  // Étape 3 : sélection de l'objectif
  const handleGoalSelect = (g) => {
    setGoal(g);
    addMessage('user', `${g} nouvelles choses`);
    const summary = buildSummary(topic, level, aspect, g);
    setTimeout(() => {
      addMessage('ai', summary);
      setStep(4);
    }, 400);
  };

  function buildSummary(t, l, a, g) {
    return `Parfait ! Je vais vous poser des questions sur "${t}", niveau ${l}, en me concentrant sur "${a}". Objectif : ${g} nouvelles choses apprises. C'est bien ça ?`;
  }

  // Étape 4 : confirmation
  const handleConfirm = () => {
    setConfirmed(true);
    addMessage('user', 'Oui, c\'est parti !');

    const sessionId = addFreeLearnSession(topic, level, aspect, goal);
    addJournalEntry({ type: 'newSession', category: 'freelearn', sub: topic });

    setTimeout(() => {
      navigate(
        `/session?category=freelearn&sub=${encodeURIComponent(topic)}&topic=${encodeURIComponent(topic)}&level=${encodeURIComponent(level)}&aspect=${encodeURIComponent(aspect)}&count=${goal}&difficulty=auto`
      );
    }, 300);
  };

  const handleModify = () => {
    setTopic(''); setLevel(''); setAspect(''); setGoal(5); setInputText('');
    setMessages([{ role: 'ai', text: AI_QUESTIONS[0] }]);
    setStep(0);
    setConfirmed(false);
  };

  return (
    <div className="min-h-dvh bg-bg flex flex-col">
      <div className="max-w-lg mx-auto w-full flex flex-col flex-1">

        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-border">
          <div className="flex items-center gap-2">
            <BackButton />
            <HomeButton />
            <span className="text-xl">🎯</span>
            <span className="text-base font-bold text-text">
              {t.categories?.freelearn || 'Apprenons ensemble'}
            </span>
          </div>
          <ThemeToggle />
        </div>

        {/* Chat area */}
        <div className="flex-1 overflow-y-auto px-5 py-5 flex flex-col gap-3">
          {messages.map((msg, i) => (
            <div
              key={i}
              className={`flex ${msg.role === 'ai' ? 'justify-start' : 'justify-end'}`}
            >
              <div
                className={`max-w-[82%] px-4 py-3 rounded-2xl text-sm leading-relaxed ${
                  msg.role === 'ai'
                    ? 'bg-bg2 text-text border border-border rounded-tl-sm'
                    : 'bg-primary text-white rounded-tr-sm'
                }`}
              >
                {msg.text}
              </div>
            </div>
          ))}

          {/* Boutons selon l'étape courante */}
          {step === 1 && (
            <div className="flex flex-col gap-2 mt-1">
              {LEVELS.map((l) => (
                <button
                  key={l.key}
                  onClick={() => handleLevelSelect(l)}
                  className="w-full text-left px-4 py-3 rounded-xl border-2 border-border bg-card hover:border-primary/40 hover:bg-primary/[0.03] transition-all cursor-pointer active:scale-[0.98]"
                >
                  <span className="font-semibold text-sm text-text">{l.label}</span>
                  <span className="text-xs text-text3 ml-2">— {l.desc}</span>
                </button>
              ))}
            </div>
          )}

          {step === 2 && (
            <div className="flex flex-col gap-2 mt-1">
              {ASPECTS.map((a) => (
                <button
                  key={a.key}
                  onClick={() => handleAspectSelect(a)}
                  className="w-full text-left px-4 py-3 rounded-xl border-2 border-border bg-card hover:border-primary/40 hover:bg-primary/[0.03] transition-all cursor-pointer active:scale-[0.98]"
                >
                  <span className="font-semibold text-sm text-text">{a.label}</span>
                </button>
              ))}
            </div>
          )}

          {step === 3 && (
            <div className="flex gap-3 mt-1">
              {GOALS.map((g) => (
                <button
                  key={g}
                  onClick={() => handleGoalSelect(g)}
                  className="flex-1 py-4 rounded-xl border-2 border-border bg-card hover:border-primary/40 font-bold text-xl text-text transition-all cursor-pointer active:scale-[0.98] hover:bg-primary/[0.03]"
                >
                  {g}
                </button>
              ))}
            </div>
          )}

          {step === 4 && !confirmed && (
            <div className="flex gap-3 mt-2">
              <button
                onClick={handleModify}
                className="flex-1 py-3 rounded-xl border-2 border-border text-text2 text-sm font-semibold cursor-pointer hover:bg-bg2 transition-colors"
              >
                Non, modifier
              </button>
              <button
                onClick={handleConfirm}
                className="flex-1 py-3 rounded-xl bg-primary text-white text-sm font-semibold cursor-pointer hover:bg-primary-dark transition-colors active:scale-[0.98]"
              >
                Oui, c'est parti ! →
              </button>
            </div>
          )}

          <div ref={bottomRef} />
        </div>

        {/* Input texte — uniquement à l'étape 0 */}
        {step === 0 && (
          <div className="px-5 pb-5 pt-3 border-t border-border">
            <div className="flex gap-2">
              <input
                ref={inputRef}
                type="text"
                value={inputText}
                onChange={(e) => setInputText(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleTopicSubmit()}
                placeholder="ex: La Révolution française, Les bases de la guitare..."
                className="flex-1 px-4 py-3 rounded-xl border-2 border-border bg-bg2 text-sm text-text outline-none focus:border-primary/40 transition-colors"
              />
              <button
                onClick={handleTopicSubmit}
                disabled={!inputText.trim()}
                className={`px-5 py-3 rounded-xl font-semibold text-sm transition-colors ${
                  inputText.trim()
                    ? 'bg-primary text-white cursor-pointer hover:bg-primary-dark active:scale-[0.98]'
                    : 'bg-border text-text3 cursor-not-allowed'
                }`}
              >
                Envoyer →
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
