// Fallback values when env vars aren't set (e.g. on hosted builds)
export const SUPABASE_URL =
  import.meta.env.VITE_SUPABASE_URL || 'https://uhljagzmwnsqpkasqfyn.supabase.co';
export const SUPABASE_ANON_KEY =
  import.meta.env.VITE_SUPABASE_ANON_KEY ||
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InVobGphZ3ptd25zcXBrYXNxZnluIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzIwNzUxMDEsImV4cCI6MjA4NzY1MTEwMX0.AHA56nDM0LGqNqpKAU7WzBtk6_ssq026zjoJHqNk-CQ';
