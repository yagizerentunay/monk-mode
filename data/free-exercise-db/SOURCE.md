# Egzersiz verisi

`exercises.json`, [yuhonas/free-exercise-db](https://github.com/yuhonas/free-exercise-db) projesinin `dist/exercises.json` dosyasıdır (876 egzersiz), değiştirilmeden saklanır. Kaynak proje Unlicense ile kamu malıdır. Görseller repoda tutulmaz; uygulama bunları jsDelivr CDN'inden yükler.

Uygulamanın yüklediği `public/data/exercises.json` (liste alanları) ve `public/data/instructions.json` (talimatlar) bu dosyadan `npm run data:exercises` ile üretilir; elle düzenleme.

## Sabitlenen sürüm

- Upstream commit: `79ca7b47d77cd5a6dd7a50440e9f0bf24da6a142` (29 Ağustos 2026). `dist/exercises.json` içeriği bu commit'tekiyle birebir aynıdır (876 egzersiz); kopya 8 Ekim 2026'da alındı.
- Görseller de aynı commit'e sabitlenir (`src/lib/exercises.ts` içindeki `IMAGE_CDN`); veri ve görseller aynı anlık görüntüden gelir. Veriyi yenilerken ikisini birlikte güncelle.
