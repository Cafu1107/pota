<p align="center">
  <a href="https://cafu1107.github.io/pota/"><img src="docs/assets/banner-tr.png" alt="Pota: canlı basketbol skorları ve istatistikleri. Masaüstünde şut haritalı bir maç sayfası, telefonda maç özeti." width="100%"></a>
</p>

<p align="center"><b>18 ligin canlı skorları, box score'ları, şut haritaları, puan durumları ve haberleri; Türkçe ve İngilizce.</b></p>

<p align="center">
  <a href="https://cafu1107.github.io/pota/"><img src="https://img.shields.io/badge/Canl%C4%B1_demoyu_a%C3%A7-ea580c?style=for-the-badge&logoColor=white" alt="Canlı demoyu aç" height="38"></a>
</p>

<p align="center">
  <a href="https://github.com/Cafu1107/pota/actions/workflows/ci.yml"><img src="https://github.com/Cafu1107/pota/actions/workflows/ci.yml/badge.svg" alt="CI"></a>
  <a href="https://github.com/Cafu1107/pota/actions/workflows/pages.yml"><img src="https://github.com/Cafu1107/pota/actions/workflows/pages.yml/badge.svg" alt="GitHub Pages yayını"></a>
  <a href="LICENSE"><img src="https://img.shields.io/badge/lisans-GPL--3.0-blue" alt="Lisans: GPL-3.0"></a>
  <img src="https://img.shields.io/badge/React-19-149eca?logo=react&logoColor=white" alt="React 19">
  <img src="https://img.shields.io/badge/TypeScript-strict-3178c6?logo=typescript&logoColor=white" alt="TypeScript strict">
  <img src="https://img.shields.io/badge/PWA-y%C3%BCklenebilir-5a0fc8?logo=pwa&logoColor=white" alt="Yüklenebilir PWA">
</p>

<p align="center"><a href="README.md">English</a> · Türkçe</p>

<p align="center">
  <img src="docs/assets/demo-tr.gif" alt="Pota'da gezinti: maçlar sayfası, canlı bir maç, maç akışı, box score, haberler ve EuroLeague puan durumu." width="100%">
</p>

## Neler var

| ⚡ Canlı | 📊 Maç merkezi | 🏆 Ligler |
|---|---|---|
| Günün bütün maçları lig lig. Canlı maçlar 5 saniyede bir yenilenir; sayı olunca skor kayarak değişir ve satır bir kez parlar. | Box score, filtrelenebilir maç akışı, şut haritası, skor farkı grafiği, yan yana takım istatistikleri ve maçın yıldızları. | Tur ya da tarihe göre fikstür; play-off, play-in ve küme düşme bölgeleri belirgin puan durumu; istatistik liderleri ve takımlar. |
| **⭐ Favoriler** | **🆚 Karşılaştırma** | **📰 Haberler** |
| Yıldızladığın takımların maçları en üstte durur; takip ettiğin ligleri sabitleyebilirsin. | İki oyuncu ya da iki takım, sezon ortalamalarıyla yan yana. | TBF, NTV Spor, TRT Spor, Fotomaç, Eurohoops ve ESPN'den basketbol haberleri; konuya ya da kaynağa göre süzülür. Her haber yayımlandığı sitede açılır. |

Ayrıca takım sayfaları (sıradaki maç, son maçlar, sezon istatistikleri, kadro), oyuncu sayfaları (künye, ortalamalar, maç maç istatistikler, kariyer), Türkçe karakter yazmasan da "besiktas" diye bulan <kbd>Ctrl</kbd> <kbd>K</kbd> araması, açık ve koyu tema, ve internet yokken son bilinen verilerle açılan yüklenebilir uygulama.

## Ekran görüntüleri

<table>
  <tr>
    <td width="50%"><img src="docs/screenshots/tr-scores.webp" alt="Canlı maçlı maçlar sayfası: lig listesi, öne çıkan maç ve puan durumu kartı"></td>
    <td width="50%"><img src="docs/screenshots/tr-game.webp" alt="Maç özeti: periyot skorlu başlık, skor farkı grafiği ve maçın yıldızları"></td>
  </tr>
  <tr>
    <td><img src="docs/screenshots/tr-shots.webp" alt="Koyu temada şut haritası: isabetler dolu nokta, kaçanlar halka"></td>
    <td><img src="docs/screenshots/tr-box.webp" alt="İlk 5 ve yedekleriyle box score, sıralanabilir sütunlar ve oyuncu fotoğrafları"></td>
  </tr>
  <tr>
    <td><img src="docs/screenshots/tr-standings.webp" alt="EuroLeague puan durumu: sıralama sütunu vurgulu, bölge çizgileri belirgin"></td>
    <td><img src="docs/screenshots/tr-news.webp" alt="Haberler sayfası: manşet, öne çıkanlar ve konu ile kaynak filtreleri"></td>
  </tr>
</table>

<p align="center">
  <img src="docs/screenshots/tr-m-scores.webp" alt="Telefon: canlı maç şeridiyle maçlar sayfası" width="24%">
  <img src="docs/screenshots/tr-m-game.webp" alt="Telefon: koyu temada maç başlığı ve skor farkı grafiği" width="24%">
  <img src="docs/screenshots/tr-m-standings.webp" alt="Telefon: takım sütunu sabit, sayılar kayan Basketbol Süper Ligi puan durumu" width="24%">
  <img src="docs/screenshots/tr-m-news.webp" alt="Telefon: haberler sayfası" width="24%">
</p>

## Ligler ve veri kaynakları

| Bölge | Ligler | Kaynak |
|---|---|---|
| Türkiye | Basketbol Süper Ligi, Kadınlar Basketbol Süper Ligi, TBL, TKBL, TB2L, gençler ve bölgesel ligler | TBF web servisi, canlı veriler FIBA LiveStats'ten |
| Avrupa | EuroLeague, EuroCup | EuroLeague API |
| ABD | NBA, WNBA, G League, NCAA erkekler ve kadınlar | ESPN |
| Dünya | NBL (Avustralya), FIBA milli takımlar | ESPN |

TBF servisi ve ESPN herkese açık ama resmi olmayan kaynaklardır. Pota bağımsız bir projedir; TBF, FIBA, EuroLeague, ESPN ya da haber siteleriyle bağlantısı yoktur. Logolar, fotoğraflar ve haberler sahiplerine aittir.

## Neden hızlı

- **Bütün kaynakların önünde tek bir ortak önbellek.** Her istek, yanıtları bellekten veren ve eskiyen kopyayı arka planda tazeleyen küçük bir aracıdan geçer; yenileme neredeyse hiç kaynağı beklemez. Yerelde bu `server/proxy.mjs`, canlı demoda aynı kurallarla çalışan bir Cloudflare Worker'dır (`deploy/worker`).
- **Küçücük canlı güncellemeler.** Maç listeleri, canlı Türk maçları için sıkıştırılmış bir akışı yoklar: maç başına tam FIBA LiveStats dosyasının 440 KB'ı yerine yaklaşık 0,3 KB.
- **Veri, sen tıklamadan gelir.** Bir maçın, takımın ya da başka bir günün üstüne gelmek ya da dokunmak onu yüklemeye başlar; açman muhtemel sayfalar tarayıcı boştayken hazırlanır.
- **Tekrar gelişte veri cihazından gelir.** Son veriler IndexedDB'de saklanır, anında gösterilir ve arkada tazelenir. Yerel sunucuda 18 ligin tamamı yaklaşık üçte bir saniyede yüklenir, tekrar açılışta yaklaşık 25 ms'de ekrandadır.

## Kullanım

1. **[Canlı demoyu](https://cafu1107.github.io/pota/)** aç.
2. İstersen uygulama olarak yükle: Chrome ya da Edge'de "Uygulamayı yükle", telefonda "Ana ekrana ekle".
3. Takımlarını yıldızla; maçları, maçlar sayfasında en üstte durur.

### Kendi bilgisayarında çalıştır

[Node.js](https://nodejs.org) 20 veya üstü gerekir.

```bash
npm install
npm run serve    # derler ve http://localhost:4173 adresinde açar
```

Windows'ta `Pota.cmd` dosyasına çift tıklamak yeterli: gerekirse kurar, derler, sunucuyu başlatıp tarayıcıyı açar. Sunucu bir de ağ adresi yazar (`http://192.168.x.x:4173`); aynı Wi-Fi'deki telefondan bu adresle açabilirsin.

<details>
<summary><b>Yazılımcılar için</b></summary>

```bash
npm run dev        # aracılı Vite geliştirme sunucusu: http://localhost:5173
npm test           # birim testleri, ağ gerekmez
npm run test:live  # gerçek API'lere karşı duman testi
npm run build      # tip kontrolü ve dist/ içine üretim derlemesi
```

**Yapı**

- Her kaynağın `src/data/providers/` altında bir sağlayıcısı var (`tbf.ts`, `euroleague.ts`, `espn.ts`); hepsi tek bir veri modeline dönüşür (`src/data/types.ts`). Sayfalar verinin nereden geldiğini bilmez.
- Haberler `src/data/news.ts` içinde: TBF API'si ile RSS ve Atom akışları birleştirilir, tekrarlar ayıklanır, Türkiye, Avrupa ya da NBA diye etiketlenir.
- `server/upstreams.mjs`, hem yerel aracının hem Worker'ın kullandığı izin listesini ve önbellek kurallarını tutar.
- Canlı Türk maçları FIBA LiveStats'ten gelir; TBF servisi maç sırasında geride kalır.
- Arayüz metinleri `src/i18n/tr.ts` ve `src/i18n/en.ts` içinde; her anahtar ikisinde de vardır.

**Kendi kopyanı yayınlamak**

1. Aracıyı yayınla: `cd deploy/worker && npm install && npx wrangler login && npm run deploy`. Sitenin adresini `wrangler.toml` içindeki `ALLOWED_ORIGINS` listesine ekle.
2. GitHub reposunda `POTA_PROXY_BASE` adlı Actions değişkenini `https://<worker>.<hesap>.workers.dev/proxy` yap ve Pages kaynağı olarak "GitHub Actions"ı seç.
3. `main` dalına gönder. `.github/workflows/pages.yml`, `VITE_BASE=/<repo>/` ile derler ve yayınlar.

</details>

## Sık sorulanlar

<details>
<summary><b>Demo neden bir Cloudflare Worker kullanıyor?</b></summary>

GitHub Pages yalnızca dosya sunar. TBF ve FIBA LiveStats başka sitelerin tarayıcıdan kendilerine istek atmasına izin vermez (CORS). Bu yüzden demo, doğru başlıkları ekleyen ve yanıtları önbelleğe alan küçük bir Worker'dan geçer. Worker yalnızca sabit bir kaynak listesine iletir ve tarayıcılar onu yalnızca demonun kendi adresinden çağırabilir.
</details>

<details>
<summary><b>Canlı skorlar ne kadar güncel?</b></summary>

Canlı maç sayfası 5 saniyede, maç listeleri 8 saniyede bir yenilenir. Kaynakların kendi gecikmesi bunun üstüne eklenir.
</details>

<details>
<summary><b>Bir ligde hiç maç görünmüyor.</b></summary>

Lig büyük ihtimalle sezon arasında ya da tatilde. ESPN liglerinde (NBA, WNBA, NCAA ve diğerleri) yeni sezon başlayana kadar puan durumu son tamamlanan sezonu gösterir.
</details>

## Katkı

Hata bildirimleri ve lig istekleri [Issues](https://github.com/Cafu1107/pota/issues) bölümüne açılabilir. Pull request açmadan önce [CONTRIBUTING.md](CONTRIBUTING.md) dosyasına göz at.

## Lisans

[GPL-3.0-or-later](LICENSE). Veriler, logolar, fotoğraflar ve haberler sahiplerine aittir.
