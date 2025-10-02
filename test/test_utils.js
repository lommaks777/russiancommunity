// test/test_utils.js - Утилиты для тестирования
// Тестируемые функции из проекта

// Функции из map.js и index.html
function withKeyForPlacesMedia(url) {
  if (!url) return "";
  try {
    const u = new URL(url);
    if (u.hostname === "places.googleapis.com" && u.pathname.includes("/v1/") && u.pathname.endsWith("/media")) {
      if (!u.searchParams.has("key")) u.searchParams.set("key", "AIzaSyB7-RgotVuWFR6qMvr_Alf8nQvkYd7I3WI");
      return u.toString();
    }
  } catch {}
  return url;
}

// Функции из events.html
function emojiFor(event) {
  const TAG_EMOJI = { 
    музыка: "🎵", концерт: "🎤", ярмарка: "🛍️", вечеринка: "🎉", 
    кино: "🎬", театр: "🎭", бесплатно: "🆓", детям: "👶", 
    русскоязычное: "🇷🇺" 
  };
  if (event.tags?.length) {
    for (const t of event.tags) {
      if (TAG_EMOJI[t]) return TAG_EMOJI[t];
    }
  }
  return "🎟️";
}

function whenText(event) {
  const start = new Date(event.start);
  const end = new Date(event.end || event.start);
  const sameDay = start.toDateString() === end.toDateString();
  const d = start.toLocaleDateString('ru-RU', { day: '2-digit', month: 'short', year: 'numeric' });
  const t1 = start.toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' });
  const t2 = end.toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' });
  return sameDay ? `${d}, ${t1}${event.end ? '–' + t2 : ''}` : `${d}, ${t1} → ${end.toLocaleString('ru-RU', { day: '2-digit', month: 'short' })} ${t2}`;
}

function upcomingOnly(events) {
  const now = Date.now();
  return events.filter(e => new Date(e.end || e.start).getTime() >= now);
}

function filtered(events, tagFilter, priceFilter, query) {
  return upcomingOnly(events || []).filter(e => {
    const byTag = !tagFilter || (e.tags || []).includes(tagFilter);
    const byPrice = !priceFilter || (priceFilter === 'free' ? e.price?.is_free : !e.price?.is_free);
    const byQuery = !query || (e.title || '').toLowerCase().includes(query);
    return byTag && byPrice && byQuery;
  }).sort((a, b) => new Date(a.start) - new Date(b.start));
}

// Функции из add.html
function clearForm(fields, preserveCategory = true, preserveQuery = true) {
  const result = {};
  for (const field of fields) {
    if (field === 'rus') {
      result[field] = 3;
    } else if (preserveCategory && field === 'category') {
      // сохраняем категорию
    } else if (preserveQuery && field === 'query') {
      // сохраняем запрос
    } else {
      result[field] = '';
    }
  }
  return result;
}

function buildJson(formData) {
  return {
    id: Date.now(),
    name: formData.name?.trim() || '',
    category: formData.category || '',
    subtype: '',
    lat: Number(formData.lat) || 0,
    lng: Number(formData.lng) || 0,
    neighborhood: formData.neighborhood?.trim() || '',
    russian_score: Number(formData.rus) || 0,
    peak_hours: formData.peak?.trim() || '',
    instagram: formData.insta?.trim() || '',
    website: formData.site?.trim() || '',
    phone: formData.phone?.trim() || '',
    photo_url: formData.photo?.trim() || '',
    address: formData.address?.trim() || '',
    place_id: formData.placeid?.trim() || '',
    notes: formData.notes?.trim() || ''
  };
}

// Функции из build_events.mjs
const TAG_RULES = [
  { tag: 'музыка', rx: /\b(music|música|musica|dj|band|live|recital)\b/i },
  { tag: 'концерт', rx: /\b(concert|recital|gig)\b/i },
  { tag: 'ярмарка', rx: /\b(fair|feria|market|mercado|ярмарка)\b/i },
  { tag: 'вечеринка', rx: /\b(party|fiesta|rave)\b/i },
  { tag: 'кино', rx: /\b(cinema|cine|film|pel[ií]cula|кино)\b/i },
  { tag: 'театр', rx: /\b(theatre|teatro)\b/i },
  { tag: 'детям', rx: /\b(kids|niñ|infantil|дет(ям|и))\b/i },
  { tag: 'русскоязычное', rx: /\b(rus|ruso|rusa|русск|russian)\b/i },
  { tag: 'бесплатно', rx: /\b(free|gratis|gratuito|бесплат)/i }
];

function tagify(text) {
  const tags = [];
  for (const r of TAG_RULES) {
    if (r.rx.test(text || '')) tags.push(r.tag);
  }
  return [...new Set(tags)];
}

function priceFrom(text) {
  if (!text) return { is_free: false, text: '' };
  if (/\b(free|gratis|gratuito|бесплат)/i.test(text)) return { is_free: true, text: 'Бесплатно' };
  const m = text.match(/(?:ARS|\$|usd|u\$s)\s?\d[\d.,]*/i);
  return { is_free: false, text: m ? m[0].replace(/usd/i, 'USD').replace(/u\$s/i, 'USD') : '' };
}

function firstSentences(str, maxChars = 220) {
  if (!str) return '';
  const text = str.replace(/\s+/g, ' ').trim();
  const m = text.match(/(.+?[.!?])\s+(.+?[.!?])?/);
  const out = (m ? (m[1] + (m[2] ? ' ' + m[2] : '')) : text).slice(0, maxChars);
  return out;
}

// Экспорт для тестов
if (typeof module !== 'undefined' && module.exports) {
  module.exports = {
    withKeyForPlacesMedia,
    emojiFor,
    whenText,
    upcomingOnly,
    filtered,
    clearForm,
    buildJson,
    tagify,
    priceFrom,
    firstSentences
  };
}
