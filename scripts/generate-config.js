const fs = require('fs');
const path = require('path');

// Load a local .env file when present. Vercel-provided environment variables
// take precedence over values from .env.
const envPath = path.join(__dirname, '..', '.env');
if (fs.existsSync(envPath)) {
  const contents = fs.readFileSync(envPath, 'utf8');
  for (const line of contents.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const index = trimmed.indexOf('=');
    if (index < 1) continue;
    const key = trimmed.slice(0, index).trim();
    let value = trimmed.slice(index + 1).trim();
    if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
      value = value.slice(1, -1);
    }
    if (process.env[key] === undefined) process.env[key] = value;
  }
}

const config = {
  SUPABASE_URL: process.env.SUPABASE_URL,
  SUPABASE_KEY: process.env.SUPABASE_ANON_KEY || process.env.SUPABASE_PUBLISHABLE_KEY,
  TMDB_API_KEY: process.env.TMDB_API_KEY,
  TMDB_API: process.env.TMDB_API || 'https://api.themoviedb.org/3',
  TMDB_IMAGE: process.env.TMDB_IMAGE || 'https://image.tmdb.org/t/p/w500',
  TMDB_BACKDROP: process.env.TMDB_BACKDROP || 'https://image.tmdb.org/t/p/original'
};

const missing = ['SUPABASE_URL', 'SUPABASE_KEY', 'TMDB_API_KEY'].filter((key) => !config[key]);
if (missing.length) {
  console.error(`Missing required environment variable(s): ${missing.join(', ')}`);
  process.exit(1);
}

const output = `// Generated at build time from Vercel environment variables. Do not edit manually.\nwindow.NEWFLIX_CONFIG = ${JSON.stringify(config, null, 2)};\n`;
fs.writeFileSync(path.join(__dirname, '..', 'js', 'config.js'), output, 'utf8');
console.log('NewFlix browser configuration generated successfully.');
