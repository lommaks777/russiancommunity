// Сбор событий: RSS/ICS + HTML→GPT, с ретраями и r.jina.ai
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

const UA = 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36 events-bot/1.1';
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

function tagify(text){ const tags=[]; for(const r of TAG_RULES) if(r.rx.test(text||'')) tags.push(r.tag); return [...new Set(tags)]; }
function priceFrom(text){
  if (!text) return { is_free:false, text:'' };
  if (/\b(free|gratis|бесплат)/i.test(text)) return { is_free:true, text:'Бесплатно' };
  const m = text.match(/(\$|ars|\b\$?\s?\d[\d.,]*)/i);
  return { is_free:false, text: m ? m[0] : '' };
}

// универсальный fetch с фолбэком на r.jina.ai
async function fetchText(url, {maxBytes = 800_000} = {}) {
  const tryOnce = async (u) => {
    const r = await fetch(u, { headers: { 'User-Agent': UA } });
    const buf = await r.arrayBuffer();
    return Buffer.from(buf).slice(0, maxBytes).toString('utf8');
  };
  try {
    return await tryOnce(url);
  } catch (e1) {
    try {
      const via = `https://r.jina.ai/${url}`;
      return await tryOnce(via);
    } catch (e2) {
      return '';
    }
  }
}

async function geocode(address){
  if (!address || !gmaps) return null;
  try{
    const res = await gmaps.geocode({ params:{ address, key: GOOGLE_KEY, region:'AR', language:'ru' } });
    const r = res.data.results?.[0];
    return r ? { lat:r.geometry.location.lat, lng:r.geometry.location.lng } : null;
  }catch{ return null; }
}

async function pullRSS(url){
  try{
    // rss-parser сам фетчит; если рухнул — пробуем через ридер
    try { return (await parser.parseURL(url)).items.map(it=>({
      title: (it.title||'').trim(),
      description: (it.contentSnippet||it.content||'').trim(),
      url: it.link, start: new Date(it.isoDate || it.pubDate || Date.now()).toISOString(),
      venue: { name:'', address: '' }
    })); } catch {}
    const xml = await fetchText(url);
    // очень грубо: выдрать <item>…</item>
    const items = [];
    xml.split(/<item>/i).slice(1).forEach(chunk=>{
      const title = (chunk.match(/<title>([\s\S]*?)<\/title>/i)?.[1]||'').replace(/<!\[CDATA\[|\]\]>/g,'').trim();
      const link  = (chunk.match(/<link>([\s\S]*?)<\/link>/i)?.[1]||'').trim();
      const desc  = (chunk.match(/<description>([\s\S]*?)<\/description>/i)?.[1]||'').replace(/<!\[CDATA\[|\]\]>/g,'').trim();
      if (title || link) items.push({title, description:desc, url:link, start:new Date().toISOString(), venue:{name:'',address:''}});
    });
    return items;
  }catch{ return []; }
}

async function pullICS(url){
  try{
    const txt = await fetchText(url);
    const data = ical.sync.parseICS(txt);
    const out=[];
    for (const k in data){
      const ev = data[k];
      if (ev?.type!=='VEVENT') continue;
      const start = ev.start instanceof Date ? ev.start : new Date(ev.start);
      const end   = ev.end   instanceof Date ? ev.end   : new Date(ev.end);
      out.push({
        title: ev.summary||'', description: ev.description||'', url: ev.url||'',
        start: (start||new Date()).toISOString(), end: (end||start||new Date()).toISOString(),
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
  // читаемый текст (через r.jina.ai он уже «readable»)
  const dom = new JSDOM(html);
  const text = dom.window.document.body.textContent?.replace(/\s+/g,' ').slice(0, 18000) || '';

  const prompt = `
Извлеки будущие события в Буэнос-Айресе (AR) из текста страницы.
Верни JSON-массив в поле "events":
{ "events": [ { "title": "...", "start": "ISO", "end": "ISO|null", "venue": {"name":"", "address":""}, "price_text":"", "url":"", "description":"" } ] }
Текст:
${text}
  `.trim();

  const resp = await oai.chat.completions.create({
    model: 'gpt-4o-mini',
    messages: [{ role:'user', content: prompt }],
    temperature: 0.2,
    response_format: { type: 'json_object' }
  });

  let arr=[];
  try{
    const obj = JSON.parse(resp.choices[0]?.message?.content || '{}');
    arr = Array.isArray(obj.events) ? obj.events : [];
  }catch{}
  return arr.map(e=>({
    title: e.title||'',
    description: e.description||'',
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
      if (/\.ics(\?|$)/i.test(u))       events.push(...await pullICS(u));
      else if (/\.xml(\?|$)/i.test(u) || /rss|atom|feed/i.test(u)) events.push(...await pullRSS(u));
      else                               events.push(...await extractFromHTML(u));
    }catch(e){ console.error('Source failed:', u, e.message); }
  }

  const now = dayjs();
  const out=[];
  for (const e of events){
    const start = dayjs(e.start || Date.now());
    const end   = dayjs(e.end || start.add(3,'hour'));
    if (end.isBefore(now.subtract(6,'hour'))) continue;

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

  if (!fs.existsSync(path.join(ROOT,'data'))) fs.mkdirSync(path.join(ROOT,'data'),{recursive:true});
  fs.writeFileSync(OUT_JSON, JSON.stringify(out,null,2));
  fs.writeFileSync(OUT_JS, `window.EVENTS=${JSON.stringify(out)};`);
  console.log('Events total:', out.length);
}

main().catch(e=>{ console.error(e); process.exit(1); });
