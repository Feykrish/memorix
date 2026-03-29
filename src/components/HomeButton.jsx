import { useNavigate } from 'react-router-dom';

export default function HomeButton() {
  const navigate = useNavigate();
  return (
    <button
      onClick={() => navigate('/home')}
      className="shrink-0 w-9 h-9 rounded-xl bg-card border border-border flex items-center justify-center cursor-pointer hover:bg-bg2 transition-colors"
      title="Home"
    >
      <span className="text-base">🏠</span>
    </button>
  );
}
