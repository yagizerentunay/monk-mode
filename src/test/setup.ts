import { setSystemLanguages } from '../i18n/index.ts'

// Mevcut testler Türkçe metinleri doğrular. Node/jsdom cihaz dili makineye göre değişir (CI'da İngilizce):
// varsayılan 'system' ayarı testlerde hep Türkçeye çözülsün. İngilizce testler dili açıkça seçer.
setSystemLanguages(() => ['tr-TR'])
