// test/test_suite.js - Основной набор тестов
const { 
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
} = require('./test_utils');

const { mockPlaces, mockEvents, mockFormData } = require('./test_data');

// Утилиты для тестирования
function assert(condition, message) {
  if (!condition) {
    throw new Error(`Assertion failed: ${message}`);
  }
}

function assertEquals(actual, expected, message) {
  if (actual !== expected) {
    throw new Error(`Assertion failed: ${message}. Expected: ${expected}, Actual: ${actual}`);
  }
}

function assertArrayLength(array, expectedLength, message) {
  if (array.length !== expectedLength) {
    throw new Error(`Assertion failed: ${message}. Expected length: ${expectedLength}, Actual: ${array.length}`);
  }
}

function assertTrue(condition, message) {
  if (!condition) {
    throw new Error(`Assertion failed: ${message}`);
  }
}

function assertFalse(condition, message) {
  if (condition) {
    throw new Error(`Assertion failed: ${message}`);
  }
}

// Тесты для withKeyForPlacesMedia
function testWithKeyForPlacesMedia() {
  console.log('🧪 Testing withKeyForPlacesMedia...');
  
  // Тест с URL без ключа
  const urlWithoutKey = "https://places.googleapis.com/v1/places/ChIJTest/photos/ATKogpe/media?maxWidthPx=800";
  const result1 = withKeyForPlacesMedia(urlWithoutKey);
  assertTrue(result1.includes('key='), 'Should add key parameter to Places API URL');
  
  // Тест с URL уже содержащим ключ
  const urlWithKey = "https://places.googleapis.com/v1/places/ChIJTest/photos/ATKogpe/media?maxWidthPx=800&key=test";
  const result2 = withKeyForPlacesMedia(urlWithKey);
  assertEquals(result2, urlWithKey, 'Should not modify URL that already has key');
  
  // Тест с пустым URL
  const result3 = withKeyForPlacesMedia("");
  assertEquals(result3, "", 'Should return empty string for empty URL');
  
  // Тест с не-Places API URL
  const nonPlacesUrl = "https://example.com/image.jpg";
  const result4 = withKeyForPlacesMedia(nonPlacesUrl);
  assertEquals(result4, nonPlacesUrl, 'Should return original URL for non-Places API URL');
  
  console.log('✅ withKeyForPlacesMedia tests passed');
}

// Тесты для emojiFor
function testEmojiFor() {
  console.log('🧪 Testing emojiFor...');
  
  // Тест с событием с тегами
  const eventWithTags = { tags: ['музыка', 'концерт'] };
  const result1 = emojiFor(eventWithTags);
  assertEquals(result1, '🎵', 'Should return music emoji for music tag');
  
  // Тест с событием без тегов
  const eventWithoutTags = { tags: [] };
  const result2 = emojiFor(eventWithoutTags);
  assertEquals(result2, '🎟️', 'Should return default ticket emoji for no tags');
  
  // Тест с событием без поля tags
  const eventNoTags = {};
  const result3 = emojiFor(eventNoTags);
  assertEquals(result3, '🎟️', 'Should return default ticket emoji for missing tags');
  
  console.log('✅ emojiFor tests passed');
}

// Тесты для whenText
function testWhenText() {
  console.log('🧪 Testing whenText...');
  
  const now = new Date();
  const tomorrow = new Date(now.getTime() + 24 * 60 * 60 * 1000);
  const tomorrowEnd = new Date(tomorrow.getTime() + 3 * 60 * 60 * 1000);
  
  const event = {
    start: tomorrow.toISOString(),
    end: tomorrowEnd.toISOString()
  };
  
  const result = whenText(event);
  assertTrue(result.includes('2024') || result.includes('2025'), 'Should contain year');
  assertTrue(result.includes(':'), 'Should contain time');
  
  console.log('✅ whenText tests passed');
}

// Тесты для upcomingOnly
function testUpcomingOnly() {
  console.log('🧪 Testing upcomingOnly...');
  
  const result = upcomingOnly(mockEvents);
  assertArrayLength(result, 2, 'Should filter out past events');
  
  // Проверяем, что прошедшее событие исключено
  const pastEvent = result.find(e => e.id === 'event3');
  assertTrue(pastEvent === undefined, 'Should exclude past events');
  
  console.log('✅ upcomingOnly tests passed');
}

// Тесты для filtered
function testFiltered() {
  console.log('🧪 Testing filtered...');
  
  // Тест фильтрации по тегу
  const musicEvents = filtered(mockEvents, 'музыка', '', '');
  assertArrayLength(musicEvents, 1, 'Should filter by tag');
  assertEquals(musicEvents[0].id, 'event1', 'Should return correct event for music tag');
  
  // Тест фильтрации по цене
  const freeEvents = filtered(mockEvents, '', 'free', '');
  assertArrayLength(freeEvents, 1, 'Should filter by free price');
  assertEquals(freeEvents[0].id, 'event2', 'Should return correct free event');
  
  // Тест поиска по тексту
  const searchResults = filtered(mockEvents, '', '', 'ярмарка');
  assertArrayLength(searchResults, 1, 'Should filter by search query');
  assertEquals(searchResults[0].id, 'event2', 'Should return correct event for search');
  
  console.log('✅ filtered tests passed');
}

// Тесты для clearForm
function testClearForm() {
  console.log('🧪 Testing clearForm...');
  
  const fields = ['name', 'category', 'lat', 'lng', 'rus', 'query'];
  const result = clearForm(fields, true, true);
  
  assertEquals(result.rus, 3, 'Should set russian_score to 3');
  assertTrue(result.name === '', 'Should clear name field');
  assertTrue(result.lat === '', 'Should clear lat field');
  
  console.log('✅ clearForm tests passed');
}

// Тесты для buildJson
function testBuildJson() {
  console.log('🧪 Testing buildJson...');
  
  const result = buildJson(mockFormData);
  
  assertEquals(result.name, 'Test Place', 'Should set correct name');
  assertEquals(result.category, 'Кофе', 'Should set correct category');
  assertEquals(result.lat, -34.6037, 'Should set correct latitude');
  assertEquals(result.lng, -58.3816, 'Should set correct longitude');
  assertEquals(result.russian_score, 3, 'Should set correct russian score');
  assertTrue(typeof result.id === 'number', 'Should generate numeric ID');
  
  console.log('✅ buildJson tests passed');
}

// Тесты для tagify
function testTagify() {
  console.log('🧪 Testing tagify...');
  
  const text1 = 'Concert de música rusa en Buenos Aires';
  const result1 = tagify(text1);
  assertTrue(result1.includes('музыка'), 'Should detect music tag');
  assertTrue(result1.includes('концерт'), 'Should detect concert tag');
  assertTrue(result1.includes('русскоязычное'), 'Should detect Russian tag');
  
  const text2 = 'Free kids party with live music';
  const result2 = tagify(text2);
  assertTrue(result2.includes('бесплатно'), 'Should detect free tag');
  assertTrue(result2.includes('детям'), 'Should detect kids tag');
  assertTrue(result2.includes('музыка'), 'Should detect music tag');
  
  const text3 = 'Regular text without special keywords';
  const result3 = tagify(text3);
  assertArrayLength(result3, 0, 'Should return empty array for text without keywords');
  
  console.log('✅ tagify tests passed');
}

// Тесты для priceFrom
function testPriceFrom() {
  console.log('🧪 Testing priceFrom...');
  
  // Тест бесплатного события
  const freeText = 'Evento gratuito para toda la familia';
  const result1 = priceFrom(freeText);
  assertTrue(result1.is_free, 'Should detect free event');
  assertEquals(result1.text, 'Бесплатно', 'Should set correct free text');
  
  // Тест платного события
  const paidText = 'Entrada: ARS 5000 por persona';
  const result2 = priceFrom(paidText);
  assertFalse(result2.is_free, 'Should detect paid event');
  assertTrue(result2.text.includes('ARS'), 'Should extract price information');
  
  // Тест без информации о цене
  const noPriceText = 'Evento sin información de precio';
  const result3 = priceFrom(noPriceText);
  assertFalse(result3.is_free, 'Should default to paid event');
  assertEquals(result3.text, '', 'Should return empty text for no price info');
  
  console.log('✅ priceFrom tests passed');
}

// Тесты для firstSentences
function testFirstSentences() {
  console.log('🧪 Testing firstSentences...');
  
  const longText = 'Это первое предложение. Это второе предложение. Это третье предложение. И еще много текста...';
  const result1 = firstSentences(longText);
  assertTrue(result1.includes('первое предложение'), 'Should include first sentence');
  assertTrue(result1.includes('второе предложение'), 'Should include second sentence');
  assertTrue(result1.length <= 220, 'Should respect maxChars limit');
  
  const shortText = 'Короткий текст.';
  const result2 = firstSentences(shortText);
  assertEquals(result2, shortText, 'Should return short text unchanged');
  
  const emptyText = '';
  const result3 = firstSentences(emptyText);
  assertEquals(result3, '', 'Should return empty string for empty input');
  
  console.log('✅ firstSentences tests passed');
}

// Тесты структуры данных
function testDataStructure() {
  console.log('🧪 Testing data structure...');
  
  // Тест структуры места
  const place = mockPlaces[0];
  assertTrue(typeof place.id === 'number', 'Place should have numeric ID');
  assertTrue(typeof place.name === 'string', 'Place should have name');
  assertTrue(typeof place.lat === 'number', 'Place should have latitude');
  assertTrue(typeof place.lng === 'number', 'Place should have longitude');
  assertTrue(typeof place.category === 'string', 'Place should have category');
  
  // Тест структуры события
  const event = mockEvents[0];
  assertTrue(typeof event.id === 'string', 'Event should have string ID');
  assertTrue(typeof event.title === 'string', 'Event should have title');
  assertTrue(typeof event.start === 'string', 'Event should have start time');
  assertTrue(Array.isArray(event.tags), 'Event should have tags array');
  assertTrue(typeof event.price === 'object', 'Event should have price object');
  
  console.log('✅ data structure tests passed');
}

// Запуск всех тестов
function runAllTests() {
  console.log('🚀 Starting test suite for Russian Community Map...\n');
  
  try {
    testWithKeyForPlacesMedia();
    testEmojiFor();
    testWhenText();
    testUpcomingOnly();
    testFiltered();
    testClearForm();
    testBuildJson();
    testTagify();
    testPriceFrom();
    testFirstSentences();
    testDataStructure();
    
    console.log('\n🎉 All tests passed successfully!');
    console.log('📊 Test Summary:');
    console.log('   ✅ withKeyForPlacesMedia: Working correctly');
    console.log('   ✅ emojiFor: Working correctly');
    console.log('   ✅ whenText: Working correctly');
    console.log('   ✅ upcomingOnly: Working correctly');
    console.log('   ✅ filtered: Working correctly');
    console.log('   ✅ clearForm: Working correctly');
    console.log('   ✅ buildJson: Working correctly');
    console.log('   ✅ tagify: Working correctly');
    console.log('   ✅ priceFrom: Working correctly');
    console.log('   ✅ firstSentences: Working correctly');
    console.log('   ✅ dataStructure: Working correctly');
    
  } catch (error) {
    console.error('\n❌ Test failed:', error.message);
    process.exit(1);
  }
}

// Экспорт для использования
if (typeof module !== 'undefined' && module.exports) {
  module.exports = {
    runAllTests,
    testWithKeyForPlacesMedia,
    testEmojiFor,
    testWhenText,
    testUpcomingOnly,
    testFiltered,
    testClearForm,
    testBuildJson,
    testTagify,
    testPriceFrom,
    testFirstSentences,
    testDataStructure
  };
}

// Запуск тестов если файл выполняется напрямую
if (require.main === module) {
  runAllTests();
}

