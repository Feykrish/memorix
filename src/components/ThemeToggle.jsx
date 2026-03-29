import { useTheme } from '../context/ThemeContext';

export default function ThemeToggle() {
  const { dark, toggleTheme } = useTheme();
  return (
    <button
      onClick={toggleTheme}
      className="w-9 h-9 rounded-xl bg-card border border-border flex items-center justify-center cursor-pointer hover:bg-bg2 transition-colors"
      title={dark ? 'Light mode' : 'Dark mode'}
    >
      <span className="text-base">{dark ? '☀️' : '🌙'}</span>
    </button>
  );
}
