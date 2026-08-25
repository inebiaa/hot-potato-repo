import { useEffect } from 'react';
import { useLocation, useNavigate, useParams, useSearchParams } from 'react-router-dom';

/** Rewrite legacy `/?event=` and `/?list=` links to canonical routes. */
export function useLegacyHomeRedirects() {
  const navigate = useNavigate();
  const params = useParams();
  const location = useLocation();
  const [searchParams] = useSearchParams();

  useEffect(() => {
    const q = searchParams.get('event');
    if (!q || params.eventId) return;
    if (location.pathname !== '/') return;
    const next = new URLSearchParams(searchParams);
    next.delete('event');
    const qs = next.toString();
    navigate(`/event/${q}${qs ? `?${qs}` : ''}`, { replace: true });
  }, [location.pathname, searchParams, params.eventId, navigate]);

  useEffect(() => {
    const q = searchParams.get('list');
    if (!q || params.listId) return;
    if (location.pathname !== '/') return;
    const next = new URLSearchParams(searchParams);
    next.delete('list');
    const qs = next.toString();
    navigate(`/list/${q}${qs ? `?${qs}` : ''}`, { replace: true });
  }, [location.pathname, searchParams, params.listId, navigate]);
}
