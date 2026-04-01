import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import './index.css';
import { SUPABASE_URL, SUPABASE_ANON_KEY } from './config';

const supabaseUrl = SUPABASE_URL;
const supabaseAnonKey = SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  createRoot(document.getElementById('root')!).render(
    <div style={{
      padding: 40,
      fontFamily: 'system-ui, sans-serif',
      maxWidth: 560,
      margin: '0 auto',
      lineHeight: 1.6,
    }}>
      <h1 style={{ marginBottom: 16 }}>Setup required</h1>
      <p>Create a <code style={{ background: '#f0f0f0', padding: '2px 6px', borderRadius: 4 }}>.env</code> file in the project root with:</p>
      <pre style={{ background: '#1e1e1e', color: '#d4d4d4', padding: 16, borderRadius: 8, overflow: 'auto' }}>{`VITE_SUPABASE_URL=your_supabase_project_url
VITE_SUPABASE_ANON_KEY=your_supabase_anon_key`}</pre>
      <p>Get these from your <a href="https://supabase.com/dashboard" target="_blank" rel="noreferrer">Supabase dashboard</a> → Project Settings → API.</p>
      <p style={{ color: '#666' }}>Restart the dev server (<code>npm run dev</code>) after adding .env</p>
    </div>
  );
} else {
  import('./AppRoutes.tsx').then(({ default: AppRoutes }) => {
    import('./contexts/AuthContext').then(({ AuthProvider }) => {
      import('react-router-dom').then(({ BrowserRouter }) => {
        const raw = import.meta.env.BASE_URL || '/';
        const basename: string | undefined =
          raw === '/' || raw === './'
            ? undefined
            : raw.replace(/\/$/, '') || undefined;
        createRoot(document.getElementById('root')!).render(
          <StrictMode>
            <BrowserRouter basename={basename}>
              <AuthProvider>
                <AppRoutes />
              </AuthProvider>
            </BrowserRouter>
          </StrictMode>
        );
      });
    });
  });
}
