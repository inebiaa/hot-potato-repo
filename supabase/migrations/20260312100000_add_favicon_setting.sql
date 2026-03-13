INSERT INTO app_settings (key, value) VALUES
  ('app_favicon_url', '')
ON CONFLICT (key) DO NOTHING;