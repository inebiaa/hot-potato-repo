import { Routes, Route } from 'react-router-dom';
import App from '../App';
import HomePage from '../pages/HomePage';
import SettingsRoutePage from '../pages/SettingsRoutePage';
import StatsRoutePage from '../pages/StatsRoutePage';
import ProfileRoutePage from '../pages/ProfileRoutePage';
import SharedListRoutePage from '../pages/SharedListRoutePage';
import ResetPasswordPage from '../pages/ResetPasswordPage';
import AccountDeletionPage from '../pages/AccountDeletionPage';

/**
 * Layout route (`App`) is chrome. Home catalog lives with home search/feed.
 * Each child is a real page. `/settings`, `/stats`, `/profile` stay above `/:handle`.
 */
export default function AppRoutes() {
  return (
    <Routes>
      <Route element={<App />}>
        <Route index element={<HomePage />} />
        <Route path="event/:eventId" element={<HomePage />} />
        <Route path="settings" element={<SettingsRoutePage />} />
        <Route path="stats" element={<StatsRoutePage />} />
        <Route path="reset-password" element={<ResetPasswordPage />} />
        <Route path="account-deletion" element={<AccountDeletionPage />} />
        <Route path="profile" element={<ProfileRoutePage />} />
        <Route path=":handle/list/:listId" element={<SharedListRoutePage />} />
        <Route path="list/:listId" element={<SharedListRoutePage />} />
        <Route path=":handle" element={<ProfileRoutePage />} />
      </Route>
    </Routes>
  );
}
