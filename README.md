# monk-mode

> Pain is inevitable. Suffering is a choice.

Yerelde çalışan, sunucusuz bir antrenman takip uygulaması. Veriler yalnızca tarayıcında (`localStorage`) durur; hesap, bulut veya sunucu yoktur.

[openGym](https://github.com/DuarteSantos8/openGym) projesinden ürün fikri olarak esinlenir; kodu sıfırdan yazılmıştır ve openGym kodu içermez.

## Özellikler

- 876 egzersizlik kütüphane (arama, kas ve ekipman filtreleri, özel egzersiz)
- Rutin oluşturucu ve haftalık program
- Seans ekranı: kg / tekrar / RIR, önceki seanstan otomatik doldurma, dinlenme sayacı
- Tek taraflı egzersizler: sol ve sağ ayrı kaydedilir, ağırlık taraf başınadır. Hacim iki tarafın toplamıdır; 1RM ve ilerleme zayıf tarafın tekrarına göre hesaplanır. Antrenman bir taraf yapılmışken biterse set "yarım set" olarak kaydedilir: yapılan taraf hacme girer, ilerleme/1RM/PR'a girmez
- Isınma setleri: rutinde sayısı ayarlanır (%40 → %60 → %80 rampası) veya seansta tek dokunuşla eklenir; hacim, ilerleme ve PR'a girmez, kısa dinlenme verir. İlk çalışma setinin ağırlığını değiştirince henüz yapılmamış ve elle dokunulmamış ısınmalar yeni rampaya güncellenir
- Dropset: rutinde son sete otomatik, seansta her sete tek dokunuşla eklenir (önceki setin %80'i, zincirlenebilir); hacme ve geçmişe girer, ilerleme hesabında yok sayılır
- Strong ve Hevy içe aktarma: Ayarlar'dan CSV seçilir, önizlemede antrenman/set sayısı, birim ve egzersiz eşleşmeleri görünür. Egzersiz adı kütüphanede güvenle eşleşmezse özel egzersiz olarak alınır (yanlış egzersize yazılmaz); ısınma ve drop setleri, Hevy süpersetleri ve süre korunur; aynı dosyayı tekrar yüklemek kayıtları çoğaltmaz. Hevy Türkçe uygulama dilindeyse Türkçe ay adları ("1 Eki 2026") ve temel egzersiz/ekipman adları ("Barfiks", "Dambıl", "Oturarak") tanınır. Hevy CSV biçimi gerçek bir dosyayla henüz doğrulanmadı (yalnız Hevy'nin antrenman sayfasından Türkçe adlar ve tarih biçimi görüldü)
- Kas haritası: İstatistik ekranında son 7 veya 30 günde kas başına set sayısı, ön ve arka vücut şemasında ısı rengiyle ve listede. Birincil kas 1, yardımcı kas 0,5 set sayılır; ısınma sayılmaz, hedef haftada 10 set. Bir kasa dokununca sayısı ve hedefi görünür
- Süperset: rutinde "Öncekiyle süperset" ile ardışık egzersizler bağlanır (ikili, üçlü…), seansta da tek dokunuşla açılıp kapanır. Egzersizler turlar hâlinde dönüşümlü yapılır; dinlenme sayacı yalnız turun sonunda başlar. Hacim, ilerleme ve PR egzersiz bazında aynen çalışır
- Plaka hesaplayıcı: seansta egzersizin "Plakalar" düğmesi hedef ağırlığı bar + taraf başına plakalara böler (sıradaki set önceden seçili, set ağırlıkları tek dokunuşla). Bar ağırlığı ve eldeki plakalar Ayarlar'da, kg ve lb için ayrı tutulur; tam tutmayan yükte hedefi aşmayan en yakın yük gösterilir
- Doğrusal ve çift ilerleme ile bir sonraki seans için ağırlık önerisi
- Tahmini 1RM grafiği, PR tespiti, antrenman geçmişi, hafta serisi
- Vücut ağırlığı kaydı, kg/lb, JSON yedek alma ve geri yükleme
- Yedek hatırlatması: veri yalnızca tarayıcıda durduğu için, son yedekten beri veri değişmiş ve 14 gün (Ayarlar'dan Kapalı/7/14/30) geçmişse Ana Sayfa'da "Verini yedekle" şeridi çıkar; "Yedeği indir" ya da "3 gün sonra hatırlat". Değişiklik verinin parmak iziyle anlaşılır; yedekten sonra bir şey değişmediyse hatırlatmaz. Hiç yedek yoksa süre en eski kayıttan sayılır
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

### Telefonda deneme (GitHub Pages)

Service worker ve PWA kurulumu yalnızca HTTPS (veya localhost) üzerinde çalışır; telefonda denemek için uygulama GitHub Pages'e alt yol olarak yayınlanır.

1. Repo **Settings → Pages → Source: GitHub Actions** olarak ayarla.
2. `main`'e push edince `.github/workflows/pages.yml` derleyip yayınlar: `https://yagizerentunay.github.io/monk-mode/`
3. Telefonda bu adresi aç, "Ana ekrana ekle" ile kur.

Veriler origin başına `localStorage`'da tutulur; telefon boş başlar. Verini taşımak için bilgisayarda **Ayarlar → Yedeği indir**, telefonda **Yedeği yükle** kullan.

Alt yol derlemesini yerelde denemek (PowerShell):

```powershell
$env:BASE_PATH='/monk-mode/'; npm run build; npx vite preview --base /monk-mode/
$env:BASE_PATH=$null
```

Adres: `http://localhost:4173/monk-mode/`. Normal (kök) derleme için `BASE_PATH` tanımlama.
## Komutlar

| Komut | Ne yapar |
|---|---|
| `npm run dev` | Geliştirme sunucusu |
| `npm run build` | Tür kontrolü ve üretim derlemesi |
| `npm test` | Birim testleri (vitest) |
| `npm run lint` | oxlint |

## Lisans

[MIT](LICENSE)
