// Перевод событий на русский язык
import fs from 'fs';
import path from 'path';

const ROOT = process.cwd();
const EVENTS_FILE = path.join(ROOT, 'data', 'events.js');

// Словарь переводов
const TRANSLATIONS = {
  // Общие слова
  'Visita guiada': 'Экскурсия',
  'Propuestas educativas': 'Образовательные программы',
  'Actividad para familias': 'Семейные мероприятия',
  'Agenda, Exposiciones': 'Афиша, Выставки',
  
  // Названия экскурсий
  'Auguste Rodin. Cuerpo y movimiento': 'Огюст Роден. Тело и движение',
  'El arte de los antiguos pueblos andinos': 'Искусство древних андских народов',
  'La vanguardia rioplatense': 'Риоплатский авангард',
  'Paisajes de colección': 'Пейзажи из коллекции',
  'Arte argentino del siglo XIX': 'Аргентинское искусство XIX века',
  'Increíbles, imperdibles, inolvidables': 'Невероятные, незабываемые, незабываемые',
  'Una aventura en colores: azules profundos': 'Приключение в цветах: глубокие синие',
  'Entre telas y botones': 'Между тканями и пуговицами',
  'Coloreando junto a los pintores de La Boca': 'Раскрашивая вместе с художниками Ла-Боки',
  
  // Дни недели
  'Miércoles': 'Среда',
  'Jueves': 'Четверг',
  'Sábado': 'Суббота',
  'Domingo': 'Воскресенье',
  'Martes': 'Вторник',
  'Fin de semana': 'Выходные',
  
  // Время
  'a las': 'в',
  'h': 'ч',
  'Del': 'С',
  'al': 'по',
  'de octubre de 2025': 'октября 2025',
  'de julio al': 'июля по',
  'de octubre de 2025': 'октября 2025',
  
  // Места
  'Malba': 'МАЛБА',
  'Место уточняется': 'Место уточняется',
  
  // Теги
  'выставка': 'выставка',
  'детям': 'детям',
  'выходные': 'выходные',
  'театр': 'театр',
  'кино': 'кино',
  
  // Описания
  'Accesibilidad': 'Доступность',
  'Actualmente radicada en Nueva York': 'В настоящее время проживает в Нью-Йорке',
  'vuelve a la Argentina': 'возвращается в Аргентину',
  'presentar una exposición retrospectiva': 'представить ретроспективную выставку',
  'su amplia trayectoria iniciada en los años': 'ее обширная карьера, начавшаяся в годы',
  'En su primera exposición institucional': 'В своей первой институциональной выставке',
  'presenta una serie de obras inéditas': 'представляет серию неизданных работ',
  'Buscando distintas formas de proyección': 'Ищет различные формы проекции',
  'desde': 'с',
  'Leer más': 'Читать далее'
};

// Функция для перевода текста
function translateText(text) {
  if (!text) return text;
  
  let translated = text;
  
  // Применяем переводы
  for (const [spanish, russian] of Object.entries(TRANSLATIONS)) {
    const regex = new RegExp(spanish.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'gi');
    translated = translated.replace(regex, russian);
  }
  
  return translated;
}

// Функция для перевода события
function translateEvent(event) {
  return {
    ...event,
    title: translateText(event.title),
    description: translateText(event.description),
    venue: {
      ...event.venue,
      name: translateText(event.venue.name)
    }
  };
}

// Основная функция
async function main() {
  console.log('🌍 Начинаем перевод событий на русский язык...');
  
  // Загружаем существующие данные
  if (!fs.existsSync(EVENTS_FILE)) {
    console.log('❌ Файл events.js не найден');
    return;
  }
  
  const eventsContent = fs.readFileSync(EVENTS_FILE, 'utf8');
  const eventsMatch = eventsContent.match(/window\.EVENTS\s*=\s*(\[.*?\]);/s);
  
  if (!eventsMatch) {
    console.log('❌ Не удалось извлечь данные из events.js');
    return;
  }
  
  const events = JSON.parse(eventsMatch[1]);
  console.log(`📊 Найдено событий: ${events.length}`);
  
  // Переводим каждое событие
  const translatedEvents = events.map((event, index) => {
    console.log(`🌍 [${index + 1}/${events.length}] Перевод: ${event.title.substring(0, 50)}...`);
    return translateEvent(event);
  });
  
  // Сохраняем переведенные данные
  const translatedContent = `window.EVENTS = ${JSON.stringify(translatedEvents, null, 2)};`;
  fs.writeFileSync(EVENTS_FILE, translatedContent);
  
  console.log(`\n✅ Перевод завершен!`);
  console.log(`📁 Сохранено в: ${EVENTS_FILE}`);
  
  // Показываем примеры переводов
  console.log(`\n📝 Примеры переводов:`);
  translatedEvents.slice(0, 3).forEach((event, index) => {
    console.log(`  ${index + 1}. ${event.title}`);
  });
  
  console.log(`\n🎉 Готово! События переведены на русский язык.`);
}

// Запуск
main().catch(error => {
  console.error('❌ Ошибка:', error);
  process.exit(1);
});

