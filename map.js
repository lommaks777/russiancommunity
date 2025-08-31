<script>
/** map.js — v2.1: emoji-пины + photo_url с key + категория «Обучение» */
const GOOGLE_KEY = "AIzaSyB7-RgotVuWFR6qMvr_Alf8nQvkYd7I3WI";
const MAP_ID     = "573d7da16cb24e9ec7c4e07e";
const BA_CENTER  = { lat:-34.6037, lng:-58.3816 };

const CATEGORY_EMOJI = {
  "Кофе":"☕","Рестораны":"🍽️","Бары":"🍸","Кальян":"💨","Спорт":"🏟️","Работа":"💼",
  "Магазин":"🛍️","Ивенты":"🎉","Услуги":"🧰","Дети":"👶","Обучение":"🎓"
};

(function loadMaps(){
  const url = `https://maps.googleapis.com/maps/api/js?key=${encodeURIComponent(GOOGLE_KEY)}&v=weekly&libraries=marker&language=ru&region=AR&loading=async&callback=initMap`;
  const s = document.createElement('script'); s.src=url; s.defer=true; s.async=true; document.head.appendChild(s);
})();

function withKeyForPlacesMedia(url){
  if (!url) return "";
  try{
    const u = new URL(url);
    if (u.hostname === "places.googleapis.com" && u.pathname.includes("/v1/") && u.pathname.endsWith("/media")){
      if (!u.searchParams.has("key")) u.searchParams.set("key", GOOGLE_KEY);
      return u.toString();
    }
  }catch{}
  return url;
}

async function initMap(){
  const {Map} = await google.maps.importLibrary("maps");
  const {AdvancedMarkerElement, PinElement} = await google.maps.importLibrary("marker");

  const map = new Map(document.getElementById("map"), {
    center: BA_CENTER, zoom: 12, mapId: MAP_ID, clickableIcons: false
  });

  const infowin = new google.maps.InfoWindow();

  (window.PLACES || []).forEach(p => {
    const emoji = CATEGORY_EMOJI[p.category] || "📍";

    const glyph = document.createElement("div");
    glyph.textContent = emoji;
    glyph.style.fontSize = "22px";
    glyph.style.lineHeight = "22px";

    const pin = new PinElement({
      glyph, background: "#111", borderColor:"#444", glyphColor:"#fff", scale: 1.1
    });

    const marker = new AdvancedMarkerElement({
      map, position:{lat:+p.lat,lng:+p.lng}, content: pin.element, title: p.name
    });

    const photo = withKeyForPlacesMedia(p.photo_url);
    const img = photo
      ? `<img class="infomg" src="${photo}" alt="" style="width:100%;max-height:180px;object-fit:cover;border-radius:10px"
               onerror="this.parentElement && (this.remove())">`
      : "";

    const site  = p.website   ? `<div><a href="${p.website}" target="_blank" rel="noopener">Сайт</a></div>` : "";
    const insta = p.instagram ? `<div><a href="${p.instagram}" target="_blank" rel="noopener">Instagram</a></div>` : "";
    const phone = p.phone     ? `<div>☎ ${p.phone}</div>` : "";

    const html = `
      <div style="width:320px">
        ${img}
        <div style="margin-top:8px;font-weight:700;font-size:18px">${emoji} ${p.name || ""}</div>
        <div style="color:#999;margin:2px 0">${p.address || ""}</div>
        ${site}${insta}${phone}
      </div>`;

    marker.addListener("click", () => {
      infowin.setContent(html);
      infowin.open({anchor: marker, map});
    });
  });
}
</script>
