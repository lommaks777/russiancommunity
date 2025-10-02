// Сбор событий Буэнос-Айреса с использованием современных AI инструментов
import fs from 'fs';
import path from 'path';
import fetch from 'node-fetch';
import { JSDOM } from 'jsdom';
import dayjs from 'dayjs';

const ROOT = process.cwd();
const SRC_FILE = path.join(ROOT, 'data', 'event_sources.txt');
const OUT_JSON = path.join(ROOT, 'data', 'events.json');
const OUT_JS = path.join(ROOT, 'data', 'events.js');

const UA = 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36 events-bot/1.2';

// Правила для определения тегов
const TAG_RULES = [
  { tag: 'музыка', patterns: ['música', 'music', 'concierto', 'conciertos', 'recital', 'banda', 'orquesta', 'coro'] },
  { tag: 'концерт', patterns: ['concierto', 'conciertos', 'recital', 'gig', 'show'] },
  { tag: 'ярмарка', patterns: ['feria', 'ferias', 'mercado', 'mercados', 'feria artesanal', 'feria gastronómica'] },
  { tag: 'вечеринка', patterns: ['fiesta', 'fiestas', 'party', 'parties', 'celebración', 'festival'] },
  { tag: 'кино', patterns: ['cine', 'cinema', 'película', 'películas', 'film', 'films', 'proyección'] },
  { tag: 'театр', patterns: ['teatro', 'theatre', 'obra', 'obras', 'danza', 'dance', 'ballet'] },
  { tag: 'детям', patterns: ['niños', 'kids', 'infantil', 'familia', 'family', 'talleres infantiles'] },
  { tag: 'русскоязычное', patterns: ['ruso', 'russian', 'rusa', 'rusos', 'comunidad rusa'] },
  { tag: 'бесплатно', patterns: ['gratis', 'gratuito', 'gratuitos', 'free', 'entrada libre', 'sin costo'] },
  { tag: 'обучение', patterns: ['taller', 'talleres', 'workshop', 'workshops', 'curso', 'cursos', 'capacitación'] }
];

// Универсальный fetch
async function fetchText(url, maxBytes = 500_000) {
  const tryOnce = async (u) => {
    const r = await fetch(u, { 
      headers: { 'User-Agent': UA },
      timeout: 15000 
    });
    const buf = await r.arrayBuffer();
    return Buffer.from(buf).slice(0, maxBytes).toString('utf8');
  };
  
  try {
    return await tryOnce(url);
  } catch (e1) {
    try {
      const proxied = `https://r.jina.ai/${url}`;
      return await tryOnce(proxied);
    } catch (e2) {
      console.warn(`Failed to fetch ${url}: ${e2.message}`);
      return '';
    }
  }
}

// Определение тегов события
function extractTags(text) {
  const tags = [];
  const lowerText = text.toLowerCase();
  
  for (const rule of TAG_RULES) {
    for (const pattern of rule.patterns) {
      if (lowerText.includes(pattern.toLowerCase())) {
        tags.push(rule.tag);
        break;
      }
    }
  }
  
  return [...new Set(tags)];
}

// Извлечение информации о цене
function extractPrice(text) {
  if (!text) return { is_free: false, text: '' };
  
  const lowerText = text.toLowerCase();
  
  if (/\b(gratis|gratuito|gratuitos|free|entrada libre|sin costo|no hay costo)\b/.test(lowerText)) {
    return { is_free: true, text: 'Бесплатно' };
  }
  
  const priceMatch = text.match(/(?:ARS|\$|pesos?)\s*[\d.,]+/i);
  if (priceMatch) {
    return { is_free: false, text: priceMatch[0] };
  }
  
  return { is_free: false, text: '' };
}

// Создание тестовых событий для демонстрации
function createSampleEvents() {
  const now = new Date();
  const nextWeek = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);
  
  return [
    {
      id: 'sample1',
      title: 'Фестиваль русской культуры в Буэнос-Айресе',
      description: 'Ежегодный фестиваль русской культуры с концертами, выставками и традиционной кухней.',
      url: 'https://example.com/ruso-festival',
      start: new Date(nextWeek.getTime() + 24 * 60 * 60 * 1000).toISOString(),
      end: new Date(nextWeek.getTime() + 24 * 60 * 60 * 1000 + 4 * 60 * 60 * 1000).toISOString(),
      venue: { 
        name: 'Centro Cultural Recoleta', 
        address: 'Junín 1930, C1113 Cdad. Autónoma de Buenos Aires' 
      },
      location: { lat: -34.5875, lng: -58.3936 },
      tags: ['русскоязычное', 'фестиваль', 'культура'],
      price: { is_free: false, text: 'ARS 2000' }
    },
    {
      id: 'sample2',
      title: 'Концерт классической музыки в Teatro Colón',
      description: 'Симфонический оркестр Teatro Colón представляет произведения Чайковского и Рахманинова.',
      url: 'https://example.com/teatro-colon',
      start: new Date(nextWeek.getTime() + 2 * 24 * 60 * 60 * 1000).toISOString(),
      end: new Date(nextWeek.getTime() + 2 * 24 * 60 * 60 * 1000 + 2 * 60 * 60 * 1000).toISOString(),
      venue: { 
        name: 'Teatro Colón', 
        address: 'Cerrito 628, C1010 Cdad. Autónoma de Buenos Aires' 
      },
      location: { lat: -34.6037, lng: -58.3816 },
      tags: ['музыка', 'концерт', 'классика'],
      price: { is_free: false, text: 'ARS 5000' }
    },
    {
      id: 'sample3',
      title: 'Бесплатная ярмарка ремесел в Palermo',
      description: 'Еженедельная ярмарка с изделиями местных мастеров, едой и развлечениями для всей семьи.',
      url: 'https://example.com/feria-palermo',
      start: new Date(nextWeek.getTime() + 3 * 24 * 60 * 60 * 1000).toISOString(),
      end: new Date(nextWeek.getTime() + 3 * 24 * 60 * 60 * 1000 + 6 * 60 * 60 * 1000).toISOString(),
      venue: { 
        name: 'Plaza Serrano', 
        address: 'Plaza Cortázar, Palermo, Buenos Aires' 
      },
      location: { lat: -34.5842, lng: -58.4291 },
      tags: ['ярмарка', 'бесплатно', 'семья', 'ремесла'],
      price: { is_free: true, text: 'Бесплатно' }
    },
    {
      id: 'sample4',
      title: 'Мастер-класс по русской кухне',
      description: 'Учитесь готовить традиционные русские блюда: борщ, пельмени, блины и многое другое.',
      url: 'https://example.com/cocina-rusa',
      start: new Date(nextWeek.getTime() + 4 * 24 * 60 * 60 * 1000).toISOString(),
      end: new Date(nextWeek.getTime() + 4 * 24 * 60 * 60 * 1000 + 3 * 60 * 60 * 1000).toISOString(),
      venue: { 
        name: 'Escuela de Cocina', 
        address: 'Av. Santa Fe 1234, C1060 Cdad. Autónoma de Buenos Aires' 
      },
      location: { lat: -34.5955, lng: -58.4011 },
      tags: ['обучение', 'русскоязычное', 'кулинария'],
      price: { is_free: false, text: 'ARS 3000' }
    },
    {
      id: 'sample5',
      title: 'Выставка современного искусства',
      description: 'Экспозиция работ аргентинских и международных художников в MALBA.',
      url: 'https://example.com/malba-expo',
      start: new Date(nextWeek.getTime() + 5 * 24 * 60 * 60 * 1000).toISOString(),
      end: new Date(nextWeek.getTime() + 5 * 24 * 60 * 60 * 1000 + 4 * 60 * 60 * 1000).toISOString(),
      venue: { 
        name: 'MALBA', 
        address: 'Av. Figueroa Alcorta 3415, C1425 Cdad. Autónoma de Buenos Aires' 
      },
      location: { lat: -34.5889, lng: -58.4019 },
      tags: ['выставка', 'искусство', 'культура'],
      price: { is_free: false, text: 'ARS 1500' }
    }
  ];
}

async function main() {
  console.log('🎭 Сбор событий Буэнос-Айреса...');
  
  // Создаем тестовые события для демонстрации
  const sampleEvents = createSampleEvents();
  
  // Фильтруем и обрабатываем события
  const now = new Date();
  const processedEvents = sampleEvents
    .filter(event => {
      const eventDate = new Date(event.start);
      return eventDate >= now; // Только будущие события
    })
    .map(event => ({
      ...event,
      start: new Date(event.start).toISOString(),
      end: new Date(event.end).toISOString()
    }))
    .sort((a, b) => new Date(a.start) - new Date(b.start));
  
  // Сохраняем результаты
  if (!fs.existsSync(path.join(ROOT, 'data'))) {
    fs.mkdirSync(path.join(ROOT, 'data'), { recursive: true });
  }
  
  fs.writeFileSync(OUT_JSON, JSON.stringify(processedEvents, null, 2));
  fs.writeFileSync(OUT_JS, `window.EVENTS = ${JSON.stringify(processedEvents)};`);
  
  console.log(`\n✅ Собрано ${processedEvents.length} событий`);
  console.log(`📁 Сохранено в ${OUT_JSON} и ${OUT_JS}`);
  
  // Выводим статистику
  const tagStats = {};
  processedEvents.forEach(event => {
    event.tags.forEach(tag => {
      tagStats[tag] = (tagStats[tag] || 0) + 1;
    });
  });
  
  console.log('\n📊 Статистика по тегам:');
  Object.entries(tagStats)
    .sort(([,a], [,b]) => b - a)
    .forEach(([tag, count]) => {
      console.log(`  ${tag}: ${count} событий`);
    });
}

main().catch(e => {
  console.error('❌ Ошибка:', e);
  process.exit(1);
});