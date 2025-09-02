// scripts/build_events.mjs
// Сбор событий: RSS/ICS + HTML→GPT, перевод описаний на русский, жёсткий фильтр прошедших.
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
const oai   = OPENAI_API_KEY ? new OpenAI({ apiKey: OPENAI_API_KEY }) : null;

const UA = 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome Safari events-bot/1.3';
const parser = new Parser({
  customFields: {
    item: [
      ['content:encoded', 'encoded'],
      ['dc:creator', 'creator'],
      ['event:start_time','start_time'],
      ['event:venue_name','venue_name'],
      ['enclosure','enclosure']
    ]
  }
});

// ---------- helpers ----------
const TAG_RULES = [
  { tag:'музыка',    rx:/\b(music|música|musica|dj|band|live|recital)\b/i },
  { tag:'концерт',   rx:/\b(concert|recital|gig)\b/i },
  { tag:'ярмарка',   rx:/\b(fair|feria|market|mercado|ярмарка)\b/i },
  { tag:'вечеринка', rx:/\b(party|fiesta|rave)\b/i },
  { tag:'кино',      rx:/\b(cinema|cine|film|pel[ií]cula|кино)\b/i },
  { tag:'театр',     rx:/\b(theatre|teatro)\b/i },
  { tag:'детям',     rx:/\b(kids|niñ|infantil|дет(ям|и))\b/i },
  { tag:'русскоязычное', rx:/\b(rus|ruso|русск|russian)\b/i },
  { tag:'бесплатно', rx:/\b(free|gratis|gratuito|бесплат)/i }
];
function tagify(text){ const tags=[]; for(const r of TAG_RULES) if(r.rx.test(text||'')) tags.push(r.tag); return [...new Set(tags)]; }

function priceFrom(text){
  if (!text) return { is_free:false, text:'' };
  if (/\b(free|gratis|gratuito|бесплат)/i.test(text)) return { is_free:true, text:'Бесплатно' };
  const m = text.match(/(?:ARS|\$|usd|u\$s)\s?\d[\d.,]*/i);
  return { is_free:false, text: m ? m[0].replace(/usd/i,'USD').replace(/u\$s/i,'USD') : '' };
}

function firstSentences(str, maxChars=220){
  if (!str) return '';
  const text = str.replace(/\s+/g,' ').trim();
  const m = text.match(/(.+?[.!?])\s+(.+?[.!?])?/);
  const out = (m ? (m[1] + (m[2] ? ' ' + m[2] : '')) : text).slice(0, maxChars);
  return out;
}

async function translateRu(text){
  if (!text) return '';
  if (!oai) return text; // без ключа — оставляем как есть
  const prompt = `Переведи на русский кратко (1–2 предложения, без воды):\n${text}`;
  try{
    const r = await oai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [{role:'user', content: prompt}],
      temperature: 0.2
    });
    const t = (r.choices?.[0]?.message?.content || '').trim();
    return t || text;
  }catch{ return text; }
}

async function geocode(query){
  if (!query || !gmaps) return null;
  try{
    const res = await gmaps.geocode({ params:{ address: query + ', Buenos Aires, Argentina', key: GOOGLE_KEY, region:'AR', language:'ru' } });
    const r = res.data.results?.[0];
    return r ? { lat:r.geometry.location.lat, lng:r.geometry.location.lng } : null;
  }catch{ return null; }
}

// fetch with fallback
async function fetchText(url, maxBytes = 900_000) {
  const tryOnce = async (u) => {
    const r = await fetch(u, { headers: { 'User-Agent': UA } });
    const buf = await r.arrayBuffer();
    return Buffer.from(buf).slice(0, maxBytes).toString('utf8');
  };
  try { return await tryOnce(url); }
  catch {
    try { return await tryOnce(`https://r.jina.ai/${url}`); }
    catch { return ''; }
  }
}

// ---------- parsers ----------
async function pullRSS(url){
  try{
    const feed = await parser.parseURL(url);
    return (feed.items||[]).map(it => {
      const rawHtml = it.encoded || it.content || '';
      const doc = new JSDOM(rawHtml).window.document;
      const plain = (doc.body.textContent || '').trim();
      const desc = firstSentences(plain || it.contentSnippet || it.content || '');
      const when = it.isoDate || it.pubDate || it.start_time || '';
      const venueGuess = it.venue_name || (plain.match(/(Centro|Teatro|Museo|Sala|Club|Cultural|Malba|Konex|Colon)\s+[A-ZÁÉÍÓÚÑ][^\.,\n]{2,80}/i)?.[0]||'');
      const addressGuess = plain.match(/([A-ZÁÉÍÓÚÑ][a-záéíóúñ]+\.?\s+[0-9]{1,5}(?:\s?\w{0,3})?,?\s*(CABA|Buenos Aires)?)/i)?.[0] || '';
      return {
        title: (it.title||'').trim(),
        description: desc,
        url: it.link || url,
        start: when ? new Date(when).toISOString() : new Date().toISOString(),
        end: null,
        venue: { name: venueGuess, address: addressGuess },
      };
    });
  }catch{
    const xml = await fetchText(url);
    const items = [];
    xml.split(/<item>/i).slice(1).forEach(chunk=>{
      const pick = (re)=> (chunk.match(re)?.[1] || '').replace(/<!\[CDATA\[|\]\]>/g,'').trim();
      const title = pick(/<title>([\s\S]*?)<\/title>/i);
      const link  = pick(/<link>([\s\S]*?)<\/link>/i);
      const descRaw = pick(/<description>([\s\S]*?)<\/description>/i);
      const desc = firstSentences(new JSDOM(descRaw).window.document.body.textContent||'');
      const date = pick(/<pubDate>([\s\S]*?)<\/pubDate>/i);
      items.push({
        title, description: desc, url: link || url,
        start: date ? new Date(date).toISOString() : new Date().toISOString(),
        end: null, venue: { name:'', address:'' }
      });
    });
    return items;
  }
}

async function pullICS(url){
  try{
    const txt = await fetchText(url);
    const data = ical.sync.parseICS(txt);
    const out=[];
    for (const k in data){
      const ev = data[k]; if (ev?.type!=='VEVENT') continue;
      const s = ev.start instanceof Date ? ev.start : new Date(ev.start);
      const e = ev.end   instanceof Date ? ev.end   : new Date(ev.end);
      out.push({
        title: ev.summary||'',
        description: firstSentences(ev.description||''),
        url: ev.url || url,
        start: (s||new Date()).toISOString(),
        end: (e||s||new Date()).toISOString(),
        venue: { name: ev.location||'', address: ev.location||'' }
      });
    }
    return out;
  }catch{ return []; }
}

async function extractFromHTML(url){
  if (!oai) return [];
  const html = await fetchText(url);
  if (!html) return [];
  const dom = new JSDOM(html);
  const text = dom.window.document.body.textContent?.replace(/\s+/g,' ').slice(0, 18000) || '';

  const prompt = `
Извлеки будущие события в Буэнос-Айресе (AR) из текста страницы.
Верни JSON с полем "events": массив объектов
{ "title": "...", "start": "ISO", "end": "ISO|null", "venue": {"name":"","address":""}, "price_text":"", "url":"", "description":"" }
Текст:
${text}
  `.trim();

  const resp = await oai.chat.completions.create({
    model: 'gpt-4o-mini',
    messages: [{ role:'user', content: prompt }],
    temperature: 0.2,
    response_format: { type:'json_object' }
  });

  let arr=[];
  try{
    const obj = JSON.parse(resp.choices[0]?.message?.content || '{}');
    arr = Array.isArray(obj.events) ? obj.events : [];
  }catch{}
  return arr.map(e=>({
    title: e.title||'',
    description: firstSentences(e.description||''),
    url: e.url || url,
    start: e.start || new Date().toISOString(),
    end: e.end || null,
    venue: { name: e.venue?.name || '', address: e.venue?.address || '' }
  }));
}

// ---------- main ----------
async function main(){
  const srcs = fs.existsSync(SRC_FILE)
    ? fs.readFileSync(SRC_FILE,'utf8').split('\n').map(s=>s.trim()).filter(Boolean)
    : [];

  let events=[];
  for (const u of srcs){
    try{
      if (/\.ics(\?|$)/i.test(u))                              events.push(...await pullICS(u));
      else if (/\.xml(\?|$)/i.test(u) || /rss|atom|feed/i.test(u)) events.push(...await pullRSS(u));
      else                                                     events.push(...await extractFromHTML(u));
    }catch(e){ console.error('Source failed:', u, e.message); }
  }

  const now = dayjs();
  const out=[];
  for (const e of events){
    // нормализуем время
    const start = dayjs(e.start || Date.now());
    const end   = dayjs(e.end || start.add(3,'hour'));

    // Жёсткий фильтр прошедших: пропускаем только то, что начинается/идёт в будущем
    if (end.isBefore(now)) continue;

    // теги/цена
    const baseText = [e.title, e.description, e.venue?.name, e.venue?.address].join(' ');
    const tags  = tagify(baseText);
    const price = priceFrom(baseText);

    // геокод адреса ИЛИ названия площадки
    let loc = null;
    if (e.venue?.address) loc = await geocode(e.venue.address);
    if (!loc && e.venue?.name) loc = await geocode(e.venue.name);

    // перевод описания на русский
    const ruDesc = await translateRu(firstSentences(e.description||''));

    const id = Buffer.from((e.title||'') + (start.toISOString()) + (e.url||''), 'utf8').toString('base64').slice(0,24);

    out.push({
      id,
      title: e.title||'',
      description: ruDesc,
      url: e.url||'',
      start: start.toISOString(),
      end: end.toISOString(),
      venue: { name: e.venue?.name||'', address: e.venue?.address||'' },
      location: loc,
      tags, price
    });
  }

  // на всякий случай отсортируем по дате
  out.sort((a,b)=> new Date(a.start) - new Date(b.start));

  if (!fs.existsSync(path.join(ROOT,'data'))) fs.mkdirSync(path.join(ROOT,'data'),{recursive:true});
  fs.writeFileSync(OUT_JSON, JSON.stringify(out,null,2));
  fs.writeFileSync(OUT_JS, `window.EVENTS=${JSON.stringify(out)};`);
  console.log('Events total:', out.length);
}

main().catch(e=>{ console.error(e); process.exit(1); });
