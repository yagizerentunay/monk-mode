# monk-mode

> Pain is inevitable. Suffering is a choice.

Yerelde çalışan, sunucusuz bir antrenman takip uygulaması. Veriler yalnızca tarayıcında (`localStorage`) durur; hesap, bulut veya sunucu yoktur.

[openGym](https://github.com/DuarteSantos8/openGym) projesinden ürün fikri olarak esinlenir; kodu sıfırdan yazılmıştır ve openGym kodu içermez.

## Özellikler

- 876 egzersizlik kütüphane (arama, kas ve ekipman filtreleri, özel egzersiz)
- Rutin oluşturucu ve haftalık program
- Seans ekranı: kg / tekrar / RIR, önceki seanstan otomatik doldurma, dinlenme sayacı
- Tek taraflı egzersizler: sol ve sağ ayrı kaydedilir, ağırlık taraf başınadır. Hacim iki tarafın toplamıdır; 1RM ve ilerleme zayıf tarafın tekrarına göre hesaplanır
- Isınma setleri: rutinde sayısı ayarlanır (%40 → %60 → %80 rampası) veya seansta tek dokunuşla eklenir; hacim, ilerleme ve PR'a girmez, kısa dinlenme verir
- Dropset: rutinde son sete otomatik, seansta her sete tek dokunuşla eklenir (önceki setin %80'i, zincirlenebilir); hacme ve geçmişe girer, ilerleme hesabında yok sayılır
- Doğrusal ve çift ilerleme ile bir sonraki seans için ağırlık önerisi
- Tahmini 1RM grafiği, PR tespiti, antrenman geçmişi, hafta serisi
- Vücut ağırlığı kaydı, kg/lb, JSON yedek alma ve geri yükleme
- Çevrimdışı çalışma: uygulama kabuğu, egzersiz verisi ve gezilen görseller önbelleğe alınır; ana ekrana eklenebilir (PWA)

## Çalıştırma

Node.js 22 veya üstü gerekir.

```bash
npm install
npm run dev
```

Uygulama `http://localhost:5173` adresinde açılır. Telefondan yerel ağ üzerinden denemek için `npm run dev -- --host`.

### Çevrimdışı mod

Service worker yalnızca üretim derlemesinde çalışır (geliştirme sunucusunda önbellek HMR'yi bozar):

```bash
npm run build
npm run preview
```

`http://localhost:4173` adresini bir kez aç; sonrasında sunucu kapalıyken de açılır. Egzersiz görselleri yalnızca daha önce gördüklerin için çevrimdışı gelir. Önbellek şemasını değiştirirsen `public/sw.js` içindeki `VERSION` değerini artır.

## Komutlar

| Komut | Ne yapar |
|---|---|
| `npm run dev` | Geliştirme sunucusu |
| `npm run build` | Tür kontrolü ve üretim derlemesi |
| `npm test` | Birim testleri (vitest) |
| `npm run lint` | oxlint |

## Lisans

[MIT](LICENSE)
