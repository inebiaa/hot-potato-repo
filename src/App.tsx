import { useState } from 'react';
import { Event } from './lib/supabase';
import { HomeCatalogProvider } from './contexts/HomeCatalogContext';
import AppShell from './layouts/AppShell';

function App() {
  const [profileBoardEvents, setProfileBoardEvents] = useState<Event[] | null>(null);
  return (
    <HomeCatalogProvider profileBoardEvents={profileBoardEvents}>
      <AppShell setProfileBoardEvents={setProfileBoardEvents} />
    </HomeCatalogProvider>
  );
}

export default App;
