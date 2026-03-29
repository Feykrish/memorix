import { useState, useRef, useEffect } from 'react';
import { useLang } from '../context/LangContext';

export default function LangSelector() {
  const { lang, changeLang, SUPPORTED_LANGS } = useLang();
  const [open, setOpen] = useState(false);
  const ref = useRef(null);

  useEffect(() => {
    if (!open) return;
    const handleClick = (e) => {
      if (ref.current && !ref.current.contains(e.target)) setOpen(false);
    };
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, [open]);

  const current = SUPPORTED_LANGS.find((l) => l.code === lang);

  return (
    <div className="relative" ref={ref}>
      <button
        onClick={() => setOpen(!open)}
        className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl bg-gray-50 hover:bg-gray-100 transition-colors cursor-pointer text-sm"
      >
        <span className="text-base">{current.flag}</span>
        <span className="font-medium text-gray-600">{current.label}</span>
        <svg
          viewBox="0 0 20 20"
          fill="currentColor"
          className={`w-4 h-4 text-gray-400 transition-transform ${open ? 'rotate-180' : ''}`}
        >
          <path fillRule="evenodd" d="M5.23 7.21a.75.75 0 011.06.02L10 11.168l3.71-3.938a.75.75 0 111.08 1.04l-4.25 4.5a.75.75 0 01-1.08 0l-4.25-4.5a.75.75 0 01.02-1.06z" clipRule="evenodd" />
        </svg>
      </button>

      {open && (
        <div className="absolute right-0 top-full mt-1.5 bg-white rounded-xl shadow-lg border border-gray-100 overflow-hidden z-50 min-w-[160px]">
          {SUPPORTED_LANGS.map((l) => (
            <button
              key={l.code}
              onClick={() => { changeLang(l.code); setOpen(false); }}
              className={`w-full flex items-center gap-2.5 px-4 py-2.5 text-sm cursor-pointer transition-colors ${
                l.code === lang
                  ? 'bg-primary/5 text-primary font-semibold'
                  : 'text-gray-700 hover:bg-gray-50'
              }`}
            >
              <span className="text-base">{l.flag}</span>
              <span>{l.label}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
