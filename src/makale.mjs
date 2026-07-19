import fs from "fs";

/* =========================================================
   AYARLAR (Sadece burayı düzenlemen yeterli)
========================================================= */

const AYARLAR = {
  // Günde kaç makale üretilecek
  makaleSayisi: 5,

  // Minimum kelime sayısı
  minimumKelime: 1600,

  // Kategori
  kategori: "Tarih",

  // Yazım dili
  dil: "Türkçe",

  // Yazım tarzı
  tarz: "Profesyonel, akıcı, SEO uyumlu ve insan tarafından yazılmış gibi",

  // Site adresi (SONUNDA / OLMALI)
  siteUrl: "https://gizlivadinet-creator.github.io/",

  // RSS dosya adı
  rssDosyaAdi: "makaleler.xml",

  // RSS başlığı
  rssBaslik: "AI Günlük Makaleler",

  // RSS açıklaması
  rssAciklama: "Gemini AI tarafından otomatik oluşturulan günlük makaleler",

  // Makale sonuna eklenecek bölüm
  ozelBolum: `
<h2>Sonuç</h2>
<p>
Bu olay, tarih boyunca insanlığın gelişimine önemli katkılar sağlamış
ve günümüzde de etkileri hissedilen gelişmeler arasında yer almıştır.
</p>
`
};

/* =========================================================
   GEMINI API ANAHTARI
========================================================= */

const API_KEY = process.env.GEMINI_API_KEY;

if (!API_KEY) {
  console.error("❌ GEMINI_API_KEY bulunamadı.");
  process.exit(1);
}

/* =========================================================
   GEMINI METİN ÜRET
========================================================= */

async function gemini(prompt) {
  const url =
    `https://generativelanguage.googleapis.com/v1beta/models/` +
    `gemini-2.5-flash:generateContent?key=${API_KEY}`;

  const response = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      contents: [
        {
          parts: [{ text: prompt }]
        }
      ]
    })
  });

  if (!response.ok) {
    const hata = await response.text();
    throw new Error(`Gemini API Hatası: ${hata}`);
  }

  const data = await response.json();

  return (
    data.candidates?.[0]?.content?.parts?.[0]?.text?.trim() || ""
  );
}

/* =========================================================
   SLUG OLUŞTUR
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
   ANA İŞLEM
========================================================= */

async function main() {
  const now = new Date();
  const tarih = now.toLocaleDateString("tr-TR");

  const RSS_URL = AYARLAR.siteUrl + AYARLAR.rssDosyaAdi;

  let items = "";

  for (let i = 1; i <= AYARLAR.makaleSayisi; i++) {
    console.log(`📝 Makale ${i} oluşturuluyor...`);

    /* -----------------------------------------------------
       1. Başlık üret
    ----------------------------------------------------- */

    const baslikPrompt = `
${tarih} tarihinde yaşanmış önemli bir tarihi olayı seç.

Kurallar:
- Sadece başlık yaz
- SEO uyumlu olsun
- Türkçe yaz
- 60 karakteri geçmesin
- Tırnak kullanma
`;

    const baslik = await gemini(baslikPrompt);

    if (!baslik) {
      console.warn("⚠️ Başlık üretilemedi, atlanıyor.");
      continue;
    }

    console.log(`📌 Başlık: ${baslik}`);

    /* -----------------------------------------------------
       2. Görsel URL oluştur
    ----------------------------------------------------- */

    const imagePrompt =
      `${baslik}, historical illustration, cinematic, ultra detailed, 16:9`;

    const imageUrl =
      `https://image.pollinations.ai/prompt/${encodeURIComponent(imagePrompt)}`;

    /* -----------------------------------------------------
       3. Makale üret
    ----------------------------------------------------- */

    const makalePrompt = `
Konu: "${baslik}"

Aşağıdaki kurallara uygun Blogger editör uyumlu HTML makale yaz:

- Dil: ${AYARLAR.dil}
- Kategori: ${AYARLAR.kategori}
- Yazım tarzı: ${AYARLAR.tarz}
- Minimum kelime: ${AYARLAR.minimumKelime}
- <h2> başlıkları kullan
- <p> paragrafları kullan
- Giriş, gelişme ve sonuç bölümleri olsun
- Anahtar kelime yoğunluğu doğal olsun
- Kopya içerik üretme
- Sadece HTML döndür
- Markdown kullanma
`;

    const htmlMakale = await gemini(makalePrompt);

    if (!htmlMakale) {
      console.warn("⚠️ Makale üretilemedi, atlanıyor.");
      continue;
    }

    /* -----------------------------------------------------
       4. Tam içerik oluştur
    ----------------------------------------------------- */

    const tamIcerik = `
<p>
  <img src="${imageUrl}"
       alt="${baslik}"
       style="width:100%;height:auto;border-radius:12px;display:block;margin-bottom:20px;">
</p>

${htmlMakale}

${AYARLAR.ozelBolum}

<hr>

<p><strong>Kaynak:</strong> Google Gemini AI</p>
`;

    const slug = slugify(baslik);
    const link = AYARLAR.siteUrl + slug + ".html";

    /* -----------------------------------------------------
       5. RSS item ekle
    ----------------------------------------------------- */

    items += `
<item>
  <title><![CDATA[${baslik}]]></title>

  <description><![CDATA[
${tamIcerik}
  ]]></description>

  <content:encoded><![CDATA[
${tamIcerik}
  ]]></content:encoded>

  <link>${link}</link>

  <guid isPermaLink="true">${link}</guid>

  <category>${AYARLAR.kategori}</category>

  <dc:creator>Google Gemini AI</dc:creator>

  <pubDate>${now.toUTCString()}</pubDate>

  <enclosure url="${imageUrl}" type="image/jpeg"/>

</item>`;
  }

  /* -------------------------------------------------------
     RSS DOSYASI OLUŞTUR
  ------------------------------------------------------- */

  const rss = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0"
  xmlns:atom="http://www.w3.org/2005/Atom"
  xmlns:dc="http://purl.org/dc/elements/1.1/"
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
  console.log(`📝 Makale sayısı: ${AYARLAR.makaleSayisi}`);
  console.log("🖼️ Her makaleye otomatik görsel eklendi");
  console.log("📱 Blogger editör uyumlu HTML üretildi");
  console.log("====================================");
}

/* =========================================================
   ÇALIŞTIR
========================================================= */

main().catch(error => {
  console.error("❌ KRİTİK HATA:", error);
  process.exit(1);
});
