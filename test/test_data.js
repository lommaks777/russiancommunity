// test/test_data.js - Тестовые данные
// Мок-данные для тестирования функций

const mockPlaces = [
  {
    id: 1756745083847,
    name: "SHAWA BAR SPB (shawarma ruso)",
    category: "Бары",
    subtype: "",
    lat: -34.6158736,
    lng: -58.3917964,
    neighborhood: "Balvanera",
    russian_score: 3,
    peak_hours: "",
    instagram: "",
    website: "https://www.instagram.com/shawabarspb/",
    phone: "",
    photo_url: "https://places.googleapis.com/v1/places/ChIJ09cP-KTLvJURiCzUIc1wOOc/photos/ATKogpe930AbkBz0VrWrpIZ9OFUd_H_ZHpMUM0AG2UQpCnGEYnvshNjOoDM9qaRtB6wkvBFuh6yX0mJFQHG9fTY7GLAUbUhqbR5I2oIW-iCTqO55i6VEpD7TEIrbSKB1ge8VCPB_RW-77_wtQAPxhZrw9xyErOtzPLZJuo0DK6ztkwnCtfq4wIjH9IoYoGCu2eT2V2n4y0zKPtNuzYJq0IPaFaLGl2RFQjFlr5WDfjsL3LvCt8fp8YvHMwnxTT6Ql9odyD3lycxS_Q7cvekJaQgwST1hqJ-4b9xIGaSaKympJcqVkw-1x2hD4MMLgosEPxFG5T2K6SRtJwKjhw5qJi_nU7LH9yirN6iPHYezcuID3Gfsiadk4o5vZKmO7qpCiIUHk93iqOzS0oDoMkei7sItua4ojJXdEYJfj8rw52qIdSOpdA/media?maxWidthPx=800&key=AIzaSyB7-RgotVuWFR6qMvr_Alf8nQvkYd7I3WI",
    address: "Av. Entre Ríos 615, C1080ABA, C1080 Cdad. Autónoma de Buenos Aires, Аргентина",
    place_id: "ChIJ09cP-KTLvJURiCzUIc1wOOc",
    notes: ""
  },
  {
    id: 1756745262271,
    name: "Aport",
    category: "Бары",
    subtype: "",
    lat: -34.601057100000006,
    lng: -58.4179597,
    neighborhood: "Almagro",
    russian_score: 3,
    peak_hours: "",
    instagram: "",
    website: "http://www.aportdespensa.com/",
    phone: "+54 11 6050-2139",
    photo_url: "https://places.googleapis.com/v1/places/ChIJT7o-dkvLvJURphoTFMdMt04/photos/ATKogpf4k9UIepehjgvN_XXNPan25tuIWWFDvWJ3bxb5R4vFo4jpzS_vTDd7_lg0nBufgxiJAWWKloRwjhuGIZfx-wY41FWyQFemali5XNBoeRV5qhm9_eF9F2VXP-40NA56X3pmyzFNGbSq45q7u-6Dg8WvDOch_GQnkdCTYbJXOoyXBeuiXYqtvF2agT75yjOUtX9VnfYd-hMrgTAUWOb6KrerldVw5xrT2ZTvr4qwRS2THKGSexe0LLnoWqkv5ygUsTzvgNzUWhHJPMt2GoceVax20n_GsDEJJ1uIXIhTlIx8Fw/media?maxWidthPx=800&key=AIzaSyB7-RgotVuWFR6qMvr_Alf8nQvkYd7I3WI",
    address: "Bulnes 900, C1176 Cdad. Autónoma de Buenos Aires, Аргентина",
    place_id: "ChIJT7o-dkvLvJURphoTFMdMt04",
    notes: ""
  }
];

const mockEvents = [
  {
    id: "event1",
    title: "Концерт русской музыки",
    description: "Вечер русской музыки в центре Буэнос-Айреса",
    url: "https://example.com/event1",
    start: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(), // завтра
    end: new Date(Date.now() + 24 * 60 * 60 * 1000 + 3 * 60 * 60 * 1000).toISOString(), // завтра + 3 часа
    venue: { name: "Teatro Colón", address: "Cerrito 628, C1010 Cdad. Autónoma de Buenos Aires" },
    location: { lat: -34.6037, lng: -58.3816 },
    tags: ["музыка", "концерт", "русскоязычное"],
    price: { is_free: false, text: "ARS 5000" }
  },
  {
    id: "event2",
    title: "Бесплатная ярмарка для детей",
    description: "Семейная ярмарка с развлечениями для детей",
    url: "https://example.com/event2",
    start: new Date(Date.now() + 2 * 24 * 60 * 60 * 1000).toISOString(), // послезавтра
    end: new Date(Date.now() + 2 * 24 * 60 * 60 * 1000 + 4 * 60 * 60 * 1000).toISOString(),
    venue: { name: "Parque Las Heras", address: "French, C1425 Cdad. Autónoma de Buenos Aires" },
    location: { lat: -34.5838884, lng: -58.408831899999996 },
    tags: ["ярмарка", "детям", "бесплатно"],
    price: { is_free: true, text: "Бесплатно" }
  },
  {
    id: "event3",
    title: "Прошедшее событие",
    description: "Это событие уже прошло",
    url: "https://example.com/event3",
    start: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString(), // 2 дня назад
    end: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000 + 2 * 60 * 60 * 1000).toISOString(),
    venue: { name: "Старое место", address: "Старый адрес" },
    location: { lat: -34.6037, lng: -58.3816 },
    tags: ["театр"],
    price: { is_free: false, text: "ARS 2000" }
  }
];

const mockRoutes = {
  friday: [1, 2, 3]
};

const mockFormData = {
  name: "Test Place",
  category: "Кофе",
  lat: "-34.6037",
  lng: "-58.3816",
  neighborhood: "Palermo",
  rus: "3",
  peak: "18:00-22:00",
  insta: "@testplace",
  site: "https://testplace.com",
  phone: "+54 11 1234-5678",
  photo: "https://example.com/photo.jpg",
  address: "Test Address 123",
  placeid: "ChIJTest123",
  notes: "Test notes"
};

// Экспорт для тестов
if (typeof module !== 'undefined' && module.exports) {
  module.exports = {
    mockPlaces,
    mockEvents,
    mockRoutes,
    mockFormData
  };
}

