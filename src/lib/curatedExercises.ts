import type { Exercise } from './exercises.ts'

/** Illustrated movements created for monk-mode. Local artwork is stored in public/exercises. */
export const CURATED_EXERCISES: Exercise[] = [
  {
    id: 'monk-abdominals-floor-crunch', name: 'Floor Crunch', level: 'beginner', equipment: 'body only', category: 'strength',
    primaryMuscles: ['abdominals'], secondaryMuscles: [], images: [],
    illustration: `${import.meta.env.BASE_URL}exercises/abdominals.webp`,
    instructions: ['Sırtüstü yat, dizlerini bük ve ayak tabanlarını yere bas.', 'Karnını sıkıp kürek kemiklerini kontrollü biçimde yerden kaldır; boynunu ellerinle çekme.', 'Kısa bir an durakla ve gövdeni yavaşça başlangıç konumuna indir.'],
  },
  {
    id: 'monk-abductors-cable-hip-abduction', name: 'Cable Hip Abduction', level: 'beginner', equipment: 'cable', category: 'strength',
    primaryMuscles: ['abductors'], secondaryMuscles: ['glutes'], images: [],
    illustration: `${import.meta.env.BASE_URL}exercises/abductors.webp`,
    instructions: ['Ayak bileği manşetini alçak kabloya tak ve makinenin yanında dengeli dur.', 'Gövdeni sabit tutarak çalışma bacağını yana doğru kontrollü biçimde aç.', 'Bacağı savurmadan başlangıç konumuna döndür; iki tarafı da çalıştır.'],
  },
  {
    id: 'monk-adductors-machine', name: 'Seated Hip Adduction', level: 'beginner', equipment: 'machine', category: 'strength',
    primaryMuscles: ['adductors'], secondaryMuscles: [], images: [],
    illustration: `${import.meta.env.BASE_URL}exercises/adductors.webp`,
    instructions: ['Makineyi bedenine göre ayarla ve dizlerinin iç kısmını pedlere yerleştir.', 'Sırtını desteğe yaslayıp pedleri kontrollü biçimde birbirine yaklaştır.', 'Ağırlığın çekişine direnerek bacaklarını yavaşça başlangıca aç.'],
  },
  {
    id: 'Barbell_Curl', name: 'Barbell Curl (Illustrated)', level: 'beginner', equipment: 'barbell', category: 'strength',
    primaryMuscles: ['biceps'], secondaryMuscles: ['forearms'], images: [],
    illustration: `${import.meta.env.BASE_URL}exercises/biceps.webp`,
    instructions: ['Barı avuç içlerin öne bakacak şekilde tut; dirseklerini gövdenin yanında sabitle.', 'Dirseklerini öne taşımadan barı omuzlarına doğru kaldır.', 'Barı kontrollü biçimde indir ve bileklerini düz tut.'],
  },
  {
    id: 'Standing_Calf_Raises', name: 'Standing Calf Raise (Illustrated)', level: 'beginner', equipment: 'body only', category: 'strength',
    primaryMuscles: ['calves'], secondaryMuscles: [], images: [],
    illustration: `${import.meta.env.BASE_URL}exercises/calves.webp`,
    instructions: ['Ayak parmaklarını alçak ve sabit bir basamağa koy; dengeni bir destekten al.', 'Topuklarını rahat hareket aralığında aşağı indir.', 'Ayak parmaklarının üzerinden yüksel, üstte kısa süre dur ve yavaşça in.'],
  },
  {
    id: 'Barbell_Bench_Press_-_Medium_Grip', name: 'Barbell Bench Press (Illustrated)', level: 'beginner', equipment: 'barbell', category: 'strength',
    primaryMuscles: ['chest'], secondaryMuscles: ['shoulders', 'triceps'], images: [],
    illustration: `${import.meta.env.BASE_URL}exercises/barbell-bench-press.webp`,
    instructions: ['Düz sehpaya uzan, ayaklarını yere sağlam bas ve barı omuz genişliğinden biraz açık tut.', 'Kürek kemiklerini sehpaya yerleştir; barı kontrollü biçimde göğsünün orta-alt bölümüne indir.', 'Bileklerini dirseklerinin üzerinde tutarak barı yukarı it; ağır denemelerde gözcü kullan.'],
  },
  {
    id: 'Seated_Dumbbell_Palms-Up_Wrist_Curl', name: 'Seated Dumbbell Wrist Curl', level: 'beginner', equipment: 'dumbbell', category: 'strength',
    primaryMuscles: ['forearms'], secondaryMuscles: ['biceps'], images: [],
    illustration: `${import.meta.env.BASE_URL}exercises/forearms.webp`,
    instructions: ['Otur ve ön kollarını uyluklarına dayayarak bileklerini dizlerinin önünde serbest bırak.', 'Dambılları kavra; ön kolların sabitken bileklerini kontrollü biçimde yukarı bük.', 'Ağırlığı yavaşça indir ve hareketi ağrısız aralıkta tut.'],
  },
  {
    id: 'Barbell_Hip_Thrust', name: 'Barbell Hip Thrust', level: 'intermediate', equipment: 'barbell', category: 'strength',
    primaryMuscles: ['glutes'], secondaryMuscles: ['hamstrings'], images: [],
    illustration: `${import.meta.env.BASE_URL}exercises/glutes.webp`,
    instructions: ['Üst sırtını sehpaya dayayıp barı kalça kıvrımına yerleştir; rahatlık için ped kullan.', 'Ayaklarını yere bas ve kalçanı, kaburgalarını aşağıda tutarak yukarı kaldır.', 'Gövden yere paralel olduğunda kalçanı sık; belini aşırı çukurlaştırmadan kontrollü in.'],
  },
  {
    id: 'Romanian_Deadlift', name: 'Romanian Deadlift', level: 'intermediate', equipment: 'barbell', category: 'strength',
    primaryMuscles: ['hamstrings'], secondaryMuscles: ['glutes', 'lower back'], images: [],
    illustration: `${import.meta.env.BASE_URL}exercises/hamstrings.webp`,
    instructions: ['Barı uyluklarının önünde tut; dizlerini hafifçe bük ve sırtını nötr konumda koru.', 'Kalçanı geriye göndererek barı bacaklarına yakın biçimde aşağı indir.', 'Arka bacaklarında gerginlik hissedince kalçanı öne getirerek ayağa kalk; belinden çekme.'],
  },
  {
    id: 'Wide-Grip_Lat_Pulldown', name: 'Wide-Grip Lat Pulldown', level: 'beginner', equipment: 'cable', category: 'strength',
    primaryMuscles: ['lats'], secondaryMuscles: ['biceps', 'middle back'], images: [],
    illustration: `${import.meta.env.BASE_URL}exercises/lats.webp`,
    instructions: ['Diz pedini sabitle ve barı omuzlarından biraz geniş tutuşla kavra.', 'Gövdeni dik tutarak dirseklerini aşağı ve yanlara çek; barı üst göğsüne doğru indir.', 'Barı başının arkasına çekme; kollarını kontrollü biçimde başlangıca uzat.'],
  },
  {
    id: 'Hyperextensions_Back_Extensions', name: '45-Degree Back Extension', level: 'beginner', equipment: 'body only', category: 'strength',
    primaryMuscles: ['lower back'], secondaryMuscles: ['glutes', 'hamstrings'], images: [],
    illustration: `${import.meta.env.BASE_URL}exercises/lower-back.webp`,
    instructions: ['Kalça pedini leğen kemiğinin altına gelecek biçimde ayarla; ayaklarını sabitle.', 'Gövdeni kalçadan öne eğ, sırtını nötr ve hareketi kontrollü tut.', 'Gövden bacaklarınla aynı hizaya gelene kadar yüksel; daha yukarıya belini geriye atma.'],
  },
  {
    id: 'Seated_Cable_Rows', name: 'Seated Close-Grip Cable Row', level: 'beginner', equipment: 'cable', category: 'strength',
    primaryMuscles: ['middle back'], secondaryMuscles: ['lats', 'biceps'], images: [],
    illustration: `${import.meta.env.BASE_URL}exercises/middle-back.webp`,
    instructions: ['Ayaklarını platforma yerleştir, dizlerini hafif bük ve tutacağı kavra.', 'Gövdeni sallamadan dirseklerini geriye çek; tutacağı alt kaburgalarına yaklaştır.', 'Omuzlarını öne bırakmadan kollarını kontrollü biçimde uzat.'],
  },
  {
    id: 'monk-neck-hand-resisted-isometric', name: 'Hand-Resisted Neck Isometric', level: 'beginner', equipment: null, category: 'strength',
    primaryMuscles: ['neck'], secondaryMuscles: [], images: [],
    illustration: `${import.meta.env.BASE_URL}exercises/neck.webp`,
    instructions: ['Dik otur ve başını nötr konumda tut; avucunu şakağının yanına hafifçe yerleştir.', 'Başını yana çevirmeden elinle çok hafif direnç uygula ve boyun kaslarını nazikçe sık.', 'Kısa süre tutup bırak; keskin ağrı, uyuşma veya baş dönmesi olursa hemen dur.'],
  },
  {
    id: 'Barbell_Squat', name: 'Barbell Back Squat', level: 'intermediate', equipment: 'barbell', category: 'strength',
    primaryMuscles: ['quadriceps'], secondaryMuscles: ['glutes', 'hamstrings'], images: [],
    illustration: `${import.meta.env.BASE_URL}exercises/quadriceps.webp`,
    instructions: ['Barı üst sırtına yerleştir, ayaklarını rahat ve dengeli bir genişlikte aç.', 'Karnını sıkıp kalçanı aşağı-arkaya gönder; dizlerini ayak parmaklarının yönünde takip ettir.', 'Kontrolünü koruyabildiğin derinliğe in ve ayak tabanından kuvvet alarak ayağa kalk.'],
  },
  {
    id: 'Dumbbell_Shoulder_Press', name: 'Seated Dumbbell Shoulder Press', level: 'beginner', equipment: 'dumbbell', category: 'strength',
    primaryMuscles: ['shoulders'], secondaryMuscles: ['triceps'], images: [],
    illustration: `${import.meta.env.BASE_URL}exercises/shoulders.webp`,
    instructions: ['Sırt destekli sehpaya otur ve dambılları omuz hizasında, bileklerin dirseklerin üzerinde tut.', 'Gövdeni sabit tutarak dambılları başının üzerine doğru it.', 'Dambılları kontrollü biçimde omuz hizasına indir; belini aşırı kavislendirme.'],
  },
  {
    id: 'Barbell_Shrug', name: 'Barbell Shrug (Illustrated)', level: 'beginner', equipment: 'barbell', category: 'strength',
    primaryMuscles: ['traps'], secondaryMuscles: ['forearms'], images: [],
    illustration: `${import.meta.env.BASE_URL}exercises/traps.webp`,
    instructions: ['Barı uyluklarının önünde tut ve kollarını düz bırak.', 'Omuzlarını kulaklarına doğru dikey olarak kaldır; omuzlarını daire çizdirerek döndürme.', 'Üstte kısa süre dur ve omuzlarını yavaşça başlangıca indir.'],
  },
  {
    id: 'Triceps_Pushdown', name: 'Cable Triceps Pushdown', level: 'beginner', equipment: 'cable', category: 'strength',
    primaryMuscles: ['triceps'], secondaryMuscles: [], images: [],
    illustration: `${import.meta.env.BASE_URL}exercises/triceps.webp`,
    instructions: ['Kabloya düz bar tak; dirseklerini gövdenin yanında tut.', 'Üst kollarını sabit tutarak barı dirseklerini açıp aşağı doğru it.', 'Kollarını kontrollü biçimde başlangıca bük; omuzlarını öne düşürme.'],
  },
  {
    id: 'monk-abdominals-cable-crunch', name: 'Kneeling Cable Crunch', level: 'beginner', equipment: 'cable', category: 'strength',
    primaryMuscles: ['abdominals'], secondaryMuscles: [], images: [],
    illustration: `${import.meta.env.BASE_URL}exercises/abdominals-cable-crunch.webp`,
    instructions: ['Halatı yüksek makaraya takıp diz çök; halatı başının yanlarında tut.', 'Kalçanı mümkün olduğunca sabit tutarak karnını sık ve gövdeni kontrollü biçimde öne kıvır.', 'Kabloyu savurmadan başlangıca dön; boynunu ellerinle çekme.'],
  },
  {
    id: 'monk-abductors-side-lying-hip-abduction', name: 'Side-Lying Hip Abduction', level: 'beginner', equipment: 'body only', category: 'strength',
    primaryMuscles: ['abductors'], secondaryMuscles: ['glutes'], images: [],
    illustration: `${import.meta.env.BASE_URL}exercises/abductors-side-lying-hip-abduction.webp`,
    instructions: ['Yan yat ve başını kolunla destekle; üstteki bacağını düz, gövdeni sabit tut.', 'Üst bacağını kalçadan kontrollü biçimde yukarı kaldır; ayağını öne çevirmemeye çalış.', 'Bacağını yavaşça indir ve iki tarafı da çalıştır.'],
  },
  {
    id: 'monk-adductors-copenhagen-plank', name: 'Knee-Supported Copenhagen Plank', level: 'beginner', equipment: 'body only', category: 'strength',
    primaryMuscles: ['adductors'], secondaryMuscles: ['abdominals'], images: [],
    illustration: `${import.meta.env.BASE_URL}exercises/adductors-copenhagen-plank.webp`,
    instructions: ['Yan plank pozisyonu al ve üstteki dizini sağlam, kaymayan bir sehpaya yerleştir.', 'Kalçanı yerden kaldırıp başından dizine kadar düz bir çizgi oluştur; kısa süre tut.', 'Kontrollü biçimde in; önce kısa tutuşlarla başla ve dizinde ya da kasığında ağrı olursa bırak.'],
  },
  {
    id: 'monk-biceps-incline-dumbbell-curl', name: 'Incline Dumbbell Curl', level: 'beginner', equipment: 'dumbbell', category: 'strength',
    primaryMuscles: ['biceps'], secondaryMuscles: ['forearms'], images: [],
    illustration: `${import.meta.env.BASE_URL}exercises/biceps-incline-dumbbell-curl.webp`,
    instructions: ['Eğimli sehpaya otur; kollarını aşağı sarkıtıp dirseklerini gövdenin yanında tut.', 'Dirseklerini yerinden oynatmadan dambılları omuzlarına doğru kaldır.', 'Ağırlıkları yavaşça indir; omuzlarını öne yuvarlama.'],
  },
  {
    id: 'monk-calves-seated-calf-raise', name: 'Seated Calf Raise', level: 'beginner', equipment: 'machine', category: 'strength',
    primaryMuscles: ['calves'], secondaryMuscles: [], images: [],
    illustration: `${import.meta.env.BASE_URL}exercises/calves-seated-calf-raise.webp`,
    instructions: ['Makineye otur ve diz pedini uyluklarına yerleştir; ayak uçlarını platforma bas.', 'Topuklarını kontrollü biçimde aşağı indir, ardından ayak uçlarından iterek yükselt.', 'Üstte kısa dur ve ağırlığı sarsmadan başlangıca indir.'],
  },
  {
    id: 'monk-chest-incline-barbell-bench-press', name: 'Incline Barbell Bench Press', level: 'intermediate', equipment: 'barbell', category: 'strength',
    primaryMuscles: ['chest'], secondaryMuscles: ['shoulders', 'triceps'], images: [],
    illustration: `${import.meta.env.BASE_URL}exercises/chest-incline-barbell-bench-press.webp`,
    instructions: ['Sehpayı hafif eğime ayarla, ayaklarını yere bas ve barı omuz genişliğinden biraz açık kavra.', 'Kürek kemiklerini sehpaya yerleştir; barı üst göğsüne doğru kontrollü indir.', 'Bileklerini dirseklerinin üzerinde tutarak barı yukarı it; ağır denemelerde gözcü kullan.'],
  },
  {
    id: 'monk-forearms-reverse-ez-bar-curl', name: 'Reverse EZ-Bar Curl', level: 'beginner', equipment: 'e-z curl bar', category: 'strength',
    primaryMuscles: ['forearms'], secondaryMuscles: ['biceps'], images: [],
    illustration: `${import.meta.env.BASE_URL}exercises/forearms-reverse-ez-bar-curl.webp`,
    instructions: ['EZ barı üstten kavra; dirseklerini gövdenin yanında, bileklerini düz tut.', 'Dirseklerini sabit tutarak barı kontrollü biçimde göğsüne doğru kaldır.', 'Barı yavaşça indir; bileğinde rahatsızlık olursa yükü azalt veya bırak.'],
  },
  {
    id: 'monk-glutes-bulgarian-split-squat', name: 'Bulgarian Split Squat', level: 'beginner', equipment: 'body only', category: 'strength',
    primaryMuscles: ['glutes'], secondaryMuscles: ['quadriceps', 'hamstrings'], images: [],
    illustration: `${import.meta.env.BASE_URL}exercises/glutes-bulgarian-split-squat.webp`,
    instructions: ['Arka ayağını alçak ve sabit bir sehpaya koy; ön ayağını dengeli bir mesafede yerleştir.', 'Gövdeni dengede tutarak iki dizini bük ve kontrol edebildiğin derinliğe in.', 'Ön ayağından kuvvet alarak yüksel; iki tarafı da çalıştır ve gerekirse destek al.'],
  },
  {
    id: 'monk-hamstrings-lying-leg-curl', name: 'Lying Leg Curl', level: 'beginner', equipment: 'machine', category: 'strength',
    primaryMuscles: ['hamstrings'], secondaryMuscles: ['calves'], images: [],
    illustration: `${import.meta.env.BASE_URL}exercises/hamstrings-lying-leg-curl.webp`,
    instructions: ['Makineye yüzüstü uzan ve ruloyu ayak bileklerinin hemen üzerine ayarla.', 'Kalçanı sehpada tutarak dizlerini bük ve topuklarını kontrollü biçimde kalçana yaklaştır.', 'Ağırlığı bırakmadan bacaklarını yavaşça düzleştir.'],
  },
  {
    id: 'monk-lats-assisted-pull-up', name: 'Assisted Pull-Up', level: 'beginner', equipment: 'machine', category: 'strength',
    primaryMuscles: ['lats'], secondaryMuscles: ['biceps', 'middle back'], images: [],
    illustration: `${import.meta.env.BASE_URL}exercises/lats-assisted-pull-up.webp`,
    instructions: ['Yardımlı barfiks makinesinin desteğini ayarla ve barı omuzlarından biraz geniş kavra.', 'Dirseklerini aşağı çekerek gövdeni kontrollü biçimde yukarı kaldır.', 'Kollarını yavaşça uzat; omuzlarını kulaklarına doğru sıkıştırma.'],
  },
  {
    id: 'monk-lower-back-bird-dog', name: 'Bird Dog', level: 'beginner', equipment: 'body only', category: 'strength',
    primaryMuscles: ['lower back'], secondaryMuscles: ['abdominals', 'glutes'], images: [],
    illustration: `${import.meta.env.BASE_URL}exercises/lower-back-bird-dog.webp`,
    instructions: ['Ellerini omuzlarının, dizlerini kalçalarının altına koy; sırtını nötr tut.', 'Gövdeni döndürmeden karşı kolunu ve bacağını uzat; kısa süre dengede kal.', 'Kontrollü biçimde başlangıca dön ve taraf değiştir; belini çukurlaştırma.'],
  },
  {
    id: 'monk-middle-back-chest-supported-row', name: 'Chest-Supported Dumbbell Row', level: 'beginner', equipment: 'dumbbell', category: 'strength',
    primaryMuscles: ['middle back'], secondaryMuscles: ['lats', 'biceps'], images: [],
    illustration: `${import.meta.env.BASE_URL}exercises/middle-back-chest-supported-row.webp`,
    instructions: ['Eğimli sehpaya yüzüstü uzan ve dambılları kolların aşağı sarkacak şekilde tut.', 'Göğsünü sehpada tutarak dirseklerini geriye çek ve dambılları kaburgalarına yaklaştır.', 'Omuzlarını öne düşürmeden kollarını kontrollü biçimde uzat.'],
  },
  {
    id: 'monk-neck-hand-resisted-isometric-lateral', name: 'Lateral Hand-Resisted Neck Isometric', level: 'beginner', equipment: null, category: 'strength',
    primaryMuscles: ['neck'], secondaryMuscles: [], images: [],
    illustration: `${import.meta.env.BASE_URL}exercises/neck-hand-resisted-isometric.webp`,
    instructions: ['Dik otur ve başını nötr tut; avucunu şakağının yanına hafifçe yerleştir.', 'Başını oynatmadan elinle çok hafif direnç uygula; kısa süre tut ve nefes almaya devam et.', 'Bırakıp diğer tarafa geç; ağrı, uyuşma veya baş dönmesi olursa hemen dur.'],
  },
  {
    id: 'monk-quadriceps-leg-extension', name: 'Leg Extension', level: 'beginner', equipment: 'machine', category: 'strength',
    primaryMuscles: ['quadriceps'], secondaryMuscles: [], images: [],
    illustration: `${import.meta.env.BASE_URL}exercises/quadriceps-leg-extension.webp`,
    instructions: ['Makineye otur ve sırtını desteğe yasla; ruloyu ayak bileklerinin üzerine ayarla.', 'Dizlerini kontrollü biçimde açarak bacaklarını öne uzat; dizlerini sertçe kilitleme.', 'Ağırlığı yavaşça indir ve hareketi rahat aralıkta tut.'],
  },
  {
    id: 'monk-shoulders-cable-lateral-raise', name: 'Single-Arm Cable Lateral Raise', level: 'beginner', equipment: 'cable', category: 'strength',
    primaryMuscles: ['shoulders'], secondaryMuscles: ['traps'], images: [],
    illustration: `${import.meta.env.BASE_URL}exercises/shoulders-cable-lateral-raise.webp`,
    instructions: ['Alçak makarayı kullan; kabloya yan durup tutacağı uzak elinle kavra.', 'Dirseğini hafif bükülü tutarak kolunu yana, omuz hizasına kadar kaldır.', 'Gövdeni sallamadan kolunu yavaşça indir; omuzda sıkışma hissedersen aralığı azalt.'],
  },
  {
    id: 'monk-traps-face-pull', name: 'Cable Face Pull', level: 'beginner', equipment: 'cable', category: 'strength',
    primaryMuscles: ['traps'], secondaryMuscles: ['shoulders', 'middle back'], images: [],
    illustration: `${import.meta.env.BASE_URL}exercises/traps-face-pull.webp`,
    instructions: ['Halatı yüz hizasındaki makaraya tak ve iki ucunu başparmakların arkaya bakacak şekilde kavra.', 'Dirseklerini yana açarak halatı yüzüne doğru çek; omuzlarını kulaklarına kaldırma.', 'Kollarını kontrollü biçimde uzat ve gövdeni sabit tut.'],
  },
  {
    id: 'monk-triceps-overhead-cable-extension', name: 'Overhead Cable Triceps Extension', level: 'beginner', equipment: 'cable', category: 'strength',
    primaryMuscles: ['triceps'], secondaryMuscles: [], images: [],
    illustration: `${import.meta.env.BASE_URL}exercises/triceps-overhead-cable-extension.webp`,
    instructions: ['Alçak makaraya halat takıp makaraya sırtını dön; halatı başının arkasında tut.', 'Dirseklerini başının yanında sabitleyerek kollarını kontrollü biçimde yukarı aç.', 'Dirseklerini yavaşça büküp başlangıca dön; belini aşırı çukurlaştırma.'],
  },
]

/** Merge locally illustrated demonstrations into existing upstream records, adding only new movements. */
export function mergeCuratedExercises(base: Exercise[]): Exercise[] {
  const byId = new Map(CURATED_EXERCISES.map((exercise) => [exercise.id, exercise]))
  const added = CURATED_EXERCISES.filter((exercise) => exercise.id.startsWith('monk-'))
  const illustrated = base.map((exercise) => {
    const guide = byId.get(exercise.id)
    return guide ? { ...exercise, illustration: guide.illustration, instructions: guide.instructions } : exercise
  })
  return [...added, ...illustrated]
}
