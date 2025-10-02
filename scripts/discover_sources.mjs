// Автопоиск источников событий Буэнос-Айреса
// Использует современные AI инструменты для поиска актуальных источников
import fs from 'fs';
import path from 'path';
import fetch from 'node-fetch';
import { JSDOM } from 'jsdom';

const ROOT = process.cwd();
const OUT_SOURCES = path.join(ROOT, 'data', 'event_sources.txt');

const UA = 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36 events-bot/1.1';

// Надежные источники событий в Буэнос-Айресе
const RELIABLE_SOURCES = [
  // Официальные сайты правительства
  'https://www.buenosaires.gob.ar/agenda',
  'https://www.buenosaires.gob.ar/eventos',
  'https://www.buenosaires.gob.ar/calendario',
  'https://vivamoscultura.buenosaires.gob.ar/agenda',
  'https://vivamoscultura.buenosaires.gob.ar/eventos',
  
  // Культурные центры
  'https://www.cck.gob.ar/agenda',
  'https://www.cck.gob.ar/eventos',
  'https://www.centroculturalrecoleta.org/agenda',
  'https://www.centroculturalrecoleta.org/eventos',
  'https://usinadelarte.org/agenda',
  'https://usinadelarte.org/eventos',
  
  // Театры и концертные залы
  'https://www.teatrocolon.org.ar/agenda',
  'https://www.teatrocolon.org.ar/eventos',
  'https://complejoteatral.gob.ar/agenda',
  'https://complejoteatral.gob.ar/eventos',
  'https://www.konex.org/agenda',
  'https://www.konex.org/eventos',
  
  // Музеи и галереи
  'https://www.malba.org.ar/agenda',
  'https://www.malba.org.ar/eventos',
  'https://www.bellasartes.gob.ar/agenda',
  'https://www.bellasartes.gob.ar/eventos',
  
  // RSS и календарные источники
  'https://www.buenosaires.gob.ar/feed',
  'https://www.buenosaires.gob.ar/rss',
  'https://www.buenosaires.gob.ar/calendar.ics',
  'https://vivamoscultura.buenosaires.gob.ar/feed',
  'https://vivamoscultura.buenosaires.gob.ar/rss',
  'https://www.cck.gob.ar/feed',
  'https://www.cck.gob.ar/rss',
  'https://www.cck.gob.ar/calendar.ics',
  
  // Популярные площадки
  'https://www.lunapark.com.ar/agenda',
  'https://www.lunapark.com.ar/eventos',
  'https://www.planetario.gob.ar/agenda',
  'https://www.planetario.gob.ar/eventos',
  'https://www.ecoparque.gob.ar/agenda',
  'https://www.ecoparque.gob.ar/eventos',
  
  // Фестивали и ярмарки
  'https://www.buenosaires.gob.ar/feria-de-mataraderos',
  'https://www.buenosaires.gob.ar/feria-de-san-telmo',
  'https://www.buenosaires.gob.ar/feria-de-recoleta',
  
  // Специализированные сайты
  'https://www.ticketek.com.ar/eventos',
  'https://www.tuentrada.com/eventos',
  'https://www.passline.com/eventos',
  'https://www.allaccess.com.ar/agenda',
  'https://www.agendacultural.com.ar',
  'https://www.eventbrite.com.ar/d/argentina--buenos-aires/events/',
];

// Дополнительные пути для поиска
const COMMON_PATHS = [
  '/agenda', '/eventos', '/events', '/calendario', '/actividades', 
  '/cartelera', '/programacion', '/feed', '/rss', '/calendar.ics'
];

function isValidUrl(url) {
  try {
    const u = new URL(url);
    // Исключаем социальные сети и нерелевантные сайты
    const bad = ['facebook.com', 'instagram.com', 'twitter.com', 'x.com', 
                't.me', 'wa.me', 'youtube.com', 'linkedin.com', 
                'tripadvisor', 'booking', 'google.com', 'maps.google.com'];
    
    if (bad.some(b => u.hostname.includes(b))) return false;
    
    // Принимаем только аргентинские домены или известные культурные сайты
    const good = /\.ar$/.test(u.hostname) || 
                 /buenosaires|caba|gob\.ar|konex|malba|cck|recoleta|usinadelarte|colon|complejoteatral|teatro|museo|centro|cultural/i.test(u.hostname);
    
    return good;
  } catch {
    return false;
  }
}

// Универсальный fetch с ретраями
async function fetchText(url, maxBytes = 500_000) {
  const tryOnce = async (u) => {
    try {
      const r = await fetch(u, { 
        headers: { 'User-Agent': UA },
        timeout: 10000 
      });
      const buf = await r.arrayBuffer();
      return Buffer.from(buf).slice(0, maxBytes).toString('utf8');
    } catch (e) {
      throw e;
    }
  };
  
  try {
    return await tryOnce(url);
  } catch (e1) {
    // Попытка через прокси-ридер
    try {
      const proxied = `https://r.jina.ai/${url}`;
      return await tryOnce(proxied);
    } catch (e2) {
      console.warn(`Failed to fetch ${url}: ${e2.message}`);
      return '';
    }
  }
}

// Поиск дополнительных источников на странице
async function findAdditionalSources(url) {
  const html = await fetchText(url, 100_000);
  if (!html) return [];
  
  const dom = new JSDOM(html);
  const doc = dom.window.document;
  const found = new Set();
  
  // Поиск RSS/Atom фидов
  doc.querySelectorAll('link[rel="alternate"]').forEach(link => {
    const type = (link.getAttribute('type') || '').toLowerCase();
    const href = link.getAttribute('href');
    if ((type.includes('rss') || type.includes('atom')) && href) {
      try {
        const fullUrl = new URL(href, url).toString();
        if (isValidUrl(fullUrl)) found.add(fullUrl);
      } catch {}
    }
  });
  
  // Поиск ICS календарей
  doc.querySelectorAll('a[href*=".ics"]').forEach(link => {
    const href = link.getAttribute('href');
    if (href) {
      try {
        const fullUrl = new URL(href, url).toString();
        if (isValidUrl(fullUrl)) found.add(fullUrl);
      } catch {}
    }
  });
  
  // Поиск ссылок на события
  doc.querySelectorAll('a[href]').forEach(link => {
    const href = link.getAttribute('href');
    if (href && /agenda|events|eventos|calendar|calendario|actividades|programacion|cartelera/i.test(href)) {
      try {
        const fullUrl = new URL(href, url).toString();
        if (isValidUrl(fullUrl)) found.add(fullUrl);
      } catch {}
    }
  });
  
  return [...found];
}

// Проверка доступности источника
async function checkSource(url) {
  try {
    const html = await fetchText(url, 10_000);
    return html.length > 0;
  } catch {
    return false;
  }
}

async function main() {
  console.log('🔍 Поиск источников событий Буэнос-Айреса...');
  
  const allSources = new Set();
  
  // Добавляем надежные источники
  for (const source of RELIABLE_SOURCES) {
    allSources.add(source);
  }
  
  // Проверяем доступность источников
  const validSources = [];
  for (const source of [...allSources]) {
    console.log(`Проверка: ${source}`);
    if (await checkSource(source)) {
      validSources.push(source);
      console.log(`✅ ${source}`);
    } else {
      console.log(`❌ ${source}`);
    }
  }
  
  // Ищем дополнительные источники на доступных страницах
  console.log('\n🔍 Поиск дополнительных источников...');
  for (const source of validSources.slice(0, 10)) { // Проверяем только первые 10
    try {
      const additional = await findAdditionalSources(source);
      additional.forEach(url => {
        if (isValidUrl(url)) allSources.add(url);
      });
    } catch (e) {
      console.warn(`Ошибка при поиске на ${source}: ${e.message}`);
    }
  }
  
  // Фильтруем и сохраняем
  const finalSources = [...allSources].filter(isValidUrl).slice(0, 50);
  
  const dir = path.join(ROOT, 'data');
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  
  fs.writeFileSync(OUT_SOURCES, finalSources.join('\n') + '\n');
  
  console.log(`\n✅ Сохранено ${finalSources.length} источников в ${OUT_SOURCES}`);
  console.log('\n📋 Найденные источники:');
  finalSources.forEach((source, i) => {
    console.log(`${i + 1}. ${source}`);
  });
}

main().catch(e => {
  console.error('❌ Ошибка:', e);
  process.exit(1);
});