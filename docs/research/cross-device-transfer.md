# Sunucusuz cihazlar arası veri aktarımı

> Araştırma notu, Ekim 2026, v0.6.0 (`main` = `072ca14`). Bu belge yalnız öneri içerir; uygulamaya özellik eklenmedi.
> Prototip `research/transfer-prototype` dalında duruyor, merge edilmeyecek.

## Özet

- **Yedek küçük.** Gerçekçi bir yıllık veri, bugünkü yedek biçimiyle (2 boşluk girintili JSON) **~540–600 KB**. Girintisiz JSON ~170–200 KB, `deflate-raw` ile sıkıştırınca **~11–18 KB** (ayrıntı: [Ölçümler](#ölçümler)). Aktarım hızı hiçbir seçenekte darboğaz değil. Asıl sorun adım sayısı ve platform kısıtları.
- **Öneri, 1. aşama (S):** Var olan yedek ve paylaşım akışını bir "Başka cihaza aktar" akışına çevirmek. Gönderen tarafta `shareBackup` zaten AirDrop, Quick Share, Mesajlar ve Dosyalar'a gidiyor. Eksik olan alıcı taraf: kullanıcıya ne yapacağını söyleyen tek ekran, dosya açılınca doğrudan birleştirme önizlemesi ve Android'de manifest `share_target` ile uygulamanın paylaşım menüsünde görünmesi.
- **Öneri, 2. aşama (M, deneysel):** **Animasyonlu QR** (fountain kodu). Üçüncü taraf yok, ağ yok, iOS ↔ Android arasında çalışıyor. Prototipte bir yıllık gürültülü veri, %30 kare kaybıyla 5 fps'de ortalama **~17 saniyede** bit bit aynı geri geldi. iOS'ta `BarcodeDetector` olmadığı için JS çözücü (jsQR, ~45 KB gzip) tembel yüklenmeli.
- **Önerilmeyen: WebRTC.** İki yönlü QR değişimi gerekiyor. Yerel ağda iOS'un host ICE adayı kısıtı ve AP izolasyonu var; hücresel ağda TURN gerekiyor, bu da sunucu demek. Veri 20 KB olduğu için hız avantajı da işe yaramıyor. Maliyeti L, kazancı düşük.

## Bugünkü durum (kod)

| Parça | Ne yapıyor |
|---|---|
| `src/store/backup.ts` | `exportBackup`: `{ app: 'monk-mode', exportedAt, state }`, `JSON.stringify(…, null, 2)`. `importBackupWithReport`: doğrulama ve göç. |
| `src/store/downloadBackup.ts` | `shareBackup`: dokunmatik cihazda `navigator.share({ files })`, yoksa indirme. Paylaşım iptal edilirse "yedeklendi" işaretlenmez. |
| `src/lib/mergeBackup.ts` | Başka cihazdan gelen yedeği hiçbir şeyi silmeden birleştiriyor (kimlik ve içerik imzası ile çakışma raporu). |
| `src/components/MergeImportCard.tsx` | Ayarlar'da `<input type="file">` ile birleştirme. |
| `src/lib/folderBackup.ts` ve `src/store/folderBackup.ts` | Masaüstü Chromium'da File System Access ile seçilen klasöre günlük otomatik yedek. |
| `vite.config.ts` → `CSP` | `default-src 'self'; script-src 'self'; connect-src 'self'; worker-src 'self'; img-src 'self' data: blob:; …`. Üretimde `<meta>` olarak ekleniyor; `e2e/csp.e2e.ts` ihlal olmadığını doğruluyor. |
| `public/sw.js` | Uygulama kabuğunu önbellekliyor; `prefetchChunks` eklentisi tembel parçaları da önceden indiriyor. |

Yani aktarımın yarısı zaten var: gönderme (`shareBackup`) ve güvenli birleştirme (`mergeBackup`). Eksik olan uçtan uca bir "aktarım" deneyimi.

## Ölçümler

Yöntem: `scripts/demo-data.ts` içindeki `WEEKS = 11` sabiti ortam değişkenine çevrildi ve aynı üreteç 52, 104 ve 156 haftayla çalıştırıldı. Haftada 3 rutin, ara sıra serbest gün, tatil boşlukları ve iki günde bir vücut ağırlığı kaydı var. Üreteç çok düzenli olduğu için ikinci bir **gürültülü** sürüm de ölçüldü: ağırlık, tekrar ve RIR değerlerine rastgele sapma eklendi, başlangıç saatleri kaydırıldı, antrenmanların %30'una not yazıldı. Gerçek veri iki satırın arasında olmalı. Betikler prototip dalında: `research/transfer-prototype/dump.ts`.

| Veri | Antrenman / set | Yedek (girintili) | Girintisiz JSON | gzip -9 | deflate-raw | brotli -11 |
|---|---|---|---|---|---|---|
| 1 yıl, düzenli | 167 / 2 902 | 536 KB | 171 KB | 10,6 KB | 10,6 KB | 7,6 KB |
| 1 yıl, gürültülü | 167 / 2 902 | 547 KB | 177 KB | 18,2 KB | 18,2 KB | 14,7 KB |
| 2 yıl, düzenli | 340 / 5 916 | 1 089 KB | 348 KB | 20,2 KB | 20,2 KB | 14,1 KB |
| 3 yıl, düzenli | 514 / 8 936 | 1 643 KB | 524 KB | 29,1 KB | 29,1 KB | 20,5 KB |

Çıkarımlar:

- Girinti, dosyayı ~3 kat büyütüyor. Aktarım yükünde girintisiz JSON kullanılmalı. Kullanıcıya inen yedek dosyası okunabilir kalabilir.
- Tarayıcıda yerleşik `CompressionStream('deflate-raw')` yeterli, kütüphane gerekmiyor. Brotli tarayıcıda yerleşik değil ve %20 kazanç için bağımlılık eklemeye değmez.
- 3 yıllık veri bile sıkıştırılmış olarak 30 KB altında. QR'da 30–70 kare demek; dosya paylaşımında ise önemsiz.

### Animasyonlu QR prototip ölçümü

Boru hattı: girintili yedek → `deflate-raw` → 500 baytlık bloklar → LT fountain çerçeveleri (sistematik ilk tur, sonra sağlam soliton) → base45 → QR (ECC M) → PNG → jsQR ile okuma → peeling çözücü → CRC32 → `inflate` → karşılaştırma. Kamera kaybı, karelerin rastgele atlanmasıyla taklit edildi; her satır 8 farklı tohumun ortalaması.

| Veri | Blok sayısı (k) | QR sürümü | Kare kaybı | Gösterilen kare (ort. / en çok) | 5 fps süre | Okunan / k | Sonuç |
|---|---|---|---|---|---|---|---|
| 1 yıl, gürültülü (22,4 KB*) | 46 | 17–18 | %0 | 46 / 46 | 9,2 sn | 1,00 | birebir aynı |
| 1 yıl, gürültülü | 46 | 18 | %30 | 87 / 103 | 17,5 sn | 1,31 | birebir aynı |
| 1 yıl, gürültülü | 46 | 18 | %50 | 122 / 146 | 24,4 sn | 1,34 | birebir aynı |

\* Prototip girintili metni sıkıştırıyor. Girintisiz metinle yük 18,2 KB'a, süre de ~%20 aşağı iner.

Blok boyutu denemesi (gürültülü veri, %30 kayıp, tek tohum): 300 B → QR v13, 30 sn; 500 B → v18, 17 sn; 800 B → v23, 11 sn. Büyük QR daha az kare demek ama telefon ekranından ekrana okuması zorlaşıyor. Gerçek cihazda 400–600 B (v15–v19) denenmeli.

Kütüphane boyutları (esbuild ile küçültülmüş, gzip): `qrcode` üretici ~9 KB, fountain ve base45 kodu ~1,5 KB, `jsqr` çözücü ~45 KB.

## Karşılaştırma

| | 1. WebRTC DataChannel (manuel sinyal) | 2. Animasyonlu QR (fountain) | 3. Yedek dosyası + paylaşım (iyileştirilmiş) | 4a. Ortak bulut klasörü (FS Access) | 4b. Tek seferlik şifreli link |
|---|---|---|---|---|---|
| Üçüncü taraf | STUN'suz: yok. STUN ile: STUN sunucusu IP'yi görür. Hücreselde TURN gerekir, yani sunucu. | Yok | Seçilen kanal: AirDrop ve Quick Share doğrudan cihazdan cihaza; Mesajlar ve WhatsApp uçtan uca şifreli; e-posta ve Drive düz metin. | Bulut sağlayıcı (iCloud, Drive, OneDrive) | Mesaj kanalı. Veri `#` parçasında olduğu için GitHub Pages görmez. |
| Ağ gerekir mi | Aynı ağ ya da internet | Hayır | Kanala göre (AirDrop yakın mesafe, ağsız) | Evet | Evet (mesaj için) |
| iOS Safari / Chrome iOS (WebKit) | DataChannel var. Kamera ya da mikrofon izni yoksa host ICE adayı verilmiyor[^webkit-ice]; yerelde mDNS `.local` adayları gerekiyor. | `BarcodeDetector` yok (Safari 17'de yalnız bayrakla)[^bcd]. JS çözücü şart. Kamera ana ekran uygulamasında da çalışıyor. | `navigator.share({ files })` Safari 14'ten beri var[^share]. Ana ekran uygulaması paylaşım hedefi olamıyor; alıcı tarafta dosya seçici gerekiyor. | `showDirectoryPicker` yok | Link Safari'de açılır; ana ekran uygulamasının deposu Safari'den ayrı[^ios-storage]. Veri yanlış depoya gider. |
| Android Chrome | Tam destek | `BarcodeDetector` 83'ten beri var[^bcd] | Paylaşım var. Kurulu PWA `share_target` ile paylaşım menüsünde görünebiliyor[^share-target]. | `showDirectoryPicker` yok | Link Chrome'da açılır; kurulu PWA ile depo ortak. |
| CSP / service worker | `connect-src` WebRTC'yi kapsamıyor[^csp-webrtc], değişiklik gerekmiyor. SW ile ilgisi yok. | jsQR ve qrcode saf JS: CSP değişikliği yok. zxing-wasm seçilirse `script-src 'wasm-unsafe-eval'` ve wasm'ı kendi sunucudan vermek gerekir[^zxing]. Tembel parça `prefetchChunks` yüzünden çevrimdışı önbelleğe de girer. | Değişiklik yok. `share_target` için SW'nin POST'u yakalaması gerekir; SW yoksa GitHub Pages 405 döner. | Zaten var (masaüstü) | Değişiklik yok |
| Kullanıcı adımları | A: "Gönder", offer QR'ı göster. B: tara, answer QR'ı göster. A: tara. Aktarım. **İki kamera, iki ekran, 4 adım.** | A: "Aktar", QR oynar. B: "Al", kamera açılır, ~10–25 sn tut, önizleme, birleştir. **2–3 adım.** | A: "Aktar", AirDrop ya da Quick Share. B: dosyayı aç ya da kaydet, uygulamada "Aktarımı al", dosyayı seç, önizleme, birleştir. **4–5 adım; Android'de share_target ile 3.** | Masaüstü otomatik yazar; telefonda Dosyalar'dan seçip birleştirme | A: linki gönder. B: linke dokun. iOS'ta yanlış depo. |
| Aynı cihazda Safari → ana ekran uygulaması | Hayır | Hayır (tek kamera) | **Evet** (Dosyalar üzerinden) | Hayır | Hayır |
| Şifreleme | DTLS (yerleşik) | Yok; ekranı gören okuyabilir. Yakın mesafe, kısa süre. | Kanala bağlı; isteğe bağlı parola ile AES-GCM eklenebilir. | Sağlayıcının şifrelemesi | AES-GCM; anahtar ayrı kanaldan verilmeli, yoksa anlamsız. |
| Geliştirme maliyeti | **L** | **M** | **S** (+S `share_target`, +S parola) | 0 (var) | S, ama iOS'ta işe yaramaz |

### Diğerleri, kısaca

- **Yerel ağ sunucusu:** Tarayıcı soket dinleyemiyor; sunucusuz bir PWA için imkânsız.
- **Web Bluetooth:** iOS'ta yok; çevre birimi (peripheral) rolü de hiçbir tarayıcıda yok.
- **Pano:** Sıkıştırılmış base45 metni (~25 KB) kopyalanıp diğer cihaza yapıştırılabilir. Apple Evrensel Pano ya da Windows Phone Link ile çalışır, platformlar arası çalışmaz. Ucuz bir "gelişmiş" seçenek olabilir ama öncelikli değil.
- **Tek seferlik link:** Rutin paylaşım oturumu link ve QR kodlaması yapıyor; tam yedek için link önerilmiyor. 25 KB'lık yük URL'de taşınabilir ama iOS'ta Safari ile ana ekran uygulamasının ayrı depoları yüzünden veri yanlış yere düşer. Mesajlaşma uygulamaları da uzun linkleri kesebilir.

## Platform kısıtları, ayrıntı

- **iOS'ta depo ayrımı:** Safari, Chrome for iOS (iOS 16.4'ten beri o da ana ekrana ekleyebiliyor) ve ana ekran uygulaması ayrı depolar kullanıyor[^ios-storage]. Bir iPhone'da veri üç farklı yerde olabilir. Linkle gelen her şey tarayıcıya düşer. Yalnız **dosya** ve **kamera** bu sınırı aşabiliyor. "Aktarımı al" ekranı bu yüzden uygulamanın içinde başlamalı.
- **iOS'ta paylaşım hedefi yok:** WebKit `share_target` ve `file_handlers` desteklemiyor. AirDrop ile gelen `.json` Dosyalar'a iner; kullanıcı uygulamaya dönüp dosyayı seçmeli. Bu adım ancak açık talimatla kısaltılabilir.
- **iOS'ta WebRTC:** Kamera ya da mikrofon izni verilmeden host adayları gizleniyor[^webkit-ice]. QR ile sinyalleşmede kamera zaten açık olduğundan izin pratikte gelir. Yine de mDNS `.local` çözümlemesi ve misafir ağlarda AP izolasyonu (spor salonu Wi-Fi'ı) bağlantıyı düşürür. Bu, gerçek cihazda denenmedi.
- **`BarcodeDetector`:** Android Chrome 83+. Masaüstünde yalnız macOS ve ChromeOS. Safari'de yalnız bayrakla, Firefox'ta yok[^bcd]. iOS'ta worker içinde var görünüp çalışmadığı bildirilen bir hata var[^webkit-bcd-worker]. Özellik tespiti gerçek bir çözümleme denemesiyle yapılmalı.
- **Kamera:** `getUserMedia` HTTPS ister (GitHub Pages uygun). iOS ana ekran uygulamasında izin her oturumda yeniden sorulabilir.

## Gizlilik ve güvenlik

- 1. aşamada uygulama hiçbir yere veri göndermiyor; kanalı kullanıcı seçiyor. Akış ekranında "AirDrop ve Quick Share doğrudan cihazdan cihaza gider; e-posta ve Drive dosyayı sunucuda tutar" diye tek satır yazılmalı.
- İsteğe bağlı **parola ile şifreleme**: WebCrypto PBKDF2 (≥ 600 000 tur, SHA-256) ve AES-GCM, dosya uzantısı `.monk`. Kütüphane gerekmiyor, CSP değişmiyor. Unutulan parola veriyi kurtarılamaz yapar; bu yüzden varsayılan kapalı olmalı.
- Animasyonlu QR şifresiz; omzunun üstünden bakan biri, bir kameranın 20 saniye ekranı okuması gerekecek kadar uzun süre bakmalı. İstenirse QR yükü, alıcıda gösterilen 6 haneli bir kodla şifrelenebilir (ikinci aşamanın ikinci aşaması).
- Alınan her yük, bugünkü gibi `importBackupWithReport` (doğrulama ve göç) ve `mergeBackup` (silmeden birleştirme) üzerinden geçmeli. Yeni bir güven yüzeyi açılmaz.

## Önerilen yol ve kaba uygulama planı

### 1. aşama: "Başka cihaza aktar" (S, ~1–2 gün)

1. Ayarlar → Veri altında tek giriş: **Başka cihaza aktar**. İki sekme: *Gönder* ve *Al*.
2. *Gönder*: `shareBackup`'ı çağırır (değişiklik yok). Altında platforma göre kısa talimat: iPhone → AirDrop, Android → Quick Share. "Yedeklendi" işareti bugünkü gibi yalnız başarıdan sonra yazılır.
3. *Al*: Dosya seçici, ardından **önizleme** ("+42 antrenman, 3 çakışma yereldeki korunur") ve **Birleştir** düğmesi. `MergeImportCard` mantığı yeniden kullanılır; önizleme için `mergeBackup` raporu birleştirmeden önce hesaplanır.
4. Aktarım dosyası girintisiz JSON olabilir (`exportBackup(state, now, { compact: true })`): 540 KB yerine 180 KB. Biçim aynı kaldığı için içe aktarma değişmez.
5. Testler: e2e'de *Al* akışı (`e2e/merge.e2e.ts` örüntüsü), birim testte önizleme raporu.

### 1b. Android paylaşım hedefi (S, ~1 gün)

1. `manifest.webmanifest` → `share_target` (`method: POST`, `enctype: multipart/form-data`, `files: [{ name: 'backup', accept: ['application/json', '.json'] }]`, `action: './?share-target'`).
2. `public/sw.js`: bu POST'u yakala, dosyayı `Cache` ya da IndexedDB'ye koy, `303` ile `./#/settings?aktarim=al` adresine yönlendir. Uygulama açılınca önizleme gelir.
3. Risk: SW etkin değilse POST GitHub Pages'e gider ve 405 döner. Kurulu PWA'da SW hep etkin olduğu için pratikte sorun çıkmaması beklenir; e2e ile doğrulanmalı.

### 2. aşama (deneysel): Animasyonlu QR (M, ~4–6 gün)

1. `src/lib/fountain.ts`: prototipteki LT kodlayıcı ve çözücü, base45 ve CRC32 (bağımlılıksız, ~1,5 KB gzip, birim testli).
2. *Gönder → QR ile*: girintisiz JSON → `CompressionStream('deflate-raw')` → çerçeveler → `qrcode` ile `<canvas>`'a 5 fps. Ekran parlaklığı ve Wake Lock (`src/lib/useWakeLock.ts` var).
3. *Al → QR ile*: `getUserMedia` (arka kamera). `BarcodeDetector` gerçekten çözüyorsa onu kullan, yoksa tembel yüklenen jsQR worker'ı. İlerleme çubuğu `decoder.progress()` ile, sonra 1. aşamadaki önizleme ve birleştirme.
4. CSP değişmez (saf JS, aynı kaynaktan worker). `prefetchChunks` jsQR parçasını da önceden indirir (~45 KB gzip). Kabul edilebilir; istenirse eklentiye hariç tutma listesi eklenir.
5. "Deneysel" etiketiyle, Ayarlar'da açılıp kapanabilir şekilde yayınla. Gerçek cihaz eşleşmeleri (iPhone ↔ Android, eski Android) elle test edilmeli.

### WebRTC neden yok

Tek kazancı hız, o da 20 KB için önemsiz. Buna karşılık iki yönlü QR değişimi gerekiyor (her iki cihazda kamera ve ekran), iOS'ta ICE ve mDNS belirsizliği var, misafir ağlarda AP izolasyonu bağlantıyı kesiyor, hücresel ağda TURN yani sunucu gerekiyor. QR ile sinyalleşme kurulacaksa, aynı QR altyapısı veriyi zaten doğrudan taşıyabiliyor (2. aşama).

## Riskler

| Risk | Etki | Azaltma |
|---|---|---|
| iOS alıcı tarafta dosyayı bulmak (Dosyalar → İndirilenler) kullanıcıyı yorar | 1. aşamanın asıl sürtünmesi | Talimat metni, ekran görüntüsü; "AirDrop ile gelen dosyayı Dosyalar'a kaydet" adımı |
| Ekrandan ekrana QR okuma gerçek cihazda simülasyondan kötü (moiré, parlaklık, odak) | Süre 2–3 katına çıkabilir | Blok boyutu ve fps ayarı; kare kaybı %50'de bile çözücü 1,34 kat fazlalıkla bitiriyor |
| jsQR bakımsız (son sürüm 2020) | Güvenlik ve uyumluluk | Küçük ve saf JS; alternatif `zxing-wasm` (CSP'ye `wasm-unsafe-eval` ve ~1 MB wasm) ya da gelecekte Safari'de `BarcodeDetector` |
| `share_target` POST'u SW yokken 405 | Android'de nadir hata | Yalnız kurulu PWA'da etkin; e2e testi |
| Parola şifrelemesinde unutulan parola | Veri kaybı hissi | Varsayılan kapalı; şifresiz yedek her zaman mümkün |
| Birleştirme çakışmaları (iki cihazda aynı gün farklı antrenman) | Kullanıcı şaşırır | `mergeBackup` zaten yereli koruyor ve sayıyor; önizlemede gösterilmeli |

## Denenmeyenler

- Gerçek telefonlarda kamera ile animasyonlu QR okuma. Prototip okumayı PNG üzerinden jsQR ile yaptı; ekran, kamera, ışık ve hareket etkisi ölçülmedi.
- WebRTC DataChannel, hiçbir cihazda kurulmadı. iOS'taki ICE davranışı kaynaklara dayanıyor; kaynaklar 2017–2022 tarihli.
- `share_target` ve service worker POST yakalama, GitHub Pages üzerinde.
- `CompressionStream('deflate-raw')` tarayıcıda ölçülmedi; boyutlar Node `zlib` ile alındı. Aynı algoritma olduğu için aynı çıkması beklenir.

## Prototip

`research/transfer-prototype` dalı, `research/transfer-prototype/` klasörü (merge edilmez):

- `fountain.ts`: LT kodlayıcı ve peeling çözücü, base45, CRC32. Bağımlılıksız, tarayıcıya taşınabilir.
- `fountain.test.ts`: kayıplı ve sırasız çerçevelerle gidiş-dönüş (vitest, CI'da koşuyor).
- `roundtrip.ts`: yedek → QR PNG → jsQR → birleştirme, ölçüm çıktısı. `dump.ts` ve `demo-year.ts` örnek veri üretiyor.

```bash
cd research/transfer-prototype && npm install && WEEKS=52 NOISY=1 node dump.ts year.json && LOSS=0.3 BLOCK=500 node roundtrip.ts year.json
```

## Kaynaklar

[^bcd]: MDN, [BarcodeDetector](https://developer.mozilla.org/en-US/docs/Web/API/BarcodeDetector) ve [browser-compat-data](https://github.com/mdn/browser-compat-data/blob/main/api/BarcodeDetector.json): Chrome Android 83, Safari 17 yalnız bayrakla, Firefox yok, masaüstü Chrome yalnız macOS ve ChromeOS.
[^webkit-bcd-worker]: WebKit Bugzilla [#198174](https://bugs.webkit.org/show_bug.cgi?id=198174): iOS'ta worker içinde `BarcodeDetector` kullanılamıyor.
[^share]: MDN, [Navigator.canShare](https://developer.mozilla.org/en-US/docs/Web/API/Navigator/canShare): `files`, Safari ve iOS 14+, Chrome Android 76+, Firefox yok.
[^share-target]: Chrome for Developers, [Web Share Target API](https://developer.chrome.com/docs/capabilities/web-apis/web-share-target) ve [File Handling](https://developer.chrome.com/docs/capabilities/web-apis/file-handling) (yalnız masaüstü).
[^ios-storage]: WebKit Bugzilla [#181849](https://bugs.webkit.org/show_bug.cgi?id=181849): ana ekran uygulamaları Safari ile depo paylaşmıyor (tasarım gereği).
[^webkit-ice]: WebKit blog, [A Closer Look Into WebRTC](https://webkit.org/blog/7763/a-closer-look-into-webrtc): yakalama izni olmadan yalnız srflx ve TURN adayları. Ayrıca WebKit Bugzilla [#198887](https://bugs.webkit.org/show_bug.cgi?id=198887) ve [#236357](https://bugs.webkit.org/show_bug.cgi?id=236357).
[^csp-webrtc]: MDN, [connect-src](https://developer.mozilla.org/en-US/docs/Web/HTTP/Reference/Headers/Content-Security-Policy/connect-src): RTCPeerConnection kapsamda değil. CSP3'teki `webrtc` yönergesi henüz hiçbir tarayıcıda yok ([centralcsp özeti](https://next.centralcsp.com/en/docs/web-security/policies/content-security-policy/directives/webrtc)).
[^zxing]: [barcode-detector](https://www.npmjs.com/package/barcode-detector) (zxing-wasm tabanlı çoklu dolgu, wasm varsayılan olarak jsDelivr'dan yükleniyor) ve [LottieFiles, CSP and WASM self-hosting](https://github.com/LottieFiles/dotlottie-web/wiki/CSP-and-WASM-Self%E2%80%90Hosting-Guide) (`wasm-unsafe-eval`).

Diğer: [jsQR](https://github.com/cozmo/jsQR), [node-qrcode](https://github.com/soldair/node-qrcode), [qrloop](https://www.npmjs.com/package/qrloop) (LT esinli animasyonlu QR, en çok 5 fps önerisi), [@ngraveio/bc-ur](https://www.npmjs.com/package/@ngraveio/bc-ur) (BC-UR fountain kodu), [RFC 9285 base45](https://www.rfc-editor.org/rfc/rfc9285), MacKay, [Fountain codes](https://www.inference.org.uk/mackay/DFountain.html), [nimiq/qr-scanner](https://github.com/nimiq/qr-scanner) (BarcodeDetector ve worker yedeği).
