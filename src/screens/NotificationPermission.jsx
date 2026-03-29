import { useNavigate } from 'react-router-dom';
import { useLang } from '../context/LangContext';
import { requestPermission, declinePermission } from '../data/notificationStore';
import ThemeToggle from '../components/ThemeToggle';

export default function NotificationPermission() {
  const { t } = useLang();
  const navigate = useNavigate();
  const n = t.notifications;

  const handleAccept = async () => {
    await requestPermission();
    navigate('/home', { replace: true });
  };

  const handleDecline = () => {
    declinePermission();
    navigate('/home', { replace: true });
  };

  return (
    <div className="min-h-dvh bg-bg flex flex-col">
      <div className="flex justify-end px-6 pt-5">
        <ThemeToggle />
      </div>
      <div className="flex-1 flex flex-col items-center justify-center px-8 max-w-lg mx-auto w-full -mt-10">
        {/* Bell icon */}
        <div className="w-24 h-24 rounded-full bg-primary/10 flex items-center justify-center mb-6">
          <span className="text-5xl">🔔</span>
        </div>

        {/* Title */}
        <h1 className="text-2xl font-bold text-text text-center mb-3">
          {n.permissionTitle}
        </h1>

        {/* Message */}
        <p className="text-sm text-text2 text-center leading-relaxed max-w-xs mb-10">
          {n.permissionMessage}
        </p>

        {/* Buttons */}
        <div className="w-full flex flex-col gap-3">
          <button
            onClick={handleAccept}
            className="w-full py-4 bg-primary hover:bg-primary-dark text-white font-semibold text-lg rounded-2xl transition-colors cursor-pointer active:scale-[0.98]"
          >
            {n.acceptButton}
          </button>
          <button
            onClick={handleDecline}
            className="w-full py-3 text-sm text-text3 hover:text-text2 font-medium transition-colors cursor-pointer"
          >
            {n.declineButton}
          </button>
        </div>
      </div>
    </div>
  );
}
