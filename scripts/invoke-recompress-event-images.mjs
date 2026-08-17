#!/usr/bin/env node
/**
 * Invoke deployed recompress-event-images edge function until complete.
 */
const ANON = process.env.SUPABASE_ANON_KEY ||
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InVobGphZ3ptd25zcXBrYXNxZnluIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzIwNzUxMDEsImV4cCI6MjA4NzY1MTEwMX0.AHA56nDM0LGqNqpKAU7WzBtk6_ssq026zjoJHqNk-CQ';
const URL = (process.env.SUPABASE_URL || 'https://uhljagzmwnsqpkasqfyn.supabase.co').replace(/\/$/, '') +
  '/functions/v1/recompress-event-images';
const TOKEN = process.env.RECOMPRESS_TOKEN || 'sb-recompress-augl6-9k2m';
const LIMIT = Number(process.env.LIMIT || 20) || 20;
const DRY_RUN = process.env.DRY_RUN === '1';

async function runBatch(offset) {
  const res = await fetch(URL, {
    method: 'POST',
    headers: {
      apikey: ANON,
      Authorization: `Bearer ${ANON}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ token: TOKEN, offset, limit: LIMIT, dryRun: DRY_RUN }),
  });
  const text = await res.text();
  let data;
  try {
    data = JSON.parse(text);
  } catch {
    throw new Error(`HTTP ${res.status}: ${text.slice(0, 300)}`);
  }
  if (!res.ok) throw new Error(`HTTP ${res.status}: ${data.error || text}`);
  return data;
}

async function main() {
  let offset = 0;
  let batch = 0;
  let totalOk = 0;
  let totalSkip = 0;
  let totalErr = 0;
  let totalSaved = 0;

  for (;;) {
    batch += 1;
    const data = await runBatch(offset);
    totalOk += data.ok || 0;
    totalSkip += data.skip || 0;
    totalErr += data.error || 0;
    totalSaved += data.savedBytes || 0;
    console.log(
      `batch ${batch} offset ${offset}: total=${data.total} ok=${data.ok} skip=${data.skip} err=${data.error} savedKB=${Math.round((data.savedBytes || 0) / 1024)} next=${data.nextOffset}`,
    );
    if (data.nextOffset == null) break;
    offset = data.nextOffset;
    await new Promise((r) => setTimeout(r, 400));
  }

  console.log(
    `FINAL ok=${totalOk} skip=${totalSkip} err=${totalErr} savedMB=${(totalSaved / 1024 / 1024).toFixed(1)}`,
  );
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
