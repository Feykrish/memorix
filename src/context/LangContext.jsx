import { createContext, useContext, useState } from 'react';
import { translations, detectLang, SUPPORTED_LANGS } from '../i18n';

const LangContext = createContext();

export function LangProvider({ children }) {
  const [lang, setLang] = useState(() => {
    const saved = localStorage.getItem('memorix-lang');
    if (saved && SUPPORTED_LANGS.some((l) => l.code === saved)) return saved;
    return detectLang();
  });

  const changeLang = (code) => {
    setLang(code);
    localStorage.setItem('memorix-lang', code);
  };

  const t = translations[lang];

  return (
    <LangContext.Provider value={{ lang, changeLang, t, SUPPORTED_LANGS }}>
      {children}
    </LangContext.Provider>
  );
}

export const useLang = () => useContext(LangContext);
