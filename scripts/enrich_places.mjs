// Обогащение данных о местах с помощью Google Places API
// Получает подробные описания, рейтинги, отзывы и другую информацию
import fs from 'fs';
import path from 'path';
import fetch from 'node-fetch';

const ROOT = process.cwd();
const PLACES_FILE = path.join(ROOT, 'data', 'places.js');
const ENRICHED_PLACES_FILE = path.join(ROOT, 'data', 'places_enriched.js');

const GOOGLE_KEY = "AIzaSyB7-RgotVuWFR6qMvr_Alf8nQvkYd7I3WI";

// Функция для получения подробной информации о месте
async function getPlaceDetails(placeId) {
  try {
    const url = `https://maps.googleapis.com/maps/api/place/details/json?place_id=${placeId}&fields=name,rating,user_ratings_total,reviews,editorial_summary,formatted_address,formatted_phone_number,website,opening_hours,price_level,types,photos&key=${GOOGLE_KEY}`;
    
    const response = await fetch(url);
    const data = await response.json();
    
    if (data.status === 'OK' && data.result) {
      return data.result;
    }
    
    return null;
  } catch (error) {
    console.log(`❌ Ошибка получения данных для ${placeId}: ${error.message}`);
    return null;
  }
}

// Функция для получения фотографий места
async function getPlacePhotos(placeId) {
  try {
    const url = `https://maps.googleapis.com/maps/api/place/details/json?place_id=${placeId}&fields=photos&key=${GOOGLE_KEY}`;
    
    const response = await fetch(url);
    const data = await response.json();
    
    if (data.status === 'OK' && data.result && data.result.photos) {
      return data.result.photos.slice(0, 3); // Берем первые 3 фото
    }
    
    return [];
  } catch (error) {
    console.log(`❌ Ошибка получения фото для ${placeId}: ${error.message}`);
    return [];
  }
}

// Функция для генерации звездного рейтинга
function generateStars(rating) {
  if (!rating) return '';
  
  const fullStars = Math.floor(rating);
  const hasHalfStar = rating % 1 >= 0.5;
  const emptyStars = 5 - fullStars - (hasHalfStar ? 1 : 0);
  
  let stars = '★'.repeat(fullStars);
  if (hasHalfStar) stars += '☆';
  stars += '☆'.repeat(emptyStars);
  
  return stars;
}

// Функция для определения типа места
function getPlaceType(types) {
  if (!types || !Array.isArray(types)) return 'Место';
  
  const typeMap = {
    'restaurant': 'Ресторан',
    'food': 'Еда',
    'bar': 'Бар',
    'cafe': 'Кафе',
    'bakery': 'Пекарня',
    'store': 'Магазин',
    'shopping_mall': 'Торговый центр',
    'gym': 'Спортзал',
    'spa': 'Спа',
    'beauty_salon': 'Салон красоты',
    'hospital': 'Больница',
    'pharmacy': 'Аптека',
    'bank': 'Банк',
    'atm': 'Банкомат',
    'gas_station': 'Заправка',
    'parking': 'Парковка',
    'subway_station': 'Станция метро',
    'bus_station': 'Автобусная остановка',
    'airport': 'Аэропорт',
    'hotel': 'Отель',
    'tourist_attraction': 'Достопримечательность',
    'museum': 'Музей',
    'library': 'Библиотека',
    'school': 'Школа',
    'university': 'Университет',
    'church': 'Церковь',
    'mosque': 'Мечеть',
    'synagogue': 'Синагога',
    'hindu_temple': 'Храм',
    'cemetery': 'Кладбище',
    'park': 'Парк',
    'zoo': 'Зоопарк',
    'aquarium': 'Аквариум',
    'amusement_park': 'Парк развлечений',
    'movie_theater': 'Кинотеатр',
    'theater': 'Театр',
    'night_club': 'Ночной клуб',
    'casino': 'Казино',
    'bowling_alley': 'Боулинг',
    'pool': 'Бассейн',
    'golf_course': 'Гольф-клуб',
    'stadium': 'Стадион',
    'gym': 'Спортзал',
    'yoga': 'Йога',
    'dance': 'Танцы',
    'music': 'Музыка',
    'art_gallery': 'Художественная галерея',
    'book_store': 'Книжный магазин',
    'clothing_store': 'Одежда',
    'shoe_store': 'Обувь',
    'jewelry_store': 'Ювелирный магазин',
    'electronics_store': 'Электроника',
    'furniture_store': 'Мебель',
    'home_goods_store': 'Товары для дома',
    'hardware_store': 'Хозтовары',
    'pet_store': 'Зоомагазин',
    'florist': 'Цветочный магазин',
    'laundry': 'Прачечная',
    'dry_cleaning': 'Химчистка',
    'car_repair': 'Автосервис',
    'car_wash': 'Автомойка',
    'car_rental': 'Аренда авто',
    'bicycle_store': 'Велосипедный магазин',
    'travel_agency': 'Турагентство',
    'real_estate_agency': 'Агентство недвижимости',
    'insurance_agency': 'Страховая компания',
    'accounting': 'Бухгалтерия',
    'lawyer': 'Юрист',
    'dentist': 'Стоматолог',
    'doctor': 'Врач',
    'veterinary_care': 'Ветеринар',
    'funeral_home': 'Похоронное бюро',
    'embassy': 'Посольство',
    'local_government_office': 'Госучреждение',
    'post_office': 'Почта',
    'police': 'Полиция',
    'fire_station': 'Пожарная часть',
    'courthouse': 'Суд',
    'city_hall': 'Ратуша',
    'library': 'Библиотека',
    'school': 'Школа',
    'university': 'Университет',
    'hospital': 'Больница',
    'pharmacy': 'Аптека',
    'dentist': 'Стоматолог',
    'doctor': 'Врач',
    'veterinary_care': 'Ветеринар',
    'beauty_salon': 'Салон красоты',
    'spa': 'Спа',
    'gym': 'Спортзал',
    'yoga': 'Йога',
    'dance': 'Танцы',
    'music': 'Музыка',
    'art_gallery': 'Художественная галерея',
    'museum': 'Музей',
    'tourist_attraction': 'Достопримечательность',
    'park': 'Парк',
    'zoo': 'Зоопарк',
    'aquarium': 'Аквариум',
    'amusement_park': 'Парк развлечений',
    'movie_theater': 'Кинотеатр',
    'theater': 'Театр',
    'night_club': 'Ночной клуб',
    'casino': 'Казино',
    'bowling_alley': 'Боулинг',
    'pool': 'Бассейн',
    'golf_course': 'Гольф-клуб',
    'stadium': 'Стадион',
    'gym': 'Спортзал',
    'yoga': 'Йога',
    'dance': 'Танцы',
    'music': 'Музыка',
    'art_gallery': 'Художественная галерея',
    'book_store': 'Книжный магазин',
    'clothing_store': 'Одежда',
    'shoe_store': 'Обувь',
    'jewelry_store': 'Ювелирный магазин',
    'electronics_store': 'Электроника',
    'furniture_store': 'Мебель',
    'home_goods_store': 'Товары для дома',
    'hardware_store': 'Хозтовары',
    'pet_store': 'Зоомагазин',
    'florist': 'Цветочный магазин',
    'laundry': 'Прачечная',
    'dry_cleaning': 'Химчистка',
    'car_repair': 'Автосервис',
    'car_wash': 'Автомойка',
    'car_rental': 'Аренда авто',
    'bicycle_store': 'Велосипедный магазин',
    'travel_agency': 'Турагентство',
    'real_estate_agency': 'Агентство недвижимости',
    'insurance_agency': 'Страховая компания',
    'accounting': 'Бухгалтерия',
    'lawyer': 'Юрист',
    'dentist': 'Стоматолог',
    'doctor': 'Врач',
    'veterinary_care': 'Ветеринар',
    'funeral_home': 'Похоронное бюро',
    'embassy': 'Посольство',
    'local_government_office': 'Госучреждение',
    'post_office': 'Почта',
    'police': 'Полиция',
    'fire_station': 'Пожарная часть',
    'courthouse': 'Суд',
    'city_hall': 'Ратуша'
  };
  
  for (const type of types) {
    if (typeMap[type]) {
      return typeMap[type];
    }
  }
  
  return 'Место';
}

// Функция для обогащения данных о месте
async function enrichPlace(place) {
  console.log(`🔍 Обогащение данных для: ${place.name}`);
  
  if (!place.place_id) {
    console.log(`  ⚠️ Нет place_id для ${place.name}`);
    return place;
  }
  
  const details = await getPlaceDetails(place.place_id);
  if (!details) {
    console.log(`  ❌ Не удалось получить данные для ${place.name}`);
    return place;
  }
  
  // Обогащаем данные
  const enriched = {
    ...place,
    // Основная информация
    name: details.name || place.name,
    address: details.formatted_address || place.address,
    phone: details.formatted_phone_number || place.phone,
    website: details.website || place.website,
    
    // Рейтинг и отзывы
    rating: details.rating || null,
    user_ratings_total: details.user_ratings_total || 0,
    stars: generateStars(details.rating),
    
    // Описание
    description: details.editorial_summary?.overview || '',
    short_description: details.editorial_summary?.summary || '',
    
    // Тип места
    place_type: getPlaceType(details.types),
    types: details.types || [],
    
    // Ценовой уровень
    price_level: details.price_level || null,
    price_text: details.price_level ? 
      ['Бесплатно', 'Недорого', 'Умеренно', 'Дорого', 'Очень дорого'][details.price_level] : 
      'Не указано',
    
    // Часы работы
    opening_hours: details.opening_hours?.weekday_text || [],
    is_open_now: details.opening_hours?.open_now || null,
    
    // Отзывы
    reviews: details.reviews ? details.reviews.slice(0, 3).map(review => ({
      author: review.author_name,
      rating: review.rating,
      text: review.text,
      time: review.time
    })) : [],
    
    // Дополнительные фото
    photos: details.photos ? details.photos.slice(0, 3).map(photo => ({
      reference: photo.photo_reference,
      url: `https://maps.googleapis.com/maps/api/place/photo?maxwidth=400&photoreference=${photo.photo_reference}&key=${GOOGLE_KEY}`
    })) : [],
    
    // Метаданные
    last_updated: new Date().toISOString(),
    enriched: true
  };
  
  console.log(`  ✅ Обогащено: ${enriched.name} (${enriched.rating ? enriched.rating + '★' : 'Нет рейтинга'})`);
  
  return enriched;
}

// Основная функция
async function main() {
  console.log('🚀 Начинаем обогащение данных о местах...');
  
  // Загружаем существующие данные
  if (!fs.existsSync(PLACES_FILE)) {
    console.log('❌ Файл places.js не найден');
    return;
  }
  
  const placesContent = fs.readFileSync(PLACES_FILE, 'utf8');
  const placesMatch = placesContent.match(/window\.PLACES\s*=\s*(\[.*?\]);/s);
  
  if (!placesMatch) {
    console.log('❌ Не удалось извлечь данные из places.js');
    return;
  }
  
  const places = JSON.parse(placesMatch[1]);
  console.log(`📊 Найдено мест: ${places.length}`);
  
  const enrichedPlaces = [];
  
  // Обогащаем каждое место
  for (let i = 0; i < places.length; i++) {
    const place = places[i];
    console.log(`\n📍 [${i + 1}/${places.length}] Обработка: ${place.name}`);
    
    try {
      const enriched = await enrichPlace(place);
      enrichedPlaces.push(enriched);
      
      // Небольшая задержка между запросами
      await new Promise(resolve => setTimeout(resolve, 100));
      
    } catch (error) {
      console.log(`  ❌ Ошибка обработки ${place.name}: ${error.message}`);
      enrichedPlaces.push(place); // Добавляем оригинальное место
    }
  }
  
  // Сохраняем обогащенные данные
  const enrichedContent = `window.PLACES = ${JSON.stringify(enrichedPlaces, null, 2)};`;
  fs.writeFileSync(ENRICHED_PLACES_FILE, enrichedContent);
  
  console.log(`\n✅ Обогащение завершено!`);
  console.log(`📁 Сохранено в: ${ENRICHED_PLACES_FILE}`);
  
  // Статистика
  const withRating = enrichedPlaces.filter(p => p.rating).length;
  const withDescription = enrichedPlaces.filter(p => p.description).length;
  const withReviews = enrichedPlaces.filter(p => p.reviews && p.reviews.length > 0).length;
  
  console.log(`\n📊 Статистика обогащения:`);
  console.log(`  С рейтингом: ${withRating}/${enrichedPlaces.length}`);
  console.log(`  С описанием: ${withDescription}/${enrichedPlaces.length}`);
  console.log(`  С отзывами: ${withReviews}/${enrichedPlaces.length}`);
  
  console.log(`\n🎉 Готово! Теперь можно использовать обогащенные данные.`);
}

// Запуск
main().catch(error => {
  console.error('❌ Ошибка:', error);
  process.exit(1);
});

