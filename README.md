# monk-mode

> Pain is inevitable. Suffering is a choice.

Yerelde çalışan, sunucusuz bir antrenman takip uygulaması. Veriler yalnızca tarayıcında (`localStorage`) durur; hesap, bulut veya sunucu yoktur.

[openGym](https://github.com/DuarteSantos8/openGym) projesinden ürün fikri olarak esinlenir; kodu sıfırdan yazılmıştır ve openGym kodu içermez.

## Çalıştırma

Node.js 22 veya üstü gerekir.

```bash
npm install
npm run dev
```

Uygulama `http://localhost:5173` adresinde açılır. Telefondan yerel ağ üzerinden denemek için `npm run dev -- --host`.

## Komutlar

| Komut | Ne yapar |
|---|---|
| `npm run dev` | Geliştirme sunucusu |
| `npm run build` | Tür kontrolü ve üretim derlemesi |
| `npm test` | Birim testleri (vitest) |
| `npm run lint` | oxlint |

## Lisans

[MIT](LICENSE)
