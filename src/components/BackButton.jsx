import { useNavigate } from 'react-router-dom';
import { useLang } from '../context/LangContext';

export default function BackButton() {
  const navigate = useNavigate();
  const { t } = useLang();
  return (
    <button
      onClick={() => navigate(-1)}
      className="shrink-0 flex items-center gap-1 text-sm font-medium text-text3 hover:text-primary transition-colors cursor-pointer"
      title={t.common?.back || 'Retour'}
    >
      <svg viewBox="0 0 24 24" className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
        <polyline points="15 18 9 12 15 6" />
      </svg>
      <span className="hidden sm:inline">{t.common?.back || 'Retour'}</span>
    </button>
  );
}
