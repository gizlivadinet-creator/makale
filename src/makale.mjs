import fs from "fs";

/* =========================================================
   ULTRA PROFESYONEL BLOGGER RSS SİSTEMİ
   - ÜCRETSİZ
   - API ANAHTARI YOK
   - WIKIPEDIA + POLLINATIONS AI
   - BLOGGER UYUMLU
   - SEO ODAKLI
   - GÖRSELLİ
========================================================= */

const AYARLAR = {
  makaleSayisi: 50,
  kategori: "Tarih",
  siteUrl: "https://gizlivadinet-creator.github.io/makale/",
  rssDosyaAdi: "makaleler.xml",
  rssBaslik: "Tarihte Bugün - Günlük Tarih Makaleleri",
  rssAciklama:
    "Wikipedia ve ücretsiz yapay zeka teknolojisi ile otomatik oluşturulan günlük tarih makaleleri"
};

/* =========================================================
   HTML GÜVENLİĞİ
========================================================= */

function temizle(text = "") {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

/* =========================================================
   SEO SLUG
========================================================= */

function slugify(text) {
  return text
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
   WIKIPEDIA DETAY ÇEK
========================================================= */

async function wikiDetay(title) {
  try {
    const url =
  `https://tr.wikipedia.org/w/api.php?action=query&format=json&origin=*` +
  `&prop=extracts|pageimages|info` +
  `&inprop=url&explaintext=1&piprop=original` +
  `&titles=${encodeURIComponent(title)}`;

    const res = await fetch(url);

    if (!res.ok) {
      throw new Error(`Wikipedia API: ${res.status}`);
    }

    const data = await res.json();
    const page = Object.values(data.query.pages)[0];

    return {
      text: page.extract || "",
      image: page.original?.source || "",
      link:
        page.fullurl ||
        `https://tr.wikipedia.org/wiki/${encodeURIComponent(title)}`
    };
  } catch (err) {
    console.error("⚠️ Wiki detay hatası:", err.message);

    return {
      text: "",
      image: "",
      link: "https://tr.wikipedia.org"
    };
  }
}

/* =========================================================
   ÜCRETSİZ AI MAKALE ÜRET (POLLINATIONS)
========================================================= */

async function aiMakale(prompt) {
  try {
    const url =
      `https://text.pollinations.ai/${encodeURIComponent(prompt)}`;

    const res = await fetch(url);

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

function bloggerHtmlOlustur({
  baslik,
  olayMetni,
  detayMetni,
  aiMetni
}) {
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
<p>${temizle(detayMetni)}</p>

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

  const api =
    `https://tr.wikipedia.org/api/rest_v1/feed/onthisday/events/${month}/${day}`;

  console.log("📅 Wikipedia verisi çekiliyor...");
  console.log(api);

  const response = await fetch(api);

  if (!response.ok) {
    throw new Error(`Wikipedia API Hatası: ${response.status}`);
  }

  const data = await response.json();

  if (!data.events || !data.events.length) {
    throw new Error("Bugün için olay bulunamadı.");
  }

  const secilenler = data.events.slice(0, AYARLAR.makaleSayisi);

  let items = "";

  for (const event of secilenler) {
    const title = event.pages?.[0]?.title || event.text;

    console.log(`📝 Makale oluşturuluyor: ${title}`);

    const detay = await wikiDetay(title);

    const baslik = `Tarihte Bugün: ${title}`;

    // Ücretsiz AI destekli analiz
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

    // Görsel: Wikipedia varsa onu kullan, yoksa AI görsel üret
    const imageUrl =
      detay.image ||
      `https://image.pollinations.ai/prompt/${encodeURIComponent(
        baslik + " historical illustration cinematic 16:9"
      )}`;

    const icerik = `
<p>
  <img src="${imageUrl}"
       alt="${temizle(baslik)}"
       style="width:100%;height:auto;border-radius:12px;display:block;margin-bottom:20px;">
</p>

${htmlMakale}

<hr>

<p><strong>Kaynak:</strong> Wikipedia ve ücretsiz yapay zeka destekli içerik sistemi</p>

<p>
  <a href="${detay.link}"
     target="_blank"
     rel="nofollow noopener">
     Detaylı bilgi için tıklayın
  </a>
</p>
`;

    items += `
<item>
  <title><![CDATA[${baslik}]]></title>

  <description><![CDATA[
${icerik}
  ]]></description>

  <content:encoded><![CDATA[
${icerik}
  ]]></content:encoded>

  <link>${detay.link}</link>

  <guid isPermaLink="true">${detay.link}</guid>

  <category>${AYARLAR.kategori}</category>

  <pubDate>${now.toUTCString()}</pubDate>

</item>`;
  }

  const RSS_URL = AYARLAR.siteUrl + AYARLAR.rssDosyaAdi;

  const rss = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0"
  xmlns:atom="http://www.w3.org/2005/Atom"
  xmlns:content="http://purl.org/rss/1.0/modules/content/">

<channel>

  <title>${AYARLAR.rssBaslik}</title>

  <link>${AYARLAR.siteUrl}</link>

  <description>${AYARLAR.rssAciklama}</description>

  <language>tr-TR</language>

  <atom:link
    href="${RSS_URL}"
    rel="self"
    type="application/rss+xml"/>

  <lastBuildDate>${now.toUTCString()}</lastBuildDate>

  ${items}

</channel>
</rss>`;

  fs.writeFileSync(AYARLAR.rssDosyaAdi, rss, "utf8");

  console.log("====================================");
  console.log("✅ RSS başarıyla oluşturuldu");
  console.log(`📄 Dosya: ${AYARLAR.rssDosyaAdi}`);
  console.log(`📝 Makale sayısı: ${secilenler.length}`);
  console.log("🖼️ Görseller otomatik eklendi");
  console.log("📱 Blogger editör uyumlu HTML üretildi");
  console.log("🔍 SEO uyumlu tarih makaleleri oluşturuldu");
  console.log("🚀 API anahtarı gerektirmez");
  console.log("====================================");
}

/* =========================================================
   ÇALIŞTIR
========================================================= */

main().catch(error => {
  console.error("❌ KRİTİK HATA:", error.message);
  process.exit(1);
});
