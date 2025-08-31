/**
 * Ingest a place JSON from a GitHub Issue into data/places.js
 * Trigger: label "place:approved" on an issue (or workflow_dispatch).
 *
 * Expected issue body contains a fenced code block:
 * ```json
 * { ... place object ... }
 * ```
 *
 * Required fields: name, category, lat, lng
 * Optional: subtype, neighborhood, russian_score (0..5), peak_hours, instagram, website, phone, photo_url, address, place_id, notes, id
 */

const fs = require('fs');
const path = require('path');

const { REPO, ISSUE_NUMBER, GITHUB_TOKEN, TRIGGER } = process.env;
if (!REPO) exitFail('REPO missing');
const [owner, repo] = REPO.split('/');

const core = {
  async gh(pathname, init = {}) {
    const res = await fetch(`https://api.github.com${pathname}`, {
      ...init,
      headers: {
        'Authorization': `Bearer ${GITHUB_TOKEN}`,
        'Accept': 'application/vnd.github+json',
        ...init.headers,
      },
    });
    if (!res.ok) {
      const t = await res.text();
      throw new Error(`GitHub API ${pathname} -> ${res.status}: ${t}`);
    }
    return res.json();
  },
};

(async () => {
  let issue;
  if (TRIGGER === 'workflow_dispatch') {
    console.log('workflow_dispatch: skipping issue fetch; no automatic changes.');
    process.exit(0);
  }

  if (!ISSUE_NUMBER) exitFail('ISSUE_NUMBER missing');
  issue = await core.gh(`/repos/${owner}/${repo}/issues/${ISSUE_NUMBER}`);

  // Check label gate just in case
  const hasLabel = (issue.labels || []).some(l => l.name === 'place:approved');
  if (!hasLabel) {
    console.log('Issue has no label "place:approved" — skipping.');
    process.exit(0);
  }

  // Extract JSON block
  const body = issue.body || '';
  const json = extractJsonFromBody(body);
  if (!json) exitFail('No JSON code block found in issue body.');

  const place = validateAndNormalize(json);

  // Load current places
  const placesPath = path.join(process.cwd(), 'data', 'places.js');
  const text = fs.readFileSync(placesPath, 'utf8');
  const arr = readPlacesArray(text);

  // Upsert by place_id (preferred) or by name+coords
  let updated = false;

  const matchIndex = findExistingIndex(arr, place);
  if (matchIndex >= 0) {
    // Update existing (keep existing id unless issue provided explicit id)
    place.id = isFiniteNumber(place.id) ? Number(place.id) : arr[matchIndex].id;
    arr[matchIndex] = { ...arr[matchIndex], ...place };
    updated = true;
  } else {
    // Assign id
    const maxId = arr.reduce((m, p) => Math.max(m, Number(p.id || 0)), 0);
    place.id = isFiniteNumber(place.id) ? Number(place.id) : maxId + 1;
    arr.push(place);
  }

  // Sort by category, then name
  arr.sort((a, b) => {
    const c = (a.category || '').localeCompare(b.category || '');
    return c !== 0 ? c : (a.name || '').localeCompare(b.name || '');
  });

  // Write file back
  const out = 'window.PLACES = ' + JSON.stringify(arr, null, 2) + ';\n';
  fs.writeFileSync(placesPath, out, 'utf8');

  // Comment & close issue
  await core.gh(`/repos/${owner}/${repo}/issues/${ISSUE_NUMBER}/comments`, {
    method: 'POST',
    body: JSON.stringify({
      body: updated
        ? '✅ Обновлено существующее место в `data/places.js`.'
        : '✅ Добавлено новое место в `data/places.js`.',
    }),
  });
  await core.gh(`/repos/${owner}/${repo}/issues/${ISSUE_NUMBER}`, {
    method: 'PATCH',
    body: JSON.stringify({ state: 'closed' }),
  });

  console.log('Done.');
})().catch(err => exitFail(err.message));

function exitFail(msg) {
  console.error('ERROR:', msg);
  process.exit(1);
}

function extractJsonFromBody(body) {
  // Look for fenced code block ```json ... ```
  const re = /```json\s*([\s\S]*?)```/i;
  const m = body.match(re);
  if (!m) return null;
  try {
    return JSON.parse(m[1]);
  } catch (e) {
    exitFail('Invalid JSON in code block: ' + e.message);
  }
}

function validateAndNormalize(p) {
  const req = ['name', 'category', 'lat', 'lng'];
  for (const k of req) {
    if (p[k] === undefined || p[k] === null || String(p[k]).trim() === '') {
      exitFail(`Missing required field "${k}"`);
    }
  }
  const out = {
    id: p.id,
    name: String(p.name).trim(),
    category: String(p.category).trim(),
    subtype: safeStr(p.subtype),
    lat: Number(p.lat),
    lng: Number(p.lng),
    neighborhood: safeStr(p.neighborhood),
    russian_score: clamp(Number(p.russian_score ?? 0), 0, 5),
    peak_hours: safeStr(p.peak_hours),
    instagram: safeUrl(p.instagram),
    website: safeUrl(p.website),
    phone: safeStr(p.phone),
    photo_url: safeUrl(p.photo_url),
    address: safeStr(p.address),
    place_id: safeStr(p.place_id),
    notes: safeStr(p.notes),
  };
  if (!isFiniteNumber(out.lat) || !isFiniteNumber(out.lng)) {
    exitFail('lat/lng must be numbers');
  }
  return out;
}

function readPlacesArray(fileText) {
  const re = /window\.PLACES\s*=\s*(\[\s*[\s\S]*?\])\s*;/m;
  const m = fileText.match(re);
  if (!m) exitFail('Cannot find window.PLACES array in data/places.js');
  try {
    return JSON.parse(m[1]);
  } catch (e) {
    exitFail('Failed to parse places array: ' + e.message);
  }
}

function findExistingIndex(arr, place) {
  if (place.place_id) {
    const i = arr.findIndex(p => (p.place_id || '') === place.place_id);
    if (i >= 0) return i;
  }
  // fallback: name + close coords (~50m)
  const R = 0.0005; // ~55m in lat/lng at BA
  return arr.findIndex(p =>
    (p.name || '').toLowerCase() === place.name.toLowerCase() &&
    Math.abs(Number(p.lat) - place.lat) < R &&
    Math.abs(Number(p.lng) - place.lng) < R
  );
}

function isFiniteNumber(n){ return typeof n === 'number' && isFinite(n); }
function clamp(n, a, b){ return Math.max(a, Math.min(b, isFiniteNumber(n)?n:0)); }
function safeStr(v){ return v ? String(v).trim() : ""; }
function safeUrl(v){
  if (!v) return "";
  const s = String(v).trim();
  if (/^https?:\/\//i.test(s)) return s;
  // allow instagram shorthand like instagram.com/...
  if (/^[a-z0-9.-]+\.[a-z]{2,}/i.test(s)) return 'https://' + s;
  return s;
}
