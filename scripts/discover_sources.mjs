// Автопоиск источников событий BA через DuckDuckGo + GPT
import fs from 'fs';
import path from 'path';
import fetch from 'node-fetch';
import { JSDOM } from 'jsdom';
import OpenAI from 'openai';

const ROOT = process.cwd();
const OUT_SOURCES = path.join(ROOT, 'data', 'event_sources.txt');

const openaiKey = process.env.OPENAI_API_KEY || '';
const oai = openaiKey ? new OpenAI({ apiKey: openaiKey }) : null;

// простейший HTML-поиск через DuckDuckGo (без API-ключа)
async function ddg(query, n = 10) {
  const url = `https://duckduckgo.com/html/?q=${encodeURIComponent(query)}&kl=wt-wt&ia=web`;
  const res = await fetch(url, { headers: { 'User-Agent': 'events-bot/1.0' } });
  const html = await res.text();
  const dom = new JSDOM(html);
  const links = [...dom.window.document.querySelectorAll('a.result__a')].map(a => a.href);
  // fallback: ещё ссылки
  const more = [...dom.window.document.querySelectorAll('a[href^="http"]')].map(a => a.href);
  const uniq = [...new Set([...links, ...more])].slice(0, n * 3);
  return uniq.slice(0, n * 3);
}

function keepDomain(u) {
  try {
    const url = new URL(u);
    // фильтруем бесполезное
    const bad = ['facebook.com','instagram.com','twitter.com','x.com','t.me','wa.me','youtube.com','linkedin.com','tripadvisor','booking'];
    if (bad.some(b => url.hostname.includes(b))) return false;
    return true;
  } catch { return false; }
}

async function findFeedsOnPage(u) {
  try {
    const res = await fetch(u, { headers: { 'User-Agent': 'events-bot/1.0' } });
    const html = await res.text();
    const dom = new JSDOM(html);
    const doc = dom.window.document;
    const found = new Set();

    // <link rel="alternate" type="application/rss+xml" ...>
    doc.querySelectorAll('link[rel="alternate"]').forEach(l => {
      const type = (l.getAttribute('type') || '').toLowerCase();
      const href = l.getAttribute('href') || '';
      if ((type.includes('rss') || type.includes('atom')) && href) found.add(new URL(href, u).toString());
    });

    // возможные .ics
    [...doc.querySelectorAll('a[href*=".ics"]')].forEach(a => {
      const href = a.getAttribute('href');
      if (href) found.add(new URL(href, u).toString());
    });

    // эвристика: /events, /agenda, /calendar
    const heur = [...doc.querySelectorAll('a[href]')]
      .map(a => a.getAttribute('href'))
      .filter(h => h && /agenda|events|eventos|calendar|calendario/i.test(h))
      .map(h => new URL(h, u).toString());
    return [...new Set([...found, ...heur])];
  } catch {
    return [];
  }
}

async function rankWithGPT(candidates) {
  if (!oai) return candidates.slice(0, 20);
  const prompt = `
Ты помощник по OSINT. Дано: список URL, связанных с Буэнос-Айресом (AR).
Цель: выбрать до 20 лучших источников регулярных СОБЫТИЙ (agenda, calendar, events, afisha) на испанском/английском/русском.
Отбрасывай соцсети и агрегаторы без календарей.
Верни ТОЛЬКО список URL, по одному в строке.
${candidates.map(u => '- ' + u).join('\n')}
  `.trim();

  const resp = await oai.chat.completions.create({
    model: 'gpt-4o-mini',
    messages: [{ role: 'user', content: prompt }],
    temperature: 0.2,
  });

  const text = resp.choices[0]?.message?.content || '';
  const urls = text.split(/\s+/).filter(s => /^https?:\/\//i.test(s));
  return [...new Set(urls)].slice(0, 20);
}

async function main() {
  const queries = [
    'Buenos Aires agenda eventos sitio oficial',
    'CABA agenda cultural eventos',
    'Buenos Aires eventos calendario',
    'Buenos Aires feria mercado agenda',
    'Buenos Aires conciertos agenda',
    'Buenos Aires teatro agenda',
    'agenda cultural Palermo Buenos Aires',
  ];

  const rawLinks = new Set();
  for (const q of queries) {
    const list = await ddg(q, 10);
    list.filter(keepDomain).forEach(u => rawLinks.add(u));
  }

  // находим фиды/календарные страницы
  const feedOrAgenda = new Set();
  for (const u of rawLinks) {
    const sub = await findFeedsOnPage(u);
    sub.filter(keepDomain).forEach(x => feedOrAgenda.add(x));
    // сам u тоже пригодится (если agenda)
    feedOrAgenda.add(u);
  }

  // даём GPT отранжировать/почистить
  const ranked = await rankWithGPT([...feedOrAgenda]);

  // сохраняем
  const text = ranked.join('\n') + '\n';
  const dir = path.join(ROOT, 'data');
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });

  fs.writeFileSync(OUT_SOURCES, text);
  console.log('Sources saved:', OUT_SOURCES, '\n', text);
}

main().catch(e => {
  console.error(e);
  process.exit(1);
});
