import fs from "fs";

const API_KEY = process.env.GEMINI_API_KEY;

if (!API_KEY) {
  console.error("❌ GEMINI_API_KEY bulunamadı");
  process.exit(1);
}

const SITE_URL = "https://gizlivadinet-creator.github.io/";
const RSS_URL = SITE_URL + "makaleler.xml";

/* --------------------------------------------------
   GEMINI METİN ÜRET
-------------------------------------------------- */
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
    const err = await response.text();
    throw new Error(err);
  }

  const data = await response.json();

  return (
    data.candidates?.[0]?.content?.parts?.[0]?.text || ""
  );
}

/* --------------------------------------------------
   ANA İŞLEM
-------------------------------------------------- */
async function main() {
  const now = new Date();
  const tarih = now.toLocaleDateString("tr-TR");

  let items = "";

  for (let i = 1; i <= 5; i++) {
    console.log(`📝 Makale ${i} oluşturuluyor`);

    /* Konu seç */
    const konuPrompt = `
${tarih} tarihinde tarihte yaşanmış önemli bir olay seç.
Sadece olay başlığını yaz.
Örnek: "Ay'a İlk İnsanlı İniş"
`;

    const baslik = (await gemini(konuPrompt)).trim();

    /* Makale üret */
    const makalePrompt = `
"${baslik}" konusu hakkında Blogger editör uyumlu HTML makale yaz.

Kurallar:
- Türkçe yaz
- SEO uyumlu olsun
- En az 1600 kelime
- <h2> başlıkları kullan
- <p> paragrafları kullan
- Giriş, gelişme ve sonuç bölümü olsun
- Sadece HTML döndür
`;

    const htmlMakale = await gemini(makalePrompt);

    const slug = baslik
      .toLowerCase()
      .replace(/[^a-z0-9ğüşöçıİĞÜŞÖÇ\s-]/gi, "")
      .replace(/\s+/g, "-")
      .replace(/-+/g, "-");

    const link = SITE_URL + slug + ".html";

    items += `
<item>
  <title><![CDATA[${baslik}]]></title>

  <description><![CDATA[
${htmlMakale}
  ]]></description>

  <content:encoded><![CDATA[
${htmlMakale}
  ]]></content:encoded>

  <link>${link}</link>

  <guid isPermaLink="true">${link}</guid>

  <category>Tarih</category>

  <dc:creator>Google Gemini AI</dc:creator>

  <pubDate>${now.toUTCString()}</pubDate>
</item>`;
  }

  const rss = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0"
  xmlns:atom="http://www.w3.org/2005/Atom"
  xmlns:dc="http://purl.org/dc/elements/1.1/"
  xmlns:content="http://purl.org/rss/1.0/modules/content/">

<channel>

  <title>AI Tarih Makaleleri</title>

  <link>${SITE_URL}</link>

  <description>Gemini AI ile oluşturulan günlük tarih makaleleri</description>

  <language>tr-TR</language>

  <atom:link
    href="${RSS_URL}"
    rel="self"
    type="application/rss+xml"/>

  <lastBuildDate>${now.toUTCString()}</lastBuildDate>

  ${items}

</channel>
</rss>`;

  fs.writeFileSync("makaleler.xml", rss, "utf8");

  console.log("✅ makaleler.xml oluşturuldu");
}

main().catch(err => {
  console.error("❌ HATA:", err);
  process.exit(1);
});
