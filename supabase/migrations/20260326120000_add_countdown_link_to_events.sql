-- Optional URL opened when the user clicks the countdown pill on an upcoming event card.
ALTER TABLE events ADD COLUMN IF NOT EXISTS countdown_link text;
