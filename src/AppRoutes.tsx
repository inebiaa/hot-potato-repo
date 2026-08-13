import { Routes, Route } from 'react-router-dom';
import App from './App';

/**
 * Single App instance for `/`, `/event/:eventId`, `/:handle/list/:listId`, and `/:handle`.
 * Separate sibling routes remount App on every open/close and wipe in-memory state.
 */
export default function AppRoutes() {
  return (
    <Routes>
      <Route element={<App />}>
        <Route path="/" />
        <Route path="/event/:eventId" />
        <Route path="/:handle/list/:listId" />
        {/* Legacy shared-list path; App redirects to /:handle/list/:listId */}
        <Route path="/list/:listId" />
        <Route path="/:handle" />
      </Route>
    </Routes>
  );
}
