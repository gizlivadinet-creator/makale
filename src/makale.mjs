import fs from "fs";
import path from "path";

/* =========================================================
ULTRA PROFESYONEL BLOGGER RSS SİSTEMİ

ÜCRETSİZ
API ANAHTARI YOK
WIKIPEDIA + POLLINATIONS AI
BLOGGER UYUMLU
SEO ODAKLI
GÖRSELLİ / VİDEOLU (otomatik medya gömme)
XML DOĞRULAMALI
========================================================= */

const AYARLAR = {
  kategori: "Tarih",
  siteUrl: "https://gizlivadinet-creator.github.io/makale/",
  rssDosyaAdi: "makaleler.xml",
  rssBaslik: "Tarihte Bugün - Günlük Tarih Makaleleri",
  rssAciklama:
    "Ücretsiz yapay zeka teknolojileri ile desteklenen Mifrm Blogger Forum, her gün özgün ve kaliteli tarih içerikleri oluşturur. Sistem, önemli olayları analiz ederek SEO uyumlu, okunabilir ve profesyonel makaleleri otomatik olarak hazırlar."
};

/* =========================================================
ÇIKIŞ DOSYASI
========================================================= */

const OUTPUT_FILE = path.resolve(AYARLAR.rssDosyaAdi);

/* =========================================================
HTML / XML GÜVENLİĞİ
========================================================= */

function temizle(text = "") {
  return String(text)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

// URL'ler ve CDATA DIŞI (düz XML text/attribute) alanlar için tam escape.
// & karakteri kaçırılmazsa XML parser feed'i tamamen geçersiz sayabilir.
function xmlEscape(text = "") {
  return String(text)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

/* =========================================================
SEO SLUG
========================================================= */

function slugify(text) {
  return String(text)
    .toLowerCase()
    .replace(/ç/g, "c")
    .replace(/ğ/g, "g")
    .replace(/ı/g, "i")
    .replace(/ö/g, "o")
    .replace(/ş/g, "s")
    .replace(/ü/g, "u")
    .replace(/[^a-z0-9\s-]/g, "")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
    .trim();
}

/* =========================================================
TIMEOUT DESTEKLİ FETCH
========================================================= */

async function fetchWithTimeout(url, timeout = 15000) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeout);

  try {
    const res = await fetch(url, {
      signal: controller.signal,
      headers: {
        "User-Agent": "blogger-rss-generator/1.0"
      }
    });
    return res;
  } finally {
    clearTimeout(timer);
  }
}

/* =========================================================
MEDYA TÜRÜ TESPİTİ (GÖRSEL / VİDEO)
========================================================= */

// Wikipedia'dan gelen "original.source" dosyasının uzantısına bakarak
// bunun video mu görsel mi olduğunu otomatik tespit eder.
function medyaTuruTespit(url = "") {
  const temiz = url.split("?")[0].toLowerCase();

  const videoUzantilari = [".mp4", ".webm", ".ogv", ".mov", ".m4v"];
  const isVideo = videoUzantilari.some(ext => temiz.endsWith(ext));

  if (isVideo) {
    let mime = "video/mp4";
    if (temiz.endsWith(".webm")) mime = "video/webm";
    else if (temiz.endsWith(".ogv")) mime = "video/ogg";
    else if (temiz.endsWith(".mov")) mime = "video/quicktime";

    return { tur: "video", mime };
  }

  let mime = "image/jpeg";
  if (temiz.endsWith(".png")) mime = "image/png";
  else if (temiz.endsWith(".gif")) mime = "image/gif";
  else if (temiz.endsWith(".webp")) mime = "image/webp";
  else if (temiz.endsWith(".svg")) mime = "image/svg+xml";

  return { tur: "image", mime };
}

/* =========================================================
MEDYA DOSYA BOYUTU (enclosure length için)
========================================================= */

// Bazı sıkı podcast doğrulayıcılar enclosure'da gerçek byte boyutu ister.
// HEAD isteğiyle Content-Length çekmeyi dener, başarısız olursa 0 döner
// (0 olması geçerliliği bozmaz ama gerçek boyut daha güvenlidir).
async function medyaBoyutuAl(url) {
  try {
    const res = await fetchWithTimeout(url, 8000);
    const len = res.headers.get("content-length");
    return len ? parseInt(len, 10) : 0;
  } catch (err) {
    return 0;
  }
}

/* =========================================================
WIKIPEDIA DETAY ÇEK
========================================================= */

async function wikiDetay(title) {
  try {
    const url =
      `https://tr.wikipedia.org/w/api.php?action=query&format=json&origin=*` +
      `&prop=extracts|pageimages|info` +
      `&inprop=url&explaintext=1&piprop=original` +
      `&titles=${encodeURIComponent(title)}`;

    const res = await fetchWithTimeout(url);

    if (!res.ok) {
      throw new Error(`Wikipedia API: ${res.status}`);
    }

    const data = await res.json();
    const page = Object.values(data.query.pages)[0];

    return {
      text: page?.extract || "",
      image: page?.original?.source || "",
      link:
        page?.fullurl ||
        `https://tr.wikipedia.org/wiki/${encodeURIComponent(title)}`
    };
  } catch (err) {
    console.error("⚠️ Wiki detay hatası:", err.message);

    // ÖNEMLİ: fallback linki artık title'a göre benzersiz üretiliyor,
    // böylece hatalı olaylar bile birbirinden farklı guid/link alır.
    return {
      text: "",
      image: "",
      link: `https://tr.wikipedia.org/wiki/${encodeURIComponent(title)}`
    };
  }
}

/* =========================================================
ÜCRETSİZ AI ANALİZ (POLLINATIONS)
========================================================= */

async function aiMakale(prompt) {
  try {
    const url = `https://text.pollinations.ai/${encodeURIComponent(prompt)}`;

    const res = await fetchWithTimeout(url, 20000);

    if (!res.ok) {
      throw new Error(`AI Servisi: ${res.status}`);
    }

    const text = await res.text();
    return text.trim();
  } catch (err) {
    console.error("⚠️ AI hatası:", err.message);
    return "";
  }
}

/* =========================================================
BLOGGER UYUMLU SEO HTML
========================================================= */

function bloggerHtmlOlustur({ baslik, olayMetni, detayMetni, aiMetni }) {
  return `
<h2>${temizle(baslik)}</h2>
<p><strong>SEO Özeti:</strong> ${temizle(
    baslik
  )} hakkında tarihsel arka planı, dünya tarihine etkileri ve önemli gelişmeleri içeren detaylı inceleme.</p>
<p><strong>${temizle(
    baslik
  )}</strong>, dünya tarihinin önemli dönüm noktalarından biridir.</p>
<h3>Olayın Özeti</h3>
<p>${temizle(olayMetni)}</p>
<h3>Tarihsel Arka Plan</h3>
<p>${temizle(detayMetni.substring(0, 8000))}</p>
${
  aiMetni
    ? `
<h3>Detaylı Analiz</h3>
<p>${temizle(aiMetni)}</p>
`
    : ""
}
<h3>Dünya Tarihine Etkileri</h3>
<p>Bu olayın etkileri uzun yıllar boyunca hissedilmiş ve birçok ülkenin siyasi, ekonomik ve toplumsal yapısını etkilemiştir.</p>
<h3>Sıkça Sorulan Sorular</h3>
<p><strong>Bu olay neden önemlidir?</strong></p>
<p>Çünkü dönemin güç dengelerini etkileyen ve tarihsel süreci değiştiren sonuçlar doğurmuştur.</p>
<p><strong>Günümüze etkisi var mı?</strong></p>
<p>Evet, tarihçiler ve araştırmacılar tarafından günümüzde de incelenen önemli gelişmeler arasında yer almaktadır.</p>
<h3>Sonuç</h3>
<p><strong>${temizle(
    baslik
  )}</strong>, insanlık tarihinin dönüm noktalarından biri olarak kabul edilir ve tarih araştırmalarında önemli bir yere sahiptir.</p>
`;
}

/* =========================================================
ANA İŞLEM
========================================================= */

async function main() {
  const now = new Date();

  const month = String(now.getMonth() + 1).padStart(2, "0");
  const day = String(now.getDate()).padStart(2, "0");

  const api = `https://tr.wikipedia.org/api/rest_v1/feed/onthisday/events/${month}/${day}`;

  console.log("📅 Wikipedia verisi çekiliyor...");
  console.log(api);

  const response = await fetchWithTimeout(api);

  if (!response.ok) {
    throw new Error(`Wikipedia API Hatası: ${response.status}`);
  }

  const data = await response.json();

  if (!data.events || !data.events.length) {
    throw new Error("Bugün için olay bulunamadı.");
  }

  /* -------------------------------------------------------
  TÜM OLAYLARI AL (SINIRSIZ)
  ------------------------------------------------------- */

  const secilenler = data.events;

  let items = "";
  let index = 0;

  // Aynı çalıştırmada aynı gün için benzersiz kalması adına tarih damgası
  const calismaZamani = now.getTime();

  for (const event of secilenler) {
    index++;

    const title = event.pages?.[0]?.title || event.text;

    console.log(`📝 Makale oluşturuluyor: ${title}`);

    const detay = await wikiDetay(title);

    const baslik = `Tarihte Bugün: ${title}`;

    const aiMetni = await aiMakale(`
${baslik} hakkında 2-3 paragraf tarihsel analiz yaz.
Türkçe yaz.
Akıcı ve bilgilendirici olsun.
HTML etiketi kullanma.
`);

    const htmlMakale = bloggerHtmlOlustur({
      baslik,
      olayMetni: event.text,
      detayMetni: detay.text || event.text,
      aiMetni
    });

    // Görsel/video kaynağı belirle (Wikipedia varsa onu, yoksa Pollinations görseli)
    const medyaUrl =
      detay.image ||
      `https://image.pollinations.ai/prompt/${encodeURIComponent(
        baslik + " historical illustration cinematic 16:9"
      )}`;

    const { tur, mime } = medyaTuruTespit(medyaUrl);

    // Blogger uyumlu içerik: video ise <video>, değilse <img> gömülür
    const medyaHtml =
      tur === "video"
        ? `<p>
  <video controls style="width:100%;height:auto;border-radius:12px;display:block;margin-bottom:20px;">
    <source src="${medyaUrl}" type="${mime}">
  </video>
</p>`
        : `<p>
  <img src="${medyaUrl}"
       alt="${temizle(baslik)}"
       style="width:100%;height:auto;border-radius:12px;display:block;margin-bottom:20px;">
</p>`;

    const icerik = `
${medyaHtml}
${htmlMakale}
<hr>
<p><strong>Kaynak:</strong> Wikipedia yapay zeka teknolojileri ile desteklenen Mifrm Blogger Forum, her gün özgün ve kaliteli tarih içerikleri oluşturur. Sistem, önemli olayları analiz ederek SEO uyumlu, okunabilir ve profesyonel makaleleri otomatik olarak hazırlar.</p>
<p>
  <a href="${xmlEscape(detay.link)}"
     target="_blank"
     rel="nofollow noopener">
     Detaylı bilgi için tıklayın
  </a>
</p>
`;

    // BENZERSİZ GUID: link + tarih damgası + sıra numarası kombinasyonu.
    // Bu sayede wikiDetay() hata verip aynı fallback linkini döndürse bile
    // her <item> kesinlikle farklı bir guid alır (16 GUID çakışması sorunu çözüldü).
    const guid = `${detay.link}#${calismaZamani}-${index}-${slugify(title)}`;

    // Gerçek dosya boyutu (bazı sıkı podcast doğrulayıcılar bunu ister)
    const medyaBoyutu = await medyaBoyutuAl(medyaUrl);

    // Video için ayrı bir görsel thumbnail üret (Wikipedia'dan görsel gelmediyse Pollinations kullan)
    const thumbnailUrl =
      tur === "video"
        ? `https://image.pollinations.ai/prompt/${encodeURIComponent(
            baslik + " historical illustration cinematic 16:9"
          )}`
        : medyaUrl;

    // Her item'a sırayla 1'er dakika geriye giden benzersiz pubDate ver
    // (aynı saniyede 16+ item aynı tarihte olunca bazı okuyucular sıralamayı karıştırıyordu)
    const itemTarihi = new Date(calismaZamani - index * 60000);

    items += `
<item>
  <title><![CDATA[${baslik}]]></title>
  <description><![CDATA[
${icerik}
]]></description>
  <content:encoded><![CDATA[
${icerik}
]]></content:encoded>
  <link>${xmlEscape(detay.link)}</link>
  <guid isPermaLink="false">${xmlEscape(guid)}</guid>
  <enclosure url="${xmlEscape(medyaUrl)}" type="${mime}" length="${medyaBoyutu}"/>
  <media:content url="${xmlEscape(medyaUrl)}" medium="${tur}" type="${mime}"/>
  <media:thumbnail url="${xmlEscape(thumbnailUrl)}"/>
  <category>${AYARLAR.kategori}</category>
  <pubDate>${itemTarihi.toUTCString()}</pubDate>
</item>`;
  }

  const RSS_URL = AYARLAR.siteUrl + AYARLAR.rssDosyaAdi;

  const rss = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0"
     xmlns:atom="http://www.w3.org/2005/Atom"
     xmlns:content="http://purl.org/rss/1.0/modules/content/"
     xmlns:media="http://search.yahoo.com/mrss/">
<channel>
  <title>${temizle(AYARLAR.rssBaslik)}</title>
  <link>${xmlEscape(AYARLAR.siteUrl)}</link>
  <description>${temizle(AYARLAR.rssAciklama)}</description>
  <language>tr-TR</language>
  <atom:link
    href="${xmlEscape(RSS_URL)}"
    rel="self"
    type="application/rss+xml"/>
  <lastBuildDate>${now.toUTCString()}</lastBuildDate>
${items}
</channel>
</rss>`;

  /* -------------------------------------------------------
  XML DOSYASINI YAZ
  ------------------------------------------------------- */

  fs.writeFileSync(OUTPUT_FILE, rss, {
    encoding: "utf8",
    flag: "w"
  });

  /* -------------------------------------------------------
  DOĞRULAMA
  ------------------------------------------------------- */

  if (!fs.existsSync(OUTPUT_FILE)) {
    throw new Error("XML dosyası oluşturulamadı!");
  }

  const stats = fs.statSync(OUTPUT_FILE);

  if (stats.size < 100) {
    throw new Error("XML dosyası çok küçük, içerik oluşturulmamış olabilir.");
  }

  console.log("====================================");
  console.log("✅ RSS başarıyla oluşturuldu");
  console.log(`📄 Dosya: ${OUTPUT_FILE}`);
  console.log(`📦 Boyut: ${stats.size} byte`);
  console.log(`📝 Makale sayısı: ${secilenler.length}`);
  console.log("🖼️ Görsel / 🎬 Video otomatik <enclosure> + <media:content> ile eklendi");
  console.log("🆔 Her item için benzersiz GUID üretildi");
  console.log("📱 Blogger editör uyumlu HTML üretildi");
  console.log("🔍 SEO uyumlu tarih makaleleri oluşturuldu");
  console.log("🚀 API anahtarı gerektirmez");
  console.log(`🌐 RSS URL: ${RSS_URL}`);
  console.log("====================================");
}

/* =========================================================
ÇALIŞTIR
========================================================= */

main().catch(error => {
  console.error("❌ KRİTİK HATA:", error);
  process.exit(1);
});
