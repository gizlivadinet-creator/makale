import fs from "fs";

/* =========================================================
   AYARLAR (Sadece burayı düzenlemen yeterli)
========================================================= */

const AYARLAR = {
  // Günde üretilecek makale sayısı
  makaleSayisi: 5,

  // Minimum kelime sayısı
  minimumKelime: 1200,

  // Kategori
  kategori: "Tarih",

  // Yazım dili
  dil: "Türkçe",

  // Yazım tarzı
  tarz:
    "Profesyonel, akıcı, SEO uyumlu, insan tarafından yazılmış gibi doğal ve bilgilendirici",

  // Site adresi (SONUNDA / OLMALI)
  siteUrl: "https://gizlivadinet-creator.github.io/",

  // RSS dosya adı
  rssDosyaAdi: "makaleler.xml",

  // RSS başlığı
  rssBaslik: "Tarihte Bugün - AI Günlük Makaleler",

  // RSS açıklaması
  rssAciklama:
    "Gemini AI tarafından otomatik oluşturulan günlük tarih makaleleri",

  // Başlık üretme promptu
  konuPrompt: `
Bugünün tarihine göre tarihte yaşanmış önemli bir olayı seç.

Kurallar:
- SEO uyumlu başlık yaz
- Türkçe yaz
- En fazla 60 karakter olsun
- Başlıkta "Tarihte Bugün" ifadesi geçsin
- Örnek: "Tarihte Bugün: Ay’a İlk İnsanlı İniş"
- Sadece başlığı döndür
`,

  // Makale sonuna eklenecek bölüm
  ozelBolum: `
<h2>Sonuç</h2>
<p>
Bu olay, dünya tarihinin önemli dönüm noktalarından biri olarak kabul edilir.
Siyasi, kültürel ve bilimsel etkileri günümüzde de hissedilmeye devam etmektedir.
Tarihte bugün yaşanan bu gelişme, insanlık tarihinin şekillenmesinde önemli rol oynamıştır.
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
   GEMINI METİN ÜRET (Gemini 2.5 Pro)
========================================================= */

async function gemini(prompt) {
  const url =
    `https://generativelanguage.googleapis.com/v1beta/models/` +
    `gemini-2.5-pro:generateContent?key=${API_KEY}`;

  const response = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      contents: [
        {
          role: "user",
          parts: [
            {
              text: prompt
            }
          ]
        }
      ],
      generationConfig: {
        temperature: 0.8,
        topP: 0.95,
        maxOutputTokens: 8192
      }
    })
  });

  // HTTP hata kontrolü
  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Gemini API Hatası (${response.status}): ${errorText}`);
  }

  const data = await response.json();

  // Güvenli içerik alma
  const text =
    data?.candidates?.[0]?.content?.parts?.[0]?.text;

  if (!text || typeof text !== "string") {
    throw new Error("Gemini geçerli bir metin döndürmedi.");
  }

  return text.trim();
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
  const RSS_URL = AYARLAR.siteUrl + AYARLAR.rssDosyaAdi;

  let items = "";

  for (let i = 1; i <= AYARLAR.makaleSayisi; i++) {
    console.log(`📝 Makale ${i} oluşturuluyor...`);

    /* -----------------------------------------------------
       1. Başlık üret
    ----------------------------------------------------- */

    const baslik = await gemini(AYARLAR.konuPrompt);

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

SEO Kuralları:
- İlk paragrafta anahtar kelime geçsin
- 150-160 karakterlik SEO özeti oluştur
- <h2> başlıkları kullan
- <p> paragrafları kullan
- Sıkça Sorulan Sorular bölümü ekle
- Sonuç bölümü ekle
- Anahtar kelimeyi doğal şekilde kullan

Ek Kurallar:
- Kopya içerik üretme
- Tarihsel doğruluğa dikkat et
- Akıcı ve okunabilir yaz
- Markdown kullanma
- Sadece HTML döndür
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
  console.log("🔍 SEO uyumlu tarih makaleleri oluşturuldu");
  console.log("====================================");
}

/* =========================================================
   ÇALIŞTIR
========================================================= */

main().catch(error => {
  console.error("❌ KRİTİK HATA:", error);
  process.exit(1);
});
