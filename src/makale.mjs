import fs from "fs";
import path from "path";
import { XMLValidator } from "fast-xml-parser";

/* =========================================================
   ULTRA PROFESYONEL BLOGGER RSS SİSTEMİ (STANDART UYUMLU SÜRÜM)
   - ÜCRETSİZ
   - API ANAHTARI YOK
   - WIKIPEDIA + POLLINATIONS AI
   - BLOGGER UYUMLU
   - SEO ODAKLI
   - GÖRSELLİ (içerik HTML'inin başında tek görsel; çift görsel oluşturmaz)
   - GERÇEK XML DOĞRULAMASI (fast-xml-parser ile)
   - CDATA KIRILMASINA KARŞI KORUMALI
   - TEK BİR OLAY HATASI TÜM ÜRETİMİ DÜŞÜRMEZ
   - content:encoded (tam gövde) + kısa description (SEO özeti) ayrımı
   - media:content (görsel/video) ve dc:creator ile RSS uzantı desteği
========================================================= */

const AYARLAR = {
  kategori: "Tarih",
  siteUrl: "https://gizlivadinet-creator.github.io/makale/",
  rssDosyaAdi: "makaleler.xml",
  rssBaslik: "Tarihte Bugün - Günlük Tarih Makaleleri",
  rssAciklama:
    "Ücretsiz yapay zeka teknolojileri ile desteklenen Mifrm Blogger Forum, her gün özgün ve kaliteli tarih içerikleri oluşturur. Sistem, önemli olayları analiz ederek SEO uyumlu, okunabilir ve profesyonel makaleleri otomatik olarak hazırlar.",
  // dc:creator için yazar/etiket adı (geçerli bir e-posta gerektirmeyen
  // serbest metin alanı; RSS'in <author> etiketi e-posta zorunlu kıldığı
  // için burada Dublin Core ad alanı tercih edildi).
  yazarAdi: "Mifrm Blogger Forum",
  // <description> için kısa SEO özetinin maksimum karakter sayısı.
  ozetMaksUzunluk: 220,
  // Aynı anda çok fazla olay işlenip ücretsiz API'lerin (Pollinations/Wikipedia)
  // hız sınırına takılmaması ve GitHub Actions 20 dk sınırını aşmamak için üst sınır.
  maksMakale: 15,
  // Makale başına gömülecek en fazla video sayısı (ses dosyaları
  // hariçtir; sadece video/* MIME tipindeki dosyalar gömülür).
  maksVideo: 2,
  // Ardışık istekler arasında bekleme (ms) - ücretsiz servisleri yormamak için.
  istekAraGecikmeMs: 1200
};

/* =========================================================
   ÇIKIŞ DOSYASI
========================================================= */

const OUTPUT_FILE = path.resolve(AYARLAR.rssDosyaAdi);

/* =========================================================
   XML METİN DÜĞÜMLERİ İÇİN ESCAPE (CDATA DIŞI ELEMANLAR)
   <link>, <guid>, <atom:link href="...">, <category>,
   <media:content url="...">, <dc:creator> gibi CDATA'ya
   SARILMAMIŞ ham XML metin düğümleri/öznitelikleri için kullanılır.
========================================================= */

function escapeXml(text = "") {
  return String(text)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

/* =========================================================
   HTML İÇERİK TEMİZLİĞİ (CDATA İÇİNDEKİ HTML METNİ İÇİN)
   Bu escape edilen metin CDATA içine konur; tarayıcı/okuyucu
   HTML olarak render ederken &amp; -> & şeklinde geri çözer.
   Böylece hem HTML injection önlenir hem de attribute'lar
   (alt="...", href="...") güvenli hale gelir.
========================================================= */

function temizle(text = "") {
  return String(text)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

/* =========================================================
   GEÇERSİZ XML KONTROL KARAKTERLERİNİ TEMİZLE
   XML 1.0 sadece \t \n \r ve 0x20 üzeri karakterlere izin verir
   (bazı Unicode aralıkları hariç). AI/Wikipedia metninde nadiren
   çıkabilecek görünmez kontrol karakterleri feed'i bozabilir.
========================================================= */

function gecersizXmlKarakterleriTemizle(text = "") {
  // eslint-disable-next-line no-control-regex
  return String(text).replace(/[\x00-\x08\x0B\x0C\x0E-\x1F]/g, "");
}

/* =========================================================
   CDATA İÇİNDE "]]>" DİZİSİNİ GÜVENLİ HALE GETİR
   CDATA bloğu ]]> ile biter; içerikte bu dizi geçerse blok
   erken kapanır ve XML kırılır. Standart çözüm: diziyi
   ]]]]><![CDATA[> ile bölmek.
========================================================= */

function cdataIcinGuvenliHaleGetir(text = "") {
  return gecersizXmlKarakterleriTemizle(String(text)).replace(
    /]]>/g,
    "]]]]><![CDATA[>"
  );
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
   KISA SEO ÖZETİ (DÜZELTME)
   RSS <description> alanı, tam HTML gövdesi yerine kısa bir
   metin özeti içermelidir; tam gövde artık <content:encoded>
   içinde taşınır. Bu ayrım hem Blogger'ın içe aktarma mantığına
   hem de yaygın RSS/SEO pratiğine (excerpt + full content) uygundur.
========================================================= */

function kisaOzetOlustur(text, maxUzunluk = AYARLAR.ozetMaksUzunluk) {
  const duzMetin = String(text || "")
    .replace(/\s+/g, " ")
    .trim();

  if (duzMetin.length <= maxUzunluk) {
    return duzMetin;
  }

  return `${duzMetin.slice(0, maxUzunluk).trim()}…`;
}

/* =========================================================
   YARDIMCI: BEKLEME
========================================================= */

function bekle(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
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

    return {
      text: "",
      image: "",
      link: `https://tr.wikipedia.org/wiki/${encodeURIComponent(title)}`
    };
  }
}

/* =========================================================
   WIKIPEDIA SAYFASINDAKİ VİDEOLARI ÇEK (SES DOSYALARI HARİÇ)
   1) Sayfada kullanılan dosyaları listeler (prop=images)
   2) Video olma ihtimali olan uzantıları filtreler (istek
      sayısını azaltmak için ön filtre)
   3) Kalan dosyaların GERÇEK MIME tipini (imageinfo) sorgular
      ve sadece "video/" ile başlayanları alır — "audio/" ile
      başlayan ses dosyaları (uzantısı .ogg/.oga olan bazı ses
      dosyaları video uzantılarıyla karışabildiği için) MIME
      kontrolüyle kesin olarak elenir.
========================================================= */

async function wikiVideolariCek(title) {
  try {
    const listeUrl =
      `https://tr.wikipedia.org/w/api.php?action=query&format=json&origin=*` +
      `&prop=images&imlimit=50&titles=${encodeURIComponent(title)}`;

    const listeRes = await fetchWithTimeout(listeUrl);

    if (!listeRes.ok) {
      throw new Error(`Dosya listesi API: ${listeRes.status}`);
    }

    const listeData = await listeRes.json();
    const sayfa = Object.values(listeData.query.pages)[0];
    const dosyaBasliklari = (sayfa?.images || []).map(img => img.title);

    if (!dosyaBasliklari.length) {
      return [];
    }

    // Video olma ihtimali olmayan dosyaları (jpg/png/svg ikonlar vb.)
    // önden eleyerek ikinci isteği küçük tutuyoruz.
    const olasiVideoBasliklari = dosyaBasliklari.filter(t =>
      /\.(webm|ogv|ogg|mp4|m4v|mov|mpg|mpeg)$/i.test(t)
    );

    if (!olasiVideoBasliklari.length) {
      return [];
    }

    const infoUrl =
      `https://tr.wikipedia.org/w/api.php?action=query&format=json&origin=*` +
      `&prop=imageinfo&iiprop=url|mime` +
      `&titles=${encodeURIComponent(
        olasiVideoBasliklari.slice(0, 20).join("|")
      )}`;

    const infoRes = await fetchWithTimeout(infoUrl);

    if (!infoRes.ok) {
      throw new Error(`Dosya bilgisi API: ${infoRes.status}`);
    }

    const infoData = await infoRes.json();
    const sayfalar = Object.values(infoData.query.pages || {});

    const videolar = [];

    for (const p of sayfalar) {
      const bilgi = p?.imageinfo?.[0];

      if (!bilgi || !bilgi.url || !bilgi.mime) {
        continue;
      }

      // KESİN FİLTRE: sadece video/* MIME tipleri alınır.
      // audio/* (ses dosyaları) burada kesinlikle dışarıda kalır.
      if (bilgi.mime.startsWith("video/")) {
        videolar.push({ url: bilgi.url, mime: bilgi.mime });
      }
    }

    return videolar;
  } catch (err) {
    console.error("⚠️ Video bilgisi hatası:", err.message);
    return [];
  }
}

/* =========================================================
   VİDEOLARI HTML5 <video> ETİKETLERİNE ÇEVİR
========================================================= */

function videoHtmlOlustur(videolar) {
  if (!videolar || !videolar.length) {
    return "";
  }

  const etiketler = videolar
    .map(
      v => `
<div style="margin:20px 0;">
  <video controls preload="metadata" style="width:100%;border-radius:12px;">
    <source src="${temizle(v.url)}" type="${temizle(v.mime)}">
    Tarayıcınız video etiketini desteklemiyor. <a href="${temizle(
      v.url
    )}">Videoyu görüntülemek için tıklayın</a>.
  </video>
</div>`
    )
    .join("\n");

  return `
<h3>İlgili Videolar</h3>
${etiketler}
`;
}

/* =========================================================
   VİDEOLAR İÇİN media:content ETİKETLERİ (DÜZELTME)
   HTML5 <video> etiketi sadece CDATA içindeki gövdede görünür;
   feed okuyucuların/SEO araçlarının medya öğesini XML seviyesinde
   de tanıyabilmesi için Yahoo Media RSS (media:content) uzantısı
   eklendi. Bunlar CDATA DIŞINDA, öznitelik olarak escapeXml() ile
   kaçışlanmalıdır (CDATA kaçışlama fonksiyonu burada UYGUN DEĞİL).
========================================================= */

function medyaVideoEtiketleriOlustur(videolar) {
  if (!videolar || !videolar.length) {
    return "";
  }

  return videolar
    .map(
      v =>
        `  <media:content url="${escapeXml(v.url)}" medium="video" type="${escapeXml(
          v.mime
        )}" />`
    )
    .join("\n");
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

    const text = (await res.text()).trim();

    // Servis bazen HTML hata sayfası döndürebilir; bunu makaleye
    // sızdırmamak için basit bir sağlık kontrolü yapıyoruz.
    if (!text || text.startsWith("<") || text.length < 20) {
      return "";
    }

    return text;
  } catch (err) {
    console.error("⚠️ AI hatası:", err.message);
    return "";
  }
}

/* =========================================================
   DÜZ WİKİPEDİA METNİNİ HTML PARAGRAFLARINA/BAŞLIKLARINA ÇEVİR
   Wikipedia'nın explaintext çıktısı satır sonlarıyla ayrılmış
   düz metindir ve "== Bölüm Başlığı ==" gibi işaretler içerir.
   Sınır olmadan tek bir <p> içine dökülürse tarayıcılar boşluk
   ve satır sonlarını yok sayıp koca bir metin yığınına çevirir;
   bu yüzden satırları gerçek <p> / <h4> etiketlerine ayırıyoruz.
========================================================= */

function duzMetniHtmlParagraflaraCevir(text) {
  const satirlar = String(text || "")
    .split(/\n+/)
    .map(s => s.trim())
    .filter(Boolean);

  return satirlar
    .map(satir => {
      const baslikEslesme = satir.match(/^=+\s*(.+?)\s*=+$/);

      if (baslikEslesme) {
        return `<h4>${temizle(baslikEslesme[1])}</h4>`;
      }

      return `<p>${temizle(satir)}</p>`;
    })
    .join("\n");
}

/* =========================================================
   BLOGGER UYUMLU SEO HTML
========================================================= */

function bloggerHtmlOlustur({
  baslik,
  olayMetni,
  detayMetni,
  aiMetni,
  videoHtml
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
${duzMetniHtmlParagraflaraCevir(detayMetni)}

${
  aiMetni
    ? `
<h3>Detaylı Analiz</h3>
<p>${temizle(aiMetni)}</p>
`
    : ""
}

${videoHtml || ""}

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
   TEK BİR OLAY İÇİN <item> XML'İ ÜRET
========================================================= */

async function itemUret(event, now, index, bugunTarihStr) {
  const title = event.pages?.[0]?.title || event.text;

  console.log(`📝 Makale oluşturuluyor (${index + 1}): ${title}`);

  const detay = await wikiDetay(title);

  const videolar = (await wikiVideolariCek(title)).slice(
    0,
    AYARLAR.maksVideo
  );

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
    aiMetni,
    videoHtml: videoHtmlOlustur(videolar)
  });

  const imageUrl =
    detay.image ||
    `https://image.pollinations.ai/prompt/${encodeURIComponent(
      baslik + " historical illustration cinematic 16:9"
    )}`;

  const icerikHam = `
<p>
  <img src="${temizle(imageUrl)}"
       alt="${temizle(baslik)}"
       style="width:100%;height:auto;border-radius:12px;display:block;margin-bottom:20px;">
</p>

${htmlMakale}

<hr>

<p><strong>Kaynak:</strong> Wikipedia yapay zeka teknolojileri ile desteklenen Mifrm Blogger Forum, her gün özgün ve kaliteli tarih içerikleri oluşturur. Sistem, önemli olayları analiz ederek SEO uyumlu, okunabilir ve profesyonel makaleleri otomatik olarak hazırlar.</p>

<p>
  <a href="${temizle(detay.link)}"
     target="_blank"
     rel="nofollow noopener">
     Detaylı bilgi için tıklayın
  </a>
</p>
`;

  // CDATA'ya girecek her şeyi kırılmaya karşı güvenli hale getiriyoruz.
  // Bu, artık <description> değil <content:encoded> için kullanılıyor.
  const icerik = cdataIcinGuvenliHaleGetir(icerikHam);
  const baslikGuvenli = cdataIcinGuvenliHaleGetir(baslik);

  // DÜZELTME: <description> artık tam HTML değil, kısa bir SEO özeti
  // taşıyor (CDATA'ya sarılmadan, düz metin olarak XML-escape edilmiş).
  const kisaOzet = kisaOzetOlustur(event.text);

  // Aynı olay her yıl aynı Wikipedia linkine sahip olacağından,
  // guid'i o günün tarihiyle birleştirip TEKİL hale getiriyoruz.
  // isPermaLink="false" çünkü guid artık gerçek bir URL değil.
  const guidDegeri = `${detay.link}#${slugify(baslik)}-${bugunTarihStr}`;

  // Feed okuyucularda item sırasının tutarlı olması için
  // her item'a birer saniye kaydırılmış pubDate veriyoruz.
  const itemPubDate = new Date(now.getTime() - index * 1000).toUTCString();

  const linkGuvenli = escapeXml(detay.link);
  const guidGuvenli = escapeXml(guidDegeri);
  const kategoriGuvenli = escapeXml(AYARLAR.kategori);
  const yazarGuvenli = escapeXml(AYARLAR.yazarAdi);
  const gorselUrlGuvenli = escapeXml(imageUrl);
  const medyaVideoEtiketleri = medyaVideoEtiketleriOlustur(videolar);

  return `
<item>
  <title><![CDATA[${baslikGuvenli}]]></title>

  <description>${escapeXml(kisaOzet)}</description>

  <content:encoded><![CDATA[
${icerik}
  ]]></content:encoded>

  <link>${linkGuvenli}</link>

  <guid isPermaLink="false">${guidGuvenli}</guid>

  <category>${kategoriGuvenli}</category>

  <pubDate>${itemPubDate}</pubDate>

  <dc:creator>${yazarGuvenli}</dc:creator>

  <media:content url="${gorselUrlGuvenli}" medium="image" />
${medyaVideoEtiketleri}
</item>`;
}

/* =========================================================
   ANA İŞLEM
========================================================= */

async function main() {
  const now = new Date();

  const month = String(now.getMonth() + 1).padStart(2, "0");
  const day = String(now.getDate()).padStart(2, "0");
  const bugunTarihStr = `${now.getFullYear()}-${month}-${day}`;

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
     OLAYLARI SINIRLA (rate limit / timeout koruması)
  ------------------------------------------------------- */

  const secilenler = data.events.slice(0, AYARLAR.maksMakale);

  let items = "";
  let basariliSayisi = 0;
  let hataliSayisi = 0;

  for (let i = 0; i < secilenler.length; i++) {
    const event = secilenler[i];

    try {
      const itemXml = await itemUret(event, now, i, bugunTarihStr);
      items += itemXml;
      basariliSayisi++;
    } catch (err) {
      // Tek bir olay hatası tüm üretimi düşürmesin; logla ve devam et.
      hataliSayisi++;
      console.error(
        `⚠️ Olay işlenemedi, atlanıyor (${event.text?.slice(0, 60)}...):`,
        err.message
      );
    }

    // Ücretsiz servisleri (Wikipedia / Pollinations) yormamak için
    // istekler arasına kısa bir bekleme koyuyoruz.
    if (i < secilenler.length - 1) {
      await bekle(AYARLAR.istekAraGecikmeMs);
    }
  }

  if (basariliSayisi === 0) {
    throw new Error(
      "Hiçbir makale üretilemedi (tüm olaylar hata verdi). RSS oluşturulmadı."
    );
  }

  const RSS_URL = AYARLAR.siteUrl + AYARLAR.rssDosyaAdi;

  // DÜZELTME: xmlns:content (content:encoded), xmlns:media (media:content)
  // ve xmlns:dc (dc:creator) namespace tanımları eklendi. Bunlar olmadan
  // aşağıdaki öğeler namespace'siz kalır ve bazı sıkı XML/RSS ayrıştırıcıları
  // (ve Blogger'ın içe aktarma mantığı) bu öğeleri tanımaz.
  const rss = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0"
  xmlns:atom="http://www.w3.org/2005/Atom"
  xmlns:content="http://purl.org/rss/1.0/modules/content/"
  xmlns:media="http://search.yahoo.com/mrss/"
  xmlns:dc="http://purl.org/dc/elements/1.1/">

<channel>

  <title>${temizle(AYARLAR.rssBaslik)}</title>

  <link>${escapeXml(AYARLAR.siteUrl)}</link>

  <description>${temizle(AYARLAR.rssAciklama)}</description>

  <language>tr-TR</language>

  <generator>Ultra Blogger RSS Sistemi</generator>

  <atom:link
    href="${escapeXml(RSS_URL)}"
    rel="self"
    type="application/rss+xml"/>

  <lastBuildDate>${now.toUTCString()}</lastBuildDate>

  ${items}

</channel>
</rss>`;

  /* -------------------------------------------------------
     GERÇEK XML DOĞRULAMASI (well-formed kontrolü)
     Sadece dosya boyutuna bakmak yeterli değildir; burada
     fast-xml-parser ile feed'in gerçekten geçerli XML olup
     olmadığını doğruluyoruz. Geçersizse dosya YAZILMAZ.
  ------------------------------------------------------- */

  const dogrulamaSonucu = XMLValidator.validate(rss, {
    allowBooleanAttributes: true
  });

  if (dogrulamaSonucu !== true) {
    console.error("❌ XML DOĞRULAMA HATASI:", dogrulamaSonucu.err);
    throw new Error(
      `Üretilen RSS geçerli XML değil: ${dogrulamaSonucu.err?.msg || "bilinmeyen hata"} (satır: ${dogrulamaSonucu.err?.line})`
    );
  }

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
  console.log("✅ RSS başarıyla oluşturuldu ve XML olarak doğrulandı");
  console.log(`📄 Dosya: ${OUTPUT_FILE}`);
  console.log(`📦 Boyut: ${stats.size} byte`);
  console.log(`📝 Başarılı makale sayısı: ${basariliSayisi}`);
  console.log(`⚠️ Atlanan olay sayısı: ${hataliSayisi}`);
  console.log("🖼️ Görsel içerik HTML'inin başında tek adet olarak ekleniyor");
  console.log("📱 Blogger editör uyumlu HTML üretildi (content:encoded)");
  console.log("🔍 SEO uyumlu tarih makaleleri oluşturuldu (kısa description)");
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
