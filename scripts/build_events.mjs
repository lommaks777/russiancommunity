// Сборщик событий: RSS/ICS + HTML (через GPT-экстракцию)
import fs from 'fs';
import path from 'path';
import Parser from 'rss-parser';
import ical from 'node-ical';
import dayjs from 'dayjs';
import fetch from 'node-fetch';
import { JSDOM } from 'jsdom';
import { Client as GClient } from '@googlemaps/google-maps-services-js';
import OpenAI from 'openai';

const ROOT = process.cwd();
const SRC_FILE = path.join(ROOT, 'data', 'event_sources.txt');
const OUT_JSON = path.join(ROOT, 'data', 'events.json');
const OUT_JS   = path.join(ROOT, 'data', 'events.js');

const GOOGLE_KEY = process.env.GOOGLE_KEY || '';
const OPENAI_API_KEY = process.env.OPENAI_API_KEY || '';
const gmaps = GOOGLE_KEY ? new GClient({}) : null;
const oai = OPENAI_API_KEY ? new OpenAI({ apiKey: OPENAI_API_KEY }) : null;

const parser = new Parser();

const TAG_RULES = [
  { tag:'музыка',    rx:/\b(music|música|musica|dj|band|live)\b/i },
  { tag:'концерт',   rx:/\b(concert|recital|gig)\b/i },
  { tag:'ярмарка',   rx:/\b(fair|feria|market|ярмарка|mercado)\b/i },
  { tag:'вечеринка', rx:/\b(party|fiesta|rave)\b/i },
  { tag:'кино',      rx:/\b(cinema|cine|film|кино)\b/i },
  { tag:'театр',     rx:/\b(theatre|teatro)\b/i },
  { tag:'детям',     rx:/\b(kids|niñ|infantil|дет(ям|и))\b/i },
  { tag:'русскоязычное', rx:/\b(rus|ruso|русск|russian)\b/i },
  { tag:'бесплатно', rx:/\b(free|gratis|бесплат)/i }
];

function tagify(text){
  const tags=[]; for(const r of TAG_RULES) if(r.rx.test(text||'')) tags.push(r.tag);
  return [...new Set(tags)];
}

function priceFrom(text){
  if (!text) return { is_free:false, text:'' };
  if (/\b(free|gratis|бесплат)/i.test(text)) return { is_free:true, text:'Бесплатно' };
  const m = text.match(/(\$|ars|\b\$?\s?\d[\d.,]*)/i);
  return { is_free:false, text: m ? m[0] : '' };
}

async function geocode(address){
  if (!address || !gmaps) return null;
  try{
    const res = await gmaps.geocode({ params:{ address, key: GOOGLE_KEY, region:'AR', language:'ru' } });
    const r = res.data.results?.[0];
    if (!r) return null;
    return { lat:r.geometry.location.lat, lng:r.geometry.location.lng };
  }catch{ return null; }
}

async function pullRSS(url){
  const feed = await parser.parseURL(url);
  const items = [];
  for (const it of feed.items||[]){
    const title = (it.title||'').trim();
    const desc  = (it.contentSnippet||it.content||'').trim();
    const link  = it.link;
    const when  = new Date(it.isoDate || it.pubDate || Date.now());
    const loc   = it.contentSnippet?.match(/(Av\.|Calle|Córdoba|Buenos Aires|Capital Federal|Palermo|Recoleta)[^<]{0,120}/i)?.[0] || '';
    items.push({
      title, description: desc, url: link,
      start: when.toISOString(),
      venue: { name: '', address: loc }
    });
  }
  return items;
}

async function pullICS(url){
  const r = await fetch(url);
  const txt = await r.text();
  const data = ical.sync.parseICS(txt);
  const items=[];
  for (const k in data){
    const ev = data[k];
    if (ev?.type!=='VEVENT') continue;
    const start = ev.start instanceof Date ? ev.start : new Date(ev.start);
    const end   = ev.end   instanceof Date ? ev.end   : new Date(ev.end);
    items.push({
      title: ev.summary||'',
      description: ev.description||'',
      url: ev.url || '',
      start: (start||new Date()).toISOString(),
      end: (end||start||new Date()).toISOString(),
      venue: { name: ev.location||'', address: ev.location||'' }
    });
  }
  return items;
}

async function extractFromHTML(url){
  if (!oai) return [];
  const res = await fetch(url, { headers: { 'User-Agent':'events-bot/1.0' } });
  const html = await res.text();

  // Урезаем до разумного размера
  const dom = new JSDOM(html);
  const text = dom.window.document.body.textContent?.replace(/\s+/g,' ').slice(0, 15000) || '';

  const prompt = `
Ты извлекаешь Список будущих событий в Буэнос-Айресе (AR) из сырых текстов страниц.
Верни JSON-массив объектов:
[
  {
    "title": "...",
    "start": "ISO8601 дата/время начала, если нет — ближайшая предполагаемая дата",
    "end": "ISO8601 дата/время конца или null",
    "venue": { "name": "имя площадки или пусто", "address": "адрес или район" },
    "price_text": "стоимость в свободной форме или пусто",
    "url": "ссылка на страницу события (если неизвестно — ${url})",
    "description": "короткое описание до 300 символов"
  }
]

Текст страницы:
${text}
  `.trim();

  const resp = await oai.chat.completions.create({
    model: 'gpt-4o-mini',
    messages: [{ role:'user', content: prompt }],
    temperature: 0.2,
    response_format: { type: 'json_object' }
  });

  let data = [];
  try{
    const obj = JSON.parse(resp.choices[0]?.message?.content || '{}');
    if (Array.isArray(obj)) data = obj;
    if (Array.isArray(obj.events)) data = obj.events;
  }catch{}
  if (!Array.isArray(data)) data = [];
  return data.map(e => ({
    title: e.title || '',
    description: e.description || '',
    url: e.url || url,
    start: e.start || new Date().toISOString(),
    end: e.end || null,
    venue: { name: e.venue?.name || '', address: e.venue?.address || '' }
  }));
}

async function main(){
  const srcs = fs.existsSync(SRC_FILE)
    ? fs.readFileSync(SRC_FILE,'utf8').split('\n').map(s=>s.trim()).filter(Boolean)
    : [];

  let events=[];
  for (const u of srcs){
    try{
      if (/\.ics(\?|$)/i.test(u)) {
        events.push(...await pullICS(u));
      } else if (/\.xml(\?|$)/i.test(u) || /rss|atom|feed/i.test(u)) {
        events.push(...await pullRSS(u));
      } else {
        // страница без фидов — пробуем HTML→GPT
        events.push(...await extractFromHTML(u));
      }
    }catch(e){
      console.error('Source failed:', u, e.message);
    }
  }

  // Нормализация/фильтр прошедших + теги/цены/геокод
  const now = dayjs();
  const out=[];
  for (const e of events){
    const start = dayjs(e.start || Date.now());
    const end   = dayjs(e.end || start.add(3,'hour'));
    if (end.isBefore(now.subtract(6,'hour'))) continue; // уже прошло

    const text = [e.title, e.description, e.venue?.name, e.venue?.address].join(' ');
    const tags = tagify(text);
    const price = priceFrom(text);

    const loc = e.venue?.address ? await geocode(e.venue.address) : null;

    const id = Buffer.from((e.title||'') + (e.start||'') + (e.url||''), 'utf8').toString('base64').slice(0,24);

    out.push({
      id,
      title: e.title||'',
      description: (e.description||'').slice(0,500),
      url: e.url||'',
      start: start.toISOString(),
      end: end.toISOString(),
      venue: { name: e.venue?.name||'', address: e.venue?.address||'' },
      location: loc,
      tags,
      price
    });
  }

  // Сохраняем для фронта
  if (!fs.existsSync(path.join(ROOT, 'data'))) fs.mkdirSync(path.join(ROOT, 'data'), {recursive:true});
  fs.writeFileSync(OUT_JSON, JSON.stringify(out, null, 2));
  fs.writeFileSync(OUT_JS, `window.EVENTS=${JSON.stringify(out)};`);
  console.log('Events total:', out.length);
}

main().catch(e=>{ console.error(e); process.exit(1); });
