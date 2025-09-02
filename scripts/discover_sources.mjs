// Автопоиск источников событий Буэнос-Айреса (с "seed" списком) + DuckDuckGo + GPT
import fs from 'fs';
import path from 'path';
import fetch from 'node-fetch';
import { JSDOM } from 'jsdom';
import OpenAI from 'openai';

const ROOT = process.cwd();
const OUT_SOURCES = path.join(ROOT, 'data', 'event_sources.txt');

const openaiKey = process.env.OPENAI_API_KEY || '';
const oai = openaiKey ? new OpenAI({ apiKey: openaiKey }) : null;

// --- 1) Надёжные SEED-домены города (agenda/eventos у учреждений) ---
const SEED_DOMAINS = [
  'https://www.buenosaires.gob.ar',              // GCBA
  'https://www.cck.gob.ar',                      // Centro Cultural Kirchner
  'https://usinadelarte.org',                    // Usina del Arte
  'https://www.centroculturalrecoleta.org',     // CCR
  'https://www.teatrocolon.org.ar',             // Teatro Colón
  'https://complejoteatral.gob.ar',             // Complejo Teatral (San Martín и др.)
  'https://www.konex.org',                       // Ciudad Cultural Konex
  'https://www.malba.org.ar',                    // MALBA
  'https://buenosaires.gob.ar/cultura',         // GCBA Cultura
  'https://vivamoscultura.buenosaires.gob.ar',  // Портал событий BA
];

// К типичным путям добавляем и RSS/ICS варианты
const COMMON_PATHS = [
  '/agenda','/agenda/','/eventos','/eventos/','/events','/events/','/calendario','/calendario/',
  '/actividades','/actividades/','/cartelera','/cartelera/','/programacion','/programacion/',
  '/feed','/rss','/events/rss','/rss.xml','/feed.xml','/calendar.ics','/calendario.ics','/ical','/ics'
];

// --- 2) DuckDuckGo как дополнение ---
async function ddg(query, n = 12) {
  const url = `https://duckduckgo.com/html/?q=${encodeURIComponent(query)}&kl=wt-wt&ia=web`;
  const res = await fetch(url, { headers: { 'User-Agent': 'events-bot/1.0' } });
  const html = await res.text();
  const dom = new JSDOM(html);
  const links = [...dom.window.document.querySelectorAll('a.result__a')].map(a => a.href);
  const extra = [...dom.window.document.querySelectorAll('a[href^="http"]')].map(a => a.href);
  return [...new Set([...links, ...extra])].slice(0, n * 3);
}

function keep(u) {
  try {
    const url = new URL(u);
    const bad = ['facebook.com','instagram.com','twitter.com','x.com','t.me','wa.me','youtube.com','linkedin.com','tripadvisor','booking'];
    if (bad.some(b => url.hostname.includes(b))) return false;
    // только аргентина/локальные сайты
    const okHost = /\.ar$/.test(url.hostname) || /buenosaires|caba|gob\.ar|konex|malba|cck|recoleta|usinadelarte|colon|complejoteatral/i.test(url.hostname);
    return okHost;
  } catch { return false; }
}

async function probeVariants(base) {
  const out = new Set();
  for (const p of COMMON_PATHS) {
    try {
      const u = new URL(p, base).toString();
      const r = await fetch(u, { method: 'HEAD' }).catch(()=>null);
      if (r && (r.ok || r.status === 405)) out.add(u); // HEAD может быть запрещён → 405 ок
    } catch {}
  }
  return [...out];
}

async function findFeedsOnPage(u) {
  try {
    const res = await fetch(u, { headers: { 'User-Agent': 'events-bot/1.0' } });
    const html = await res.text();
    const dom = new JSDOM(html);
    const doc = dom.window.document;
    const found = new Set();

    // RSS/Atom
    doc.querySelectorAll('link[rel="alternate"]').forEach(l => {
      const type = (l.getAttribute('type') || '').toLowerCase();
      const href = l.getAttribute('href') || '';
      if ((type.includes('rss') || type.includes('atom')) && href) found.add(new URL(href, u).toString());
    });

    // ICS
    [...doc.querySelectorAll('a[href*=".ics"]')].forEach(a => {
      const href = a.getAttribute('href'); if (href) found.add(new URL(href, u).toString());
    });

    // ссылки на agenda/eventos
    [...doc.querySelectorAll('a[href]')]
      .map(a => a.getAttribute('href'))
      .filter(h => h && /agenda|events|eventos|calendar|calendario|actividades|programacion|cartelera/i.test(h))
      .map(h => new URL(h, u).toString())
      .forEach(x => found.add(x));

    return [...found];
  } catch {
    return [];
  }
}

async function rankWithGPT(candidates) {
  if (!oai) return candidates.slice(0, 40);
  const prompt = `
Отфильтруй и оставь до 40 лучших URL, где регулярно публикуются СОБЫТИЯ Буэнос-Айреса (AR):
agenda / eventos / calendar / programación / cartelera / actividades или прямые RSS/ICS.
Исключи соцсети и нерелевантные.
Верни ТОЛЬКО список URL, по одному в строке.
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

  // 1) жёсткие seed-домены + их типовые пути
  for (const d of SEED_DOMAINS) {
    baseSet.add(d);
    const variants = await probeVariants(d);
    variants.forEach(v => baseSet.add(v));
  }

  // 2) DuckDuckGo
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
    // также пробуем варианты путей
    for (const u of list.slice(0, 10)) {
      const variants = await probeVariants(u);
      variants.forEach(v => baseSet.add(v));
    }
  }

  // 3) С самих страниц ищем RSS/ICS/внутренние agenda
  const feedish = new Set();
  for (const u of [...baseSet].slice(0, 60)) { // не уходить слишком глубоко
    const sub = await findFeedsOnPage(u);
    sub.filter(keep).forEach(x => feedish.add(x));
    feedish.add(u);
  }

  // 4) GPT ранжирование (или без GPT — срез)
  const ranked = await rankWithGPT([...feedish]);

  // 5) Гарантированный fallback: если пусто, берём хотя бы seed-варианты
  const finalList = ranked.length ? ranked : [...baseSet];

  // Сохраняем
  const dir = path.join(ROOT, 'data');
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  const text = finalList.join('\n') + '\n';
  fs.writeFileSync(OUT_SOURCES, text);

  console.log(`Saved ${finalList.length} source URL(s) to ${OUT_SOURCES}`);
}

main().catch(e => { console.error(e); process.exit(1); });
