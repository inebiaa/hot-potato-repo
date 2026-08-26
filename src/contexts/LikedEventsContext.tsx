import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from 'react';
import { useAuth } from './AuthContext';
import { fetchLikedEventIds, toggleLikedEvent } from '../lib/userLists';

type LikedEventsContextValue = {
  isLiked: (eventId: string) => boolean;
  setLiked: (eventId: string, liked: boolean) => void;
  toggleLiked: (eventId: string) => Promise<{ liked: boolean; error: Error | null }>;
};

const LikedEventsContext = createContext<LikedEventsContextValue | null>(null);

export function LikedEventsProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const [likedIds, setLikedIds] = useState<Set<string>>(new Set());

  useEffect(() => {
    if (!user?.id) {
      setLikedIds(new Set());
      return;
    }
    let cancelled = false;
    void fetchLikedEventIds(user.id).then((ids) => {
      if (!cancelled) setLikedIds(ids);
    });
    return () => {
      cancelled = true;
    };
  }, [user?.id]);

  const isLiked = useCallback((eventId: string) => likedIds.has(eventId), [likedIds]);

  const setLiked = useCallback((eventId: string, liked: boolean) => {
    setLikedIds((prev) => {
      const next = new Set(prev);
      if (liked) next.add(eventId);
      else next.delete(eventId);
      return next;
    });
  }, []);

  const toggleLiked = useCallback(
    async (eventId: string) => {
      if (!user?.id) {
        return { liked: false, error: new Error('signed out') };
      }
      const prev = likedIds.has(eventId);
      setLiked(eventId, !prev);
      const { liked, error } = await toggleLikedEvent(user.id, eventId, prev);
      if (error) setLiked(eventId, prev);
      else setLiked(eventId, liked);
      return { liked, error };
    },
    [user?.id, likedIds, setLiked],
  );

  return (
    <LikedEventsContext.Provider value={{ isLiked, setLiked, toggleLiked }}>
      {children}
    </LikedEventsContext.Provider>
  );
}

export function useLikedEvents(): LikedEventsContextValue {
  const ctx = useContext(LikedEventsContext);
  if (!ctx) throw new Error('useLikedEvents requires LikedEventsProvider');
  return ctx;
}
