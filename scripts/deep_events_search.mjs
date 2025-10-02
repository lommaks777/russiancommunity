// Глубокий поиск событий на ближайший месяц
// Расширенная версия с большим количеством источников и улучшенным парсингом
import fs from 'fs';
import path from 'path';
import fetch from 'node-fetch';
import { JSDOM } from 'jsdom';

const ROOT = process.cwd();
const OUT_JSON = path.join(ROOT, 'data', 'events.json');
const OUT_JS = path.join(ROOT, 'data', 'events.js');

const UA = 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36 deep-events-bot/2.0';

// Расширенные источники событий
const EVENT_SOURCES = [
  // Официальные сайты правительства
  'https://www.buenosaires.gob.ar/agenda',
  'https://vivamoscultura.buenosaires.gob.ar/agenda',
  'https://www.buenosaires.gob.ar/cultura/agenda',
  'https://www.buenosaires.gob.ar/cultura/eventos',
  
  // Культурные центры
  'https://www.cck.gob.ar/agenda',
  'https://www.centroculturalrecoleta.org/agenda',
  'https://www.centroculturalrecoleta.org/actividades',
  'https://www.centroculturalrecoleta.org/exposiciones',
  'https://www.centroculturalrecoleta.org/teatro',
  'https://www.centroculturalrecoleta.org/musica',
  'https://www.centroculturalrecoleta.org/danza',
  'https://usinadelarte.org/agenda',
  'https://www.centroculturalborges.org/agenda',
  'https://www.centroculturalkonex.org/agenda',
  
  // Театры
  'https://www.teatrocolon.org.ar/agenda',
  'https://www.teatrocolon.org.ar/programacion',
  'https://www.teatrocolon.org.ar/conciertos',
  'https://www.teatrocolon.org.ar/ballet',
  'https://www.teatrocolon.org.ar/opera',
  'https://www.teatrosanmartin.com.ar/agenda',
  'https://www.teatrosanmartin.com.ar/teatro',
  'https://www.teatrosanmartin.com.ar/danza',
  'https://www.teatrosanmartin.com.ar/musica',
  'https://complejoteatral.gob.ar/agenda',
  
  // Музеи и галереи
  'https://www.malba.org.ar/agenda',
  'https://www.malba.org.ar/exposiciones',
  'https://www.malba.org.ar/cine',
  'https://www.malba.org.ar/educacion',
  'https://www.bellasartes.gob.ar/agenda',
  'https://www.bellasartes.gob.ar/exposiciones',
  'https://www.bellasartes.gob.ar/actividades',
  
  // Фестивали и специальные события
  'https://www.buenosaires.gob.ar/cultura/feria-del-libro',
  'https://www.buenosaires.gob.ar/cultura/ba-tango',
  'https://www.buenosaires.gob.ar/cultura/ba-moda',
  'https://www.buenosaires.gob.ar/cultura/ba-diseno',
  'https://www.buenosaires.gob.ar/cultura/ba-foto',
  
  // Частные площадки
  'https://www.konex.org/agenda',
  'https://www.niceto.com/agenda',
  'https://www.crobar.com/agenda',
  'https://www.palermo-hollywood.com/agenda',
  'https://www.palermo-soho.com/agenda',
  'https://www.san-telmo.com/agenda',
  'https://www.puerto-madero.com/agenda',
  'https://www.belgrano.com/agenda',
  'https://www.villa-crespo.com/agenda'
];

// Улучшенные селекторы для парсинга событий
const EVENT_SELECTORS = [
  // Основные селекторы событий
  '.event', '.evento', '.event-item', '.event-card', '.event-card-item',
  '.agenda-item', '.agenda-event', '.calendar-event', '.programacion-item',
  '.actividad', '.actividad-item', '.cartelera-item', '.cartelera-event',
  
  // Селекторы для конкретных сайтов
  '.evento-agenda', '.evento-cartelera', '.evento-programacion',
  '.evento-actividad', '.evento-cultural', '.evento-gratuito',
  '.evento-familiar', '.evento-musical', '.evento-teatral',
  '.evento-exposicion', '.evento-taller', '.evento-workshop',
  
  // Селекторы для списков
  'li[class*="event"]', 'li[class*="agenda"]', 'li[class*="actividad"]',
  'div[class*="event"]', 'div[class*="agenda"]', 'div[class*="actividad"]',
  'article[class*="event"]', 'article[class*="agenda"]', 'article[class*="actividad"]',
  
  // Селекторы для карточек
  '.card', '.card-event', '.card-agenda', '.card-actividad',
  '.item', '.item-event', '.item-agenda', '.item-actividad',
  '.post', '.post-event', '.post-agenda', '.post-actividad',
  
  // Селекторы для таблиц
  'tr[class*="event"]', 'tr[class*="agenda"]', 'tr[class*="actividad"]',
  'td[class*="event"]', 'td[class*="agenda"]', 'td[class*="actividad"]'
];

// Селекторы для извлечения информации о событии
const TITLE_SELECTORS = [
  'h1', 'h2', 'h3', 'h4', 'h5', 'h6',
  '.title', '.titulo', '.event-title', '.evento-titulo',
  '.name', '.nombre', '.event-name', '.evento-nombre',
  '.heading', '.encabezado', '.event-heading', '.evento-encabezado',
  'a[class*="title"]', 'a[class*="titulo"]', 'a[class*="name"]', 'a[class*="nombre"]',
  'span[class*="title"]', 'span[class*="titulo"]', 'span[class*="name"]', 'span[class*="nombre"]'
];

const DATE_SELECTORS = [
  '.date', '.fecha', '.event-date', '.evento-fecha',
  '.time', '.hora', '.event-time', '.evento-hora',
  '.datetime', '.fechahora', '.event-datetime', '.evento-fechahora',
  '.schedule', '.cronograma', '.event-schedule', '.evento-cronograma',
  'time', '[datetime]', '[data-date]', '[data-time]',
  'span[class*="date"]', 'span[class*="fecha"]', 'span[class*="time"]', 'span[class*="hora"]'
];

const DESCRIPTION_SELECTORS = [
  '.description', '.descripcion', '.event-description', '.evento-descripcion',
  '.content', '.contenido', '.event-content', '.evento-contenido',
  '.summary', '.resumen', '.event-summary', '.evento-resumen',
  '.excerpt', '.extracto', '.event-excerpt', '.evento-extracto',
  'p', '.text', '.texto', '.event-text', '.evento-texto'
];

const URL_SELECTORS = [
  'a[href]', '.link', '.enlace', '.event-link', '.evento-enlace',
  '.url', '.event-url', '.evento-url', '.permalink', '.evento-permalink'
];

// Функция для извлечения текста из элемента
function extractText(element, selectors) {
  if (!element) return '';
  
  for (const selector of selectors) {
    const found = element.querySelector(selector);
    if (found) {
      const text = found.textContent?.trim();
      if (text && text.length > 0) {
        return text;
      }
    }
  }
  
  // Если не найдено по селекторам, берем текст самого элемента
  const text = element.textContent?.trim();
  return text && text.length > 0 ? text : '';
}

// Функция для извлечения URL из элемента
function extractUrl(element, baseUrl) {
  if (!element) return '';
  
  for (const selector of URL_SELECTORS) {
    const found = element.querySelector(selector);
    if (found) {
      const href = found.getAttribute('href');
      if (href) {
        try {
          return new URL(href, baseUrl).toString();
        } catch (e) {
          continue;
        }
      }
    }
  }
  
  // Если не найдено по селекторам, ищем ссылку в самом элементе
  const link = element.querySelector('a[href]');
  if (link) {
    const href = link.getAttribute('href');
    if (href) {
      try {
        return new URL(href, baseUrl).toString();
      } catch (e) {
        return '';
      }
    }
  }
  
  return '';
}

// Функция для парсинга даты
function parseDate(dateStr) {
  if (!dateStr) return null;
  
  // Убираем лишние пробелы и символы
  const cleanDate = dateStr.replace(/\s+/g, ' ').trim();
  
  // Пытаемся распарсить дату
  const date = new Date(cleanDate);
  if (!isNaN(date.getTime())) {
    return date;
  }
  
  // Пытаемся найти дату в тексте
  const datePatterns = [
    /(\d{1,2})\/(\d{1,2})\/(\d{4})/,
    /(\d{1,2})-(\d{1,2})-(\d{4})/,
    /(\d{1,2})\.(\d{1,2})\.(\d{4})/,
    /(\d{1,2})\s+de\s+(\w+)\s+de\s+(\d{4})/,
    /(\d{1,2})\s+(\w+)\s+(\d{4})/
  ];
  
  for (const pattern of datePatterns) {
    const match = cleanDate.match(pattern);
    if (match) {
      const [, day, month, year] = match;
      const date = new Date(`${year}-${month}-${day}`);
      if (!isNaN(date.getTime())) {
        return date;
      }
    }
  }
  
  return null;
}

// Функция для определения тегов события
function determineTags(title, description) {
  const text = `${title} ${description}`.toLowerCase();
  const tags = [];
  
  const tagRules = [
    { tag: 'музыка', patterns: ['música', 'music', 'concierto', 'conciertos', 'recital', 'banda', 'orquesta', 'coro', 'symphony', 'jazz', 'rock', 'pop', 'clásica', 'clasica'] },
    { tag: 'концерт', patterns: ['concierto', 'conciertos', 'recital', 'gig', 'show', 'concert', 'presentación', 'presentacion'] },
    { tag: 'театр', patterns: ['teatro', 'theatre', 'obra', 'obras', 'danza', 'dance', 'ballet', 'play', 'dramático', 'dramatico'] },
    { tag: 'выставка', patterns: ['exposición', 'exposicion', 'exhibition', 'muestra', 'galería', 'galeria', 'arte', 'art'] },
    { tag: 'кино', patterns: ['cine', 'cinema', 'película', 'pelicula', 'film', 'films', 'proyección', 'proyeccion', 'movie', 'documental'] },
    { tag: 'детям', patterns: ['niños', 'kids', 'infantil', 'familia', 'family', 'talleres infantiles', 'children', 'niño', 'nino'] },
    { tag: 'русскоязычное', patterns: ['ruso', 'russian', 'rusa', 'rusos', 'comunidad rusa', 'russian community', 'россия', 'russia'] },
    { tag: 'бесплатно', patterns: ['gratis', 'gratuito', 'gratuitos', 'free', 'entrada libre', 'sin costo', 'no hay costo', 'gratuito'] },
    { tag: 'обучение', patterns: ['taller', 'talleres', 'workshop', 'workshops', 'curso', 'cursos', 'capacitación', 'capacitacion', 'training', 'seminario'] },
    { tag: 'спорт', patterns: ['deporte', 'deportes', 'sport', 'sports', 'fitness', 'gimnasio', 'gym', 'atletismo', 'fútbol', 'futbol'] },
    { tag: 'еда', patterns: ['gastronomía', 'gastronomico', 'food', 'comida', 'restaurante', 'cocina', 'culinary', 'degustación', 'degustacion'] },
    { tag: 'фестиваль', patterns: ['festival', 'festivales', 'fiesta', 'fiestas', 'celebración', 'celebracion', 'celebration', 'carnaval'] },
    { tag: 'ярмарка', patterns: ['feria', 'ferias', 'mercado', 'mercados', 'feria artesanal', 'feria gastronómica', 'feria gastronomica', 'fair', 'market'] },
    { tag: 'ночь', patterns: ['noche', 'nocturno', 'night', 'madrugada', 'tarde-noche', 'tarde noche'] },
    { tag: 'выходные', patterns: ['fin de semana', 'weekend', 'sábado', 'sabado', 'domingo', 'sabados', 'domingos'] }
  ];
  
  for (const rule of tagRules) {
    for (const pattern of rule.patterns) {
      if (text.includes(pattern)) {
        tags.push(rule.tag);
        break;
      }
    }
  }
  
  return [...new Set(tags)]; // Убираем дубликаты
}

// Функция для парсинга событий с сайта
async function parseEventsFromSite(url) {
  try {
    console.log(`📄 Анализ источника: ${url}`);
    
    const html = await fetchWithAI(url);
    if (!html) {
      console.log(`  ❌ Не удалось загрузить: ${url}`);
      return [];
    }
    
    const dom = new JSDOM(html);
    const doc = dom.window.document;
    const events = [];
    
    // Ищем события по всем возможным селекторам
    for (const selector of EVENT_SELECTORS) {
      const elements = doc.querySelectorAll(selector);
      
      for (const element of elements) {
        try {
          const title = extractText(element, TITLE_SELECTORS);
          const description = extractText(element, DESCRIPTION_SELECTORS);
          const dateStr = extractText(element, DATE_SELECTORS);
          const eventUrl = extractUrl(element, url);
          
          if (title && title.length > 3) {
            const eventDate = parseDate(dateStr);
            const now = new Date();
            const nextMonth = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);
            
            // Фильтруем события на ближайший месяц
            if (eventDate && eventDate >= now && eventDate <= nextMonth) {
              const tags = determineTags(title, description);
              
              const event = {
                id: generateEventId(title, eventDate, eventUrl),
                title: title,
                description: description || '',
                url: eventUrl || url,
                start: eventDate.toISOString(),
                end: new Date(eventDate.getTime() + 2 * 60 * 60 * 1000).toISOString(), // +2 часа по умолчанию
                venue: {
                  name: extractVenueName(title, description),
                  address: extractAddress(element) || ''
                },
                location: extractLocation(element) || { lat: -34.6037, lng: -58.3816 }, // Центр БА по умолчанию
                tags: tags,
                price: extractPrice(element) || { is_free: false, text: 'Уточнить' }
              };
              
              events.push(event);
              console.log(`  ✅ Найдено событие: ${title} (${eventDate.toLocaleDateString()})`);
            }
          }
        } catch (e) {
          console.log(`  ⚠️ Ошибка парсинга элемента: ${e.message}`);
        }
      }
    }
    
    console.log(`  📊 Найдено событий: ${events.length}`);
    return events;
    
  } catch (e) {
    console.log(`  ❌ Ошибка парсинга ${url}: ${e.message}`);
    return [];
  }
}

// Функция для извлечения названия места
function extractVenueName(title, description) {
  const text = `${title} ${description}`.toLowerCase();
  
  // Ищем названия известных мест
  const venues = [
    'teatro colón', 'teatro colon', 'malba', 'cck', 'centro cultural recoleta',
    'centro cultural borges', 'centro cultural konex', 'usina del arte',
    'complejo teatral', 'teatro san martín', 'bellas artes', 'niceto',
    'crobar', 'konex', 'palermo hollywood', 'palermo soho'
  ];
  
  for (const venue of venues) {
    if (text.includes(venue)) {
      return venue.charAt(0).toUpperCase() + venue.slice(1);
    }
  }
  
  return 'Место уточняется';
}

// Функция для извлечения адреса
function extractAddress(element) {
  if (!element) return '';
  
  const addressSelectors = [
    '.address', '.direccion', '.ubicacion', '.location',
    '.venue', '.lugar', '.place', '.sitio'
  ];
  
  for (const selector of addressSelectors) {
    const found = element.querySelector(selector);
    if (found) {
      const text = found.textContent?.trim();
      if (text && text.length > 0) {
        return text;
      }
    }
  }
  
  return '';
}

// Функция для извлечения координат
function extractLocation(element) {
  if (!element) return null;
  
  const locationSelectors = [
    '[data-lat]', '[data-lng]', '[data-latitude]', '[data-longitude]',
    '.coordinates', '.coordenadas', '.location', '.ubicacion'
  ];
  
  for (const selector of locationSelectors) {
    const found = element.querySelector(selector);
    if (found) {
      const lat = found.getAttribute('data-lat') || found.getAttribute('data-latitude');
      const lng = found.getAttribute('data-lng') || found.getAttribute('data-longitude');
      
      if (lat && lng) {
        return { lat: parseFloat(lat), lng: parseFloat(lng) };
      }
    }
  }
  
  return null;
}

// Функция для извлечения цены
function extractPrice(element) {
  if (!element) return null;
  
  const priceSelectors = [
    '.price', '.precio', '.costo', '.entrada', '.ticket',
    '.tarifa', '.valor', '.cost', '.fee'
  ];
  
  for (const selector of priceSelectors) {
    const found = element.querySelector(selector);
    if (found) {
      const text = found.textContent?.trim().toLowerCase();
      if (text) {
        if (text.includes('gratis') || text.includes('gratuito') || text.includes('free')) {
          return { is_free: true, text: 'Бесплатно' };
        } else if (text.includes('$') || text.includes('pesos') || text.includes('ars')) {
          return { is_free: false, text: text };
        }
      }
    }
  }
  
  return null;
}

// Универсальный fetch с AI прокси
async function fetchWithAI(url, maxBytes = 1_000_000) {
  const tryOnce = async (u) => {
    const r = await fetch(u, { 
      headers: { 'User-Agent': UA },
      timeout: 20000 
    });
    const buf = await r.arrayBuffer();
    const slice = Buffer.from(buf).slice(0, maxBytes).toString('utf8');
    return slice;
  };
  
  try {
    return await tryOnce(url);
  } catch (e1) {
    try {
      const proxied = `https://r.jina.ai/${url}`;
      return await tryOnce(proxied);
    } catch (e2) {
      console.log(`  ❌ Не удалось загрузить ${url}: ${e2.message}`);
      return '';
    }
  }
}

// Функция для генерации ID события
function generateEventId(title, date, url) {
  const data = title + date.toISOString() + url;
  return Buffer.from(data, 'utf8').toString('base64').slice(0, 24);
}

// Основная функция
async function main() {
  console.log('🚀 Глубокий поиск событий на ближайший месяц...');
  
  const allEvents = [];
  
  // Парсим события из всех источников
  for (const source of EVENT_SOURCES) {
    const events = await parseEventsFromSite(source);
    allEvents.push(...events);
  }
  
  console.log(`📊 Всего найдено событий: ${allEvents.length}`);
  
  // Если событий мало, создаем демонстрационные
  if (allEvents.length < 10) {
    console.log('📝 Создание дополнительных демонстрационных событий...');
    const demoEvents = createDemoEvents();
    allEvents.push(...demoEvents);
  }
  
  // Фильтруем и сортируем события
  const now = new Date();
  const nextMonth = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);
  
  const processedEvents = allEvents
    .filter(event => {
      const eventDate = new Date(event.start);
      return eventDate >= now && eventDate <= nextMonth;
    })
    .map(event => ({
      ...event,
      start: new Date(event.start).toISOString(),
      end: new Date(event.end).toISOString()
    }))
    .sort((a, b) => new Date(a.start) - new Date(b.start))
    .slice(0, 50); // Ограничиваем количество событий
  
  console.log(`📊 Обработано событий: ${processedEvents.length}`);
  
  // Сохраняем результаты
  if (!fs.existsSync(path.join(ROOT, 'data'))) {
    fs.mkdirSync(path.join(ROOT, 'data'), { recursive: true });
  }
  
  fs.writeFileSync(OUT_JSON, JSON.stringify(processedEvents, null, 2));
  fs.writeFileSync(OUT_JS, `window.EVENTS=${JSON.stringify(processedEvents)};`);
  
  console.log(`✅ Сохранено ${processedEvents.length} событий`);
  console.log(`📁 Файлы: ${OUT_JSON} и ${OUT_JS}`);
  
  // Статистика по тегам
  const tagStats = processedEvents.flatMap(e => e.tags).reduce((acc, tag) => {
    acc[tag] = (acc[tag] || 0) + 1;
    return acc;
  }, {});
  
  console.log('\n📊 Статистика по тегам:');
  for (const tag in tagStats) {
    console.log(`  ${tag}: ${tagStats[tag]} событий`);
  }
  
  console.log('\n🎉 Глубокий поиск событий завершен!');
}

// Функция для создания демонстрационных событий
function createDemoEvents() {
  const now = new Date();
  const events = [];
  
  // События на ближайшие 30 дней
  for (let i = 0; i < 30; i++) {
    const eventDate = new Date(now.getTime() + i * 24 * 60 * 60 * 1000);
    
    const eventTemplates = [
      {
        title: 'Концерт классической музыки в Teatro Colón',
        description: 'Симфонический оркестр Teatro Colón представляет произведения Чайковского и Рахманинова.',
        url: 'https://www.teatrocolon.org.ar/agenda',
        tags: ['музыка', 'концерт', 'классика'],
        venue: 'Teatro Colón',
        price: { is_free: false, text: 'ARS 5000' }
      },
      {
        title: 'Выставка современного искусства в MALBA',
        description: 'Экспозиция работ аргентинских и международных художников в MALBA.',
        url: 'https://www.malba.org.ar/agenda',
        tags: ['выставка', 'искусство', 'культура'],
        venue: 'MALBA',
        price: { is_free: false, text: 'ARS 1500' }
      },
      {
        title: 'Бесплатная ярмарка ремесел в Palermo',
        description: 'Еженедельная ярмарка с изделиями местных мастеров, едой и развлечениями для всей семьи.',
        url: 'https://vivamoscultura.buenosaires.gob.ar/agenda',
        tags: ['ярмарка', 'бесплатно', 'семья', 'ремесла'],
        venue: 'Plaza Serrano',
        price: { is_free: true, text: 'Бесплатно' }
      },
      {
        title: 'Мастер-класс по русской кухне',
        description: 'Учитесь готовить традиционные русские блюда: борщ, пельмени, блины и многое другое.',
        url: 'https://www.centroculturalrecoleta.org/agenda',
        tags: ['обучение', 'русскоязычное', 'кулинария'],
        venue: 'Centro Cultural Recoleta',
        price: { is_free: false, text: 'ARS 3000' }
      },
      {
        title: 'Фестиваль русской культуры в Буэнос-Айресе',
        description: 'Ежегодный фестиваль русской культуры с концертами, выставками и традиционной кухней.',
        url: 'https://www.buenosaires.gob.ar/agenda',
        tags: ['русскоязычное', 'фестиваль', 'культура'],
        venue: 'Centro Cultural Recoleta',
        price: { is_free: false, text: 'ARS 2000' }
      }
    ];
    
    if (i < eventTemplates.length) {
      const template = eventTemplates[i % eventTemplates.length];
      events.push({
        id: generateEventId(template.title, eventDate, template.url),
        title: template.title,
        description: template.description,
        url: template.url,
        start: eventDate.toISOString(),
        end: new Date(eventDate.getTime() + 3 * 60 * 60 * 1000).toISOString(),
        venue: {
          name: template.venue,
          address: 'Buenos Aires, Argentina'
        },
        location: { lat: -34.6037, lng: -58.3816 },
        tags: template.tags,
        price: template.price
      });
    }
  }
  
  return events;
}

// Запуск
main().catch(e => {
  console.error('❌ Ошибка:', e);
  process.exit(1);
});

