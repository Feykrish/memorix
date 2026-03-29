import { useNavigate } from 'react-router-dom';
import { useLang } from '../context/LangContext';
import LangSelector from '../components/LangSelector';
import ThemeToggle from '../components/ThemeToggle';

const blocks = [
  {
    key: 'block1',
    color: 'error',
    icon: (
      <svg viewBox="0 0 24 24" className="w-6 h-6" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
        <line x1="18" y1="6" x2="6" y2="18" />
        <line x1="6" y1="6" x2="18" y2="18" />
      </svg>
    ),
  },
  {
    key: 'block2',
    color: 'primary',
    icon: (
      <svg viewBox="0 0 24 24" className="w-6 h-6" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
        <path d="M1 4v6h6" />
        <path d="M3.51 15a9 9 0 1 0 2.13-9.36L1 10" />
      </svg>
    ),
  },
  {
    key: 'block3',
    color: 'success',
    icon: (
      <svg viewBox="0 0 24 24" className="w-6 h-6" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
        <polyline points="20 6 9 17 4 12" />
      </svg>
    ),
  },
  {
    key: 'block4',
    color: 'reminder',
    icon: (
      <svg viewBox="0 0 24 24" className="w-6 h-6" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
        <line x1="18" y1="20" x2="18" y2="10" />
        <line x1="12" y1="20" x2="12" y2="4" />
        <line x1="6" y1="20" x2="6" y2="14" />
      </svg>
    ),
  },
];

const colorMap = {
  error: { bg: 'bg-error/10', text: 'text-error' },
  primary: { bg: 'bg-primary/10', text: 'text-primary' },
  success: { bg: 'bg-success/10', text: 'text-success' },
  reminder: { bg: 'bg-reminder/10', text: 'text-reminder' },
};

export default function Onboarding() {
  const { t } = useLang();
  const navigate = useNavigate();
  const texts = t.onboarding;

  const handleStart = () => {
    navigate('/pick-categories');
  };

  return (
    <div className="min-h-dvh bg-bg flex flex-col">
      {/* Lang selector */}
      <div className="flex justify-end items-center gap-2 px-6 pt-5">
        <ThemeToggle />
        <LangSelector />
      </div>

      {/* Main content */}
      <div className="flex-1 flex flex-col items-center px-6 pt-8 pb-6 max-w-lg mx-auto w-full">
        {/* Logo */}
        <h1 className="text-4xl font-extrabold text-primary tracking-tight">
          {texts.logo}
        </h1>

        {/* Subtitle */}
        <p className="mt-2 text-text3 text-base font-medium">
          {texts.subtitle}
        </p>

        {/* Blocks */}
        <div className="mt-10 w-full flex flex-col gap-4">
          {blocks.map((block) => {
            const colors = colorMap[block.color];
            return (
              <div
                key={block.key}
                className="flex items-start gap-4 p-4 rounded-2xl bg-bg2 border border-border"
              >
                {/* Icon circle */}
                <div className={`shrink-0 w-11 h-11 rounded-xl ${colors.bg} ${colors.text} flex items-center justify-center`}>
                  {block.icon}
                </div>

                {/* Text */}
                <div className="min-w-0">
                  <h3 className="text-[15px] font-semibold text-text leading-snug">
                    {texts[`${block.key}Title`]}
                  </h3>
                  <p className="text-sm text-text3 mt-0.5 leading-relaxed">
                    {texts[`${block.key}Desc`]}
                  </p>
                </div>
              </div>
            );
          })}
        </div>

        {/* Spacer */}
        <div className="flex-1 min-h-8" />

        {/* CTA Button */}
        <button
          onClick={handleStart}
          className="w-full py-4 bg-primary hover:bg-primary-dark text-white font-semibold text-lg rounded-2xl transition-colors cursor-pointer active:scale-[0.98]"
        >
          {texts.start}
        </button>
      </div>
    </div>
  );
}
