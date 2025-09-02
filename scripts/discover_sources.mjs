// Автопоиск источников событий Буэнос-Айреса
// DuckDuckGo + seed-домены + парс ссылок, всё с фолбэком на r.jina.ai
import fs from 'fs';
import path from 'path';
import fetch from 'node-fetch';
import { JSDOM } from 'jsdom';
import OpenAI from 'openai';

const ROOT = process.cwd();
const OUT_SOURCES = path.join(ROOT, 'data', 'event_sources.txt');

const openaiKey = process.env.OPENAI_API_KEY || '';
const oai = openaiKey ? new OpenAI({ apiKey: openaiKey }) : null;

const UA = 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36 events-bot/1.1';

// надёжные seed-домены
const SEED_DOMAINS = [
  'https://www.buenosaires.gob.ar',
  'https://vivamoscultura.buenosaires.gob.ar',
  'https://www.cck.gob.ar',
  'https://usinadelarte.org',
  'https://www.centroculturalrecoleta.org',
  'https://www.teatrocolon.org.ar',
  'https://complejoteatral.gob.ar',
  'https://www.konex.org',
  'https://www.malba.org.ar',
];

const COMMON_PATHS = [
  '/agenda','/eventos','/events','/calendario','/actividades','/cartelera','/programacion',
  '/agenda/','/eventos/','/events/','/calendario/','/actividades/','/cartelera/','/programacion/',
  '/feed','/rss','/events/rss','/rss.xml','/feed.xml','/calendar.ics','/calendario.ics','/ical','/ics'
];

function keep(u) {
  try {
    const url = new URL(u);
    const bad = ['facebook.com','instagram.com','twitter.com','x.com','t.me','wa.me','youtube.com','linkedin.com','tripadvisor','booking'];
    if (bad.some(b => url.hostname.includes(b))) return false;
    const ok = /\.ar$/.test(url.hostname) || /buenosaires|caba|gob\.ar|konex|malba|cck|recoleta|usinadelarte|colon|complejoteatral/i.test(url.hostname);
    return ok;
  } catch { return false; }
}

// универсальный fetch с ретраями и прокси-ридером
async function fetchText(url, {maxBytes = 500_000} = {}) {
  const tryOnce = async (u) => {
    const r = await fetch(u, { headers: { 'User-Agent': UA } });
    const buf = await r.arrayBuffer();
    const slice = Buffer.from(buf).slice(0, maxBytes).toString('utf8');
    return slice;
  };
  try {
    return await tryOnce(url);
  } catch (e1) {
    // попытка через r.jina.ai
    try {
      const proxied = `https://r.jina.ai/${url}`;
      return await tryOnce(proxied);
    } catch (e2) {
      return ''; // сдаёмся
    }
  }
}

async function ddg(query, n = 12) {
  const url = `https://duckduckgo.com/html/?q=${encodeURIComponent(query)}&kl=wt-wt&ia=web`;
  const html = await fetchText(url);
  const dom = new JSDOM(html);
  const links = [...dom.window.document.querySelectorAll('a.result__a')].map(a => a.href);
  const extra = [...dom.window.document.querySelectorAll('a[href^="http"]')].map(a => a.href);
  return [...new Set([...links, ...extra])].slice(0, n * 3);
}

async function probeVariants(base) {
  const out = new Set();
  for (const p of COMMON_PATHS) {
    try {
      const u = new URL(p, base).toString();
      const html = await fetchText(u, {maxBytes: 50_000});
      if (html && html.length > 0) out.add(u);
    } catch {}
  }
  return [...out];
}

async function findFeedsOnPage(u) {
  const html = await fetchText(u);
  if (!html) return [];
  const dom = new JSDOM(html);
  const doc = dom.window.document;
  const found = new Set();

  doc.querySelectorAll('link[rel="alternate"]').forEach(l => {
    const type = (l.getAttribute('type') || '').toLowerCase();
    const href = l.getAttribute('href') || '';
    if ((type.includes('rss') || type.includes('atom')) && href) found.add(new URL(href, u).toString());
  });

  [...doc.querySelectorAll('a[href*=".ics"]')].forEach(a => {
    const href = a.getAttribute('href'); if (href) found.add(new URL(href, u).toString());
  });

  [...doc.querySelectorAll('a[href]')]
    .map(a => a.getAttribute('href'))
    .filter(h => h && /agenda|events|eventos|calendar|calendario|actividades|programacion|cartelera/i.test(h))
    .map(h => new URL(h, u).toString())
    .forEach(x => found.add(x));

  return [...found];
}

async function rankWithGPT(candidates) {
  if (!oai) return candidates.slice(0, 40);
  const prompt = `
Оставь до 40 URL с регулярными СОБЫТИЯМИ Буэнос-Айреса (AR):
agenda/eventos/calendar/cartelera/actividades/programacion либо прямые RSS/ICS.
Исключи соцсети и нерелевантные. Верни ТОЛЬКО список URL, по одному в строке.
${candidates.map(u => '- ' + u).join('\n')}
  `.trim();

  const resp = await oai.chat.completions.create({
    model: 'gpt-4o-mini',
    messages: [{ role: 'user', content: prompt }],
    temperature: 0.1,
  });

  const text = resp.choices[0]?.message?.content || '';
  const urls = text.split(/\s+/).filter(s => /^https?:\/\//i.test(s));
  return [...new Set(urls)].slice(0, 40);
}

async function main() {
  const baseSet = new Set();

  for (const d of SEED_DOMAINS) {
    baseSet.add(d);
    const variants = await probeVariants(d);
    variants.forEach(v => baseSet.add(v));
  }

  const queries = [
    'site:buenosaires.gob.ar agenda eventos',
    'Buenos Aires agenda cultural',
    'Buenos Aires eventos calendario',
    'Buenos Aires conciertos agenda',
    'Buenos Aires teatro agenda',
    'Buenos Aires feria mercado agenda',
    'agenda Palermo CABA eventos',
  ];
  for (const q of queries) {
    const list = (await ddg(q, 12)).filter(keep);
    list.forEach(u => baseSet.add(u));
    for (const u of list.slice(0, 10)) {
      const variants = await probeVariants(u);
      variants.forEach(v => baseSet.add(v));
    }
  }

  const feedish = new Set();
  for (const u of [...baseSet].slice(0, 80)) {
    const sub = await findFeedsOnPage(u);
    sub.filter(keep).forEach(x => feedish.add(x));
    feedish.add(u);
  }

  const ranked = await rankWithGPT([...feedish]);
  const finalList = (ranked.length ? ranked : [...baseSet]).slice(0, 80);

  const dir = path.join(ROOT, 'data');
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(OUT_SOURCES, finalList.join('\n') + '\n');

  console.log(`Saved ${finalList.length} source URL(s) to ${OUT_SOURCES}`);
}

main().catch(e => { console.error(e); process.exit(1); });
