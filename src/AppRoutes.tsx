import { Routes, Route } from 'react-router-dom';
import App from './App';

/**
 * Single App instance for `/`, `/event/:eventId`, and `/:handle`.
 * Separate sibling routes remount App on every open/close and wipe in-memory state.
 */
export default function AppRoutes() {
  return (
    <Routes>
      <Route element={<App />}>
        <Route path="/" />
        <Route path="/event/:eventId" />
        <Route path="/:handle" />
      </Route>
    </Routes>
  );
}
