# Egzersiz verisi: Open Exercise Atlas

Monk Mode'un egzersiz kataloğu elle düzenlenmez. Tek kaynak
[Open Exercise Atlas](https://github.com/yagizerentunay/open-exercise-atlas) deposudur; bu depodaki
dosyalar o depodan, sabitlenmiş bir commit'ten **üretilir**:

| Dosya | Ne |
|---|---|
| `public/data/exercises.json` | Seçilebilir kütüphane (her satırda bir kayıt) |
| `public/data/legacy-exercises.json` | Kütüphanede olmayan eski kimlikler için ad, kas ve ekipman |
| `public/exercises/*` | Atlas'tan bayt bayt kopyalanan egzersiz görselleri (`.webp`, `.png`) |
| `data/atlas.lock.json` | Kullanılan Atlas commit'i ve dosya özetleri (sha256) |

Bunlara elle dokunma: bir sonraki senkronda üzerine yazılırlar ve `npm run data:atlas:check` hata verir.

## Egzersiz ekleme ya da düzeltme

1. **Atlas deposunda** kaydı ekle ya da düzelt (`data/exercises/<id>.json`, medya `media/exercises/`), Atlas'ın
   doğrulamasını (`npm run validate`, `npm run data:build`) çalıştır ve push'la.
2. Monk Mode'da pini yenile ve çıktıları üret:
   ```bash
   npm run data:atlas:update          # main'in ucuna sabitler; ya da: npm run data:atlas:update -- <sha>
   npm test
   ```
3. Değişen `data/atlas.lock.json`, `public/data/*.json` ve `public/exercises/*` dosyalarını commit'le.

Atlas'ı yerel bir çalışma kopyasından denemek için (önce Atlas'ta commit'le; kilit yalnız commit'lenmiş
içeriği taşır):

```bash
node scripts/sync-atlas.ts --from ../open-exercise-atlas --update
```

## Komutlar

| Komut | Ne yapar |
|---|---|
| `npm run data:atlas` | Kilitteki commit'in `dist/exercises.json` ve medya dosyalarını raw.githubusercontent.com'dan indirir, sha256'ları kilitle doğrular, çıktıları yazar |
| `npm run data:atlas:update [-- <sha>]` | Pini yeniler (varsayılan: `main`in ucu, `git ls-remote` ya da GitHub API ile) ve kilidi yazar |
| `npm run data:atlas:check` | Çıktıları bellekte yeniden üretir, commit'lenmiş dosyalardan farklıysa hata verir (yazmaz) |
| `node scripts/sync-atlas.ts --from <dizin>` | Ağ yerine yerel Atlas kopyasından (`dist/` ve `media/`) okur; `--update` ve `--check` ile birleşir |

Güvenlik: kilitteki commit değişmediyse indirilen/okunan her dosyanın sha256'sı kilitle eşleşmek zorundadır;
eşleşmezse hiçbir şey yazılmaz. Yeni commit'e sabitlerken (`--update`) yerel kopyada, tüketilen dosyalarda
commit'lenmemiş değişiklik olamaz.

## Kilit dosyası (`data/atlas.lock.json`)

```json
{
  "schemaVersion": 1,
  "repository": "yagizerentunay/open-exercise-atlas",
  "commit": "<40 haneli sha>",
  "files": {
    "dist/exercises.json": "<sha256>",
    "media/exercises/<dosya>.webp": "<sha256>"
  },
  "generated": {
    "public/data/exercises.json": "<sha256>",
    "public/data/legacy-exercises.json": "<sha256>"
  }
}
```

`files` yalnız tüketilen dosyaları (kaydın seçilen görseli) listeler, anahtarlar sıralıdır. Hiç senkronlanmamış
kilitte `commit` `null`, tablolar boştur; `src/lib/atlasLock.test.ts` bu durumda özet testlerini atlar.

## Dönüşüm kuralları (`src/lib/atlasAdapter.ts`)

| Monk Mode alanı | Atlas kaynağı |
|---|---|
| `id` | `legacyIds[0]`, yoksa `atlas:<id>` |
| `name` | `name.en` |
| `instructions` | `instructions.tr` doluysa o, yoksa `instructions.en` |
| `instructionsEn` | Yalnız `instructions` Türkçeyken ve `instructions.en` doluyken: `instructions.en` (İngilizce arayüz bunu gösterir; yoksa `instructions`) |
| `aliases` | `aliases` (yalnız içe aktarma eşleştirmesinde kullanılır) |
| `level` | `difficulty`; `advanced` -> `expert` |
| `category` | `category`; `mobility` -> `stretching` |
| `equipment` | Kodlar Monk değerine çevrilir, bench/mat/pull-up-bar atlanır, ilk kod seçilir; yoksa ya da `[]` ise `null` |
| `primaryMuscles`, `secondaryMuscles` | `upper-back` -> `middle back`, `lower-back` -> `lower back`, `hip-flexors` -> `hip flexors`; diğerleri aynı |
| `illustration` | `reference` > `finish` > `start` rolündeki ilk medya, `exercises/<dosya adı>`; yoksa alan yok |

Ekipman eşlemesi: `bodyweight` -> `body only`, `band` -> `bands`, `kettlebell` -> `kettlebells`,
`ez-bar` -> `e-z curl bar`, `exercise-ball` -> `exercise ball`; `barbell`, `dumbbell`, `cable`, `machine`, `other`
aynı kalır.

Eski kimlik tablosu: kütüphane kaydının çalışma zamanı kimliği tablodan düşer; `legacyIds[1..]` kaydın adı,
kası ve ekipmanıyla tabloya girer (geçmiş antrenmanlar bu kimliklerle de çözülür). Tablonun geri kalanının
sırası korunur. Kütüphane ada göre sıralanır.

Üretim şu durumlarda **hata verir** (çıktı yazılmaz): yinelenen çalışma zamanı ya da eski kimlik,
`custom-` ile başlayan `legacyIds`, bilinmeyen kas/ekipman/seviye kodu, yönergesi olmayan kayıt, dosya yolu
olmayan ya da indirilemeyen medya, aynı ada giden farklı iki görsel. Kayıtlar `libraryProblems`
(`src/lib/exerciseData.ts`) ile de doğrulanır (ad tekrarı dahil).

## Önbellek

Egzersiz listesi service worker'da `staleWhileRevalidate`, görseller cache-first tutulur
(`public/sw.js`). Görsel dosya adları Atlas kimliğinden geldiği için bir kayıt yeniden adlandırılırsa görsel yeni
bir adreste önbelleğe alınır; eski kopya `MAX_IMAGES` sınırıyla temizlenir.
