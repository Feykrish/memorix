import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { LangProvider } from './context/LangContext';
import { ThemeProvider } from './context/ThemeContext';
import Onboarding from './screens/Onboarding';
import Home from './screens/Home';
import SubCategories from './screens/SubCategories';
import FreeLearnDialog from './screens/FreeLearnDialog';
import Session from './screens/Session';
import Results from './screens/Results';
import CategoryPicker from './screens/CategoryPicker';
import SessionConfig from './screens/SessionConfig';
import Journal from './screens/Journal';
import DailyErrors from './screens/DailyErrors';
import Settings from './screens/Settings';
import NotificationPermission from './screens/NotificationPermission';
import LanguagePicker from './screens/LanguagePicker';

// Migration: if user already has memorix-lang set, auto-mark langue_interface
// so existing users are not sent to the language picker
if (localStorage.getItem('memorix-lang') && !localStorage.getItem('langue_interface')) {
  localStorage.setItem('langue_interface', localStorage.getItem('memorix-lang'));
}

function AppRoutes() {
  const hasChosenLang = !!localStorage.getItem('langue_interface');
  const isOnboarded = localStorage.getItem('memorix-onboarded') === 'true';

  return (
    <Routes>
      <Route
        path="/"
        element={
          !hasChosenLang
            ? <Navigate to="/language-picker" replace />
            : isOnboarded
            ? <Navigate to="/home" replace />
            : <Navigate to="/onboarding" replace />
        }
      />
      <Route path="/language-picker" element={<LanguagePicker />} />
      <Route path="/onboarding" element={<Onboarding />} />
      <Route path="/home" element={<Home />} />
      <Route path="/subcategories/:categoryKey" element={<SubCategories />} />
      <Route path="/freelearn-dialog" element={<FreeLearnDialog />} />
      <Route path="/session" element={<Session />} />
      <Route path="/results" element={<Results />} />
      <Route path="/pick-categories" element={<CategoryPicker />} />
      <Route path="/session-config" element={<SessionConfig />} />
      <Route path="/journal" element={<Journal />} />
      <Route path="/daily-errors" element={<DailyErrors />} />
      <Route path="/settings" element={<Settings />} />
      <Route path="/notification-permission" element={<NotificationPermission />} />
    </Routes>
  );
}

export default function App() {
  return (
    <ThemeProvider>
      <LangProvider>
        <BrowserRouter>
          <AppRoutes />
        </BrowserRouter>
      </LangProvider>
    </ThemeProvider>
  );
}
