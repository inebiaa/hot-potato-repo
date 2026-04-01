import { Routes, Route } from 'react-router-dom';
import App from './App';

/**
 * Same app shell for `/` and `/event/:eventId` so deep links and JSON-LD share one tree.
 */
export default function AppRoutes() {
  return (
    <Routes>
      <Route path="/" element={<App />} />
      <Route path="/event/:eventId" element={<App />} />
    </Routes>
  );
}
