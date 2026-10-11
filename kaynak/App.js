// 360 Çekim – iPhone uygulaması
// Kamerayı açar, seçilen lens ve kare hızıyla süreli kayıt yapar,
// kayıt bitince videoyu aynı Wi-Fi'daki laptop programına gönderir.

import { Component, useEffect, useMemo, useRef, useState } from 'react';
import { Modal, Pressable, ScrollView, StatusBar, StyleSheet, Text, TextInput, View, Linking } from 'react-native';
import { useKeepAwake } from 'expo-keep-awake';

// ---- Hata yakalama: bir sorun olursa siyah ekran yerine hatayı ekranda göster ----
let sonHata = null;
const hataDinleyicileri = new Set();
function hataBildir(e) {
  sonHata = e;
  hataDinleyicileri.forEach((f) => f(e));
}
if (global.ErrorUtils && global.ErrorUtils.setGlobalHandler) {
  global.ErrorUtils.setGlobalHandler((e) => hataBildir(e));
}

// Yerel modülleri güvenli yükle: biri eksikse uygulama çökmesin, sebebini göstersin
let VC = null;
let AsyncStorage = null;
try {
  VC = require('react-native-vision-camera');
} catch (e) {
  hataBildir(new Error('Kamera modülü yüklenemedi: ' + (e?.message || e)));
}
try {
  AsyncStorage = require('@react-native-async-storage/async-storage').default;
} catch (e) {
  AsyncStorage = null; // ayarlar kaydedilmez ama uygulama çalışır
}
let Network = null;
try {
  Network = require('expo-network');
} catch (e) {
  Network = null; // otomatik bulma yalnızca hotspot aralığını tarar
}

// ---- Laptoptaki programı ağda otomatik bulma ----
const PORT = 8000;
async function laptopMu(adres, ms = 900) {
  const kontrol = new AbortController();
  const zaman = setTimeout(() => kontrol.abort(), ms);
  try {
    const r = await fetch(`http://${adres}/api/son`, { signal: kontrol.signal });
    if (!r.ok) return false;
    const j = await r.json();
    return j && typeof j === 'object' && 'marka' in j; // bizim programın cevabı
  } catch (e) {
    return false;
  } finally {
    clearTimeout(zaman);
  }
}
async function laptopBul(kayitli) {
  const adaylar = [];
  const ekle = (a) => { if (a && !adaylar.includes(a)) adaylar.push(a); };
  ekle(kayitli);
  // iPhone hotspot'u (Kişisel Erişim Noktası) her zaman 172.20.10.x aralığını kullanır
  for (let i = 2; i <= 14; i++) ekle(`172.20.10.${i}:${PORT}`);
  // Telefonun bağlı olduğu Wi-Fi ağı
  let ip = null;
  try { ip = Network ? await Network.getIpAddressAsync() : null; } catch (e) {}
  if (ip && /^(10\.|192\.168\.|172\.(1[6-9]|2\d|3[01])\.)/.test(ip)) {
    const on = ip.split('.').slice(0, 3).join('.');
    for (let i = 1; i <= 254; i++) if (`${on}.${i}` !== ip) ekle(`${on}.${i}:${PORT}`);
  }
  for (let i = 0; i < adaylar.length; i += 24) {
    const grup = adaylar.slice(i, i + 24);
    const sonuc = await Promise.all(grup.map((a) => laptopMu(a).then((ok) => (ok ? a : null))));
    const bulunan = sonuc.find(Boolean);
    if (bulunan) return bulunan;
  }
  return null;
}

const zamanAsimi = (p, ms) => Promise.race([p, new Promise((_, r) => setTimeout(() => r(new Error('zaman aşımı')), ms))]);

const RENK = { bg: '#000', panel: 'rgba(20,16,28,0.85)', line: '#3a3248', fg: '#f4eee6', muted: '#a99fb5', accent: '#e6c48a', ink: '#2a1f0e', rec: '#e5484d', ok: '#8fd19e', err: '#f0938a' };
const SURELER = [5, 8, 10, 15];
const FPSLER = [30, 60, 120, 240];
const GERI_SAYIMLAR = [3, 5, 0];
const bekle = (ms) => new Promise((r) => setTimeout(r, ms));

// Kamerayı kullanıcıya anlaşılır bir adla göster; birden fazla lensi birleştiren sanal kameraları atla
function lensAdi(d) {
  if (!d) return '';
  if (d.position === 'front') return 'Ön';
  const p = d.physicalDevices || [];
  if (p.length !== 1) return null;
  if (p[0] === 'ultra-wide-angle-camera') return 'Geniş 0.5x';
  if (p[0] === 'wide-angle-camera') return 'Normal 1x';
  if (p[0] === 'telephoto-camera') return 'Yakın';
  return null;
}

// Uygulamanın kökü: hata varsa hata ekranını, yoksa kamerayı gösterir
export default function Kok() {
  const [hata, setHata] = useState(sonHata);
  useEffect(() => {
    hataDinleyicileri.add(setHata);
    return () => hataDinleyicileri.delete(setHata);
  }, []);
  if (hata || !VC) return <HataEkrani hata={hata || new Error('Kamera modülü bulunamadı')} />;
  return (
    <HataSiniri>
      <App />
    </HataSiniri>
  );
}

class HataSiniri extends Component {
  constructor(p) { super(p); this.state = { hata: null }; }
  static getDerivedStateFromError(hata) { return { hata }; }
  render() { return this.state.hata ? <HataEkrani hata={this.state.hata} /> : this.props.children; }
}

function HataEkrani({ hata }) {
  return (
    <View style={[s.tam, { paddingTop: 70, paddingHorizontal: 20 }]}>
      <StatusBar barStyle="light-content" />
      <Text style={[s.modalBaslik, { color: RENK.err }]}>Uygulamada hata oluştu</Text>
      <Text style={[s.aciklama, { marginVertical: 12 }]}>Bu ekranın görüntüsünü al ve gönder.</Text>
      <ScrollView style={{ flex: 1 }}>
        <Text style={{ color: RENK.fg, fontSize: 13 }} selectable>
          {String(hata?.message || hata)}{'\n\n'}{String(hata?.stack || '').slice(0, 3000)}
        </Text>
      </ScrollView>
    </View>
  );
}

function App() {
  useKeepAwake(); // çekim sırasında ekran kararmasın
  const { hasPermission, requestPermission } = VC.useCameraPermission();
  const tumKameralar = VC.useCameraDevices();
  const kamera = useRef(null);

  const [hazir, setHazir] = useState(false); // kayıtlı ayarlar yüklendi mi
  const [adres, setAdres] = useState('192.168.0.3:8000');
  const [sure, setSure] = useState(10);
  const [hedefFps, setHedefFps] = useState(120);
  const [geriSayim, setGeriSayim] = useState(3);
  const [kameraId, setKameraId] = useState(null);

  const [mesgul, setMesgul] = useState(false);
  const [sayac, setSayac] = useState(0);
  const [kalan, setKalan] = useState(0);
  const [ilerleme, setIlerleme] = useState(null);
  const [durum, setDurum] = useState({ metin: '', tur: '' });
  const [ayarAcik, setAyarAcik] = useState(false);
  const [adresTaslak, setAdresTaslak] = useState('');
  const [baglanti, setBaglanti] = useState('araniyor'); // araniyor | bagli | yok
  const adresRef = useRef(adres);
  adresRef.current = adres;

  // Kayıtlı ayarları yükle
  useEffect(() => {
    (async () => {
      try {
        if (!AsyncStorage) throw new Error('ayar deposu yok');
        const k = await zamanAsimi(AsyncStorage.multiGet(['adres', 'sure', 'fps', 'geri', 'kamera']), 2500);
        const v = Object.fromEntries(k);
        if (v.adres) setAdres(v.adres);
        if (v.sure) setSure(+v.sure);
        if (v.fps) setHedefFps(+v.fps);
        if (v.geri) setGeriSayim(+v.geri);
        if (v.kamera) setKameraId(v.kamera);
      } catch (e) {}
      setHazir(true);
    })();
  }, []);
  const kaydet = (anahtar, deger) => {
    try { AsyncStorage?.setItem(anahtar, String(deger)).catch(() => {}); } catch (e) {}
  };

  // Laptopu bul: önce kayıtlı adres, olmazsa ağı tara. Bulunan adresi kaydeder.
  async function otomatikBaglan() {
    setBaglanti('araniyor');
    const simdiki = adresRef.current;
    if (await laptopMu(simdiki, 1500)) { setBaglanti('bagli'); return simdiki; }
    const bulunan = await laptopBul(simdiki);
    if (bulunan) {
      setAdres(bulunan);
      adresRef.current = bulunan;
      kaydet('adres', bulunan);
      setBaglanti('bagli');
      return bulunan;
    }
    setBaglanti('yok');
    return null;
  }
  useEffect(() => { if (hazir) otomatikBaglan(); }, [hazir]);

  // Seçilebilir lensler: önce geniş açı, sonra normal, yakın, ön
  const lensler = useMemo(() => {
    const sira = { 'Geniş 0.5x': 0, 'Normal 1x': 1, 'Yakın': 2, 'Ön': 3 };
    const liste = tumKameralar.filter((d) => lensAdi(d));
    const secilebilir = liste.length ? liste : tumKameralar; // eski telefonlarda yedek
    return [...secilebilir].sort((a, b) => (sira[lensAdi(a)] ?? 9) - (sira[lensAdi(b)] ?? 9));
  }, [tumKameralar]);

  const cihaz = lensler.find((d) => d.id === kameraId) || lensler[0];
  const format = VC.useCameraFormat(cihaz, [{ fps: hedefFps }, { videoResolution: { width: 1920, height: 1080 } }]);
  const gercekFps = Math.max(1, Math.min(hedefFps, format?.maxFps ?? 30));

  function lensDegistir() {
    if (mesgul || lensler.length < 2) return;
    const i = lensler.findIndex((d) => d.id === cihaz?.id);
    const yeni = lensler[(i + 1) % lensler.length];
    setKameraId(yeni.id);
    kaydet('kamera', yeni.id);
  }

  async function cek() {
    if (mesgul || !kamera.current) return;
    setMesgul(true);
    setIlerleme(null);
    setDurum({ metin: '', tur: '' });
    try {
      for (let i = geriSayim; i > 0; i--) {
        setSayac(i);
        await bekle(1000);
      }
      setSayac(0);

      const bitti = new Promise((resolve, reject) => {
        kamera.current.startRecording({
          fileType: 'mp4',
          onRecordingFinished: resolve,
          onRecordingError: reject,
        });
      });
      for (let k = sure; k > 0; k--) {
        setKalan(k);
        await bekle(1000);
      }
      setKalan(0);
      await kamera.current.stopRecording();
      const video = await bitti;
      await gonder(video.path);
    } catch (e) {
      setSayac(0);
      setKalan(0);
      setDurum({ metin: 'Kayıt yapılamadı: ' + (e?.message || e), tur: 'err' });
    }
    setMesgul(false);
  }

  async function gonder(yol) {
    setDurum({ metin: 'Laptopa gönderiliyor…', tur: '' });
    setIlerleme(0);
    const uri = yol.startsWith('file://') ? yol : 'file://' + yol;
    let blob;
    try {
      blob = await (await fetch(uri)).blob();
    } catch (e) {
      setDurum({ metin: 'Video dosyası okunamadı.', tur: 'err' });
      return;
    }
    let sonuc = await yukle(blob, adresRef.current);
    if (sonuc.tur === 'ag') {
      // Bağlantı koptu: laptopu yeniden ara ve bir kez daha dene
      setDurum({ metin: 'Laptop aranıyor…', tur: '' });
      const yeni = await otomatikBaglan();
      if (yeni) {
        setDurum({ metin: 'Laptopa gönderiliyor…', tur: '' });
        sonuc = await yukle(blob, yeni);
      }
    }
    if (sonuc.tur === 'ok') {
      setIlerleme(1);
      setBaglanti('bagli');
      setDurum({ metin: 'Gönderildi, kioskta oynuyor.', tur: 'ok' });
    } else if (sonuc.tur === 'sunucu') {
      setDurum({ metin: 'Gönderilemedi: ' + sonuc.mesaj, tur: 'err' });
    } else {
      setBaglanti('yok');
      setDurum({ metin: 'Laptop bulunamadı. Program açık mı, telefon ve laptop aynı ağda mı?', tur: 'err' });
    }
  }

  function yukle(blob, hedef) {
    return new Promise((resolve) => {
      const xhr = new XMLHttpRequest();
      xhr.open('POST', `http://${hedef}/api/yukle`);
      xhr.setRequestHeader('Content-Type', 'video/mp4');
      xhr.setRequestHeader('X-FPS', String(gercekFps)); // ağır çekim adımı için
      xhr.timeout = 120000;
      xhr.upload.onprogress = (e) => {
        if (e.lengthComputable) setIlerleme(e.loaded / e.total);
      };
      xhr.onload = () => resolve(xhr.status === 200 ? { tur: 'ok' } : { tur: 'sunucu', mesaj: xhr.responseText });
      xhr.onerror = () => resolve({ tur: 'ag' });
      xhr.ontimeout = () => resolve({ tur: 'ag' });
      xhr.send(blob);
    });
  }

  const baglantiTest = (deneAdres) => laptopMu(deneAdres, 4000);

  // ---------- Ekranlar ----------
  if (!hazir) {
    return (
      <View style={[s.tam, s.orta]}>
        <StatusBar barStyle="light-content" />
        <Text style={s.aciklama}>Yükleniyor…</Text>
      </View>
    );
  }

  if (!hasPermission) {
    return (
      <View style={[s.tam, s.orta]}>
        <StatusBar barStyle="light-content" />
        <Text style={s.aciklama}>Çekim yapabilmek için kamera izni gerekiyor.</Text>
        <Pressable style={s.anaButon} onPress={async () => { const ok = await requestPermission(); if (!ok) Linking.openSettings(); }}>
          <Text style={s.anaButonYazi}>Kamera İzni Ver</Text>
        </Pressable>
      </View>
    );
  }

  if (!cihaz) {
    return (
      <View style={[s.tam, s.orta]}>
        <StatusBar barStyle="light-content" />
        <Text style={s.aciklama}>Kamera aranıyor… Bu yazı birkaç saniyeden uzun kalırsa uygulamayı kapatıp yeniden aç.</Text>
      </View>
    );
  }

  return (
    <View style={s.tam}>
      <StatusBar hidden />
      <VC.Camera
        ref={kamera}
        style={StyleSheet.absoluteFill}
        device={cihaz}
        format={format}
        fps={gercekFps}
        isActive={!ayarAcik}
        video={true}
        audio={false}
        resizeMode="contain"
      />

      {/* Üst bilgi */}
      <View style={s.ust}>
        <View style={s.chip}><Text style={s.chipYazi}>{(lensAdi(cihaz) || 'Kamera')} · {gercekFps} kare/sn</Text></View>
        {kalan > 0 && (
          <View style={[s.chip, s.kayitChip]}><View style={s.nokta} /><Text style={s.chipYazi}>{kalan} sn</Text></View>
        )}
        <Pressable style={s.chip} onPress={() => { setAdresTaslak(adres); setAyarAcik(true); }} disabled={mesgul}>
          <Text style={s.chipYazi}>Ayarlar</Text>
        </Pressable>
      </View>

      {/* Laptop bağlantı durumu */}
      <View style={s.baglantiSatir}>
        <Pressable
          style={[s.chip, s.kayitChip]}
          disabled={mesgul || baglanti === 'araniyor'}
          onPress={otomatikBaglan}
        >
          <View style={[s.nokta, { backgroundColor: baglanti === 'bagli' ? RENK.ok : baglanti === 'yok' ? RENK.err : RENK.accent }]} />
          <Text style={s.chipYazi}>
            {baglanti === 'bagli' ? 'Laptop bağlı' : baglanti === 'yok' ? 'Laptop bulunamadı · Tekrar dene' : 'Laptop aranıyor…'}
          </Text>
        </Pressable>
      </View>

      {sayac > 0 && <View style={s.geriKutu} pointerEvents="none"><Text style={s.geriYazi}>{sayac}</Text></View>}

      {/* Alt kontroller */}
      <View style={s.alt}>
        <View style={s.satir}>
          {SURELER.map((n) => (
            <Pressable key={n} disabled={mesgul} onPress={() => { setSure(n); kaydet('sure', n); }} style={[s.secim, sure === n && s.secimAktif]}>
              <Text style={[s.secimYazi, sure === n && s.secimYaziAktif]}>{n} sn</Text>
            </Pressable>
          ))}
        </View>
        <View style={s.satir}>
          {FPSLER.map((n) => (
            <Pressable key={n} disabled={mesgul} onPress={() => { setHedefFps(n); kaydet('fps', n); }} style={[s.secim, hedefFps === n && s.secimAktif]}>
              <Text style={[s.secimYazi, hedefFps === n && s.secimYaziAktif]}>{n} fps</Text>
            </Pressable>
          ))}
        </View>
        <View style={s.butonSatir}>
          <Pressable style={s.kucuk} disabled={mesgul} onPress={() => { const i = GERI_SAYIMLAR.indexOf(geriSayim); const y = GERI_SAYIMLAR[(i + 1) % GERI_SAYIMLAR.length]; setGeriSayim(y); kaydet('geri', y); }}>
            <Text style={s.kucukYazi}>{geriSayim ? `${geriSayim} sn` : 'Yok'}</Text>
          </Pressable>
          <Pressable style={[s.kayit, mesgul && { opacity: 0.5 }]} onPress={cek} disabled={mesgul} accessibilityLabel="Kaydı başlat" />
          <Pressable style={s.kucuk} disabled={mesgul} onPress={lensDegistir}>
            <Text style={s.kucukYazi}>Lens</Text>
          </Pressable>
        </View>
        {ilerleme !== null && (
          <View style={s.bar}><View style={[s.barDolu, { width: `${Math.round(ilerleme * 100)}%` }]} /></View>
        )}
        {!!durum.metin && <Text style={[s.durum, durum.tur === 'ok' && { color: RENK.ok }, durum.tur === 'err' && { color: RENK.err }]}>{durum.metin}</Text>}
        {gercekFps < hedefFps && !mesgul && (
          <Text style={s.not}>Bu lens en fazla {gercekFps} kare/sn destekliyor.</Text>
        )}
      </View>

      {/* Ayarlar */}
      <AyarEkrani
        acik={ayarAcik}
        taslak={adresTaslak}
        setTaslak={setAdresTaslak}
        kapat={() => setAyarAcik(false)}
        kaydetAdres={(a) => { setAdres(a); adresRef.current = a; kaydet('adres', a); setAyarAcik(false); otomatikBaglan(); }}
        test={baglantiTest}
        bul={() => laptopBul(adresRef.current)}
      />
    </View>
  );
}

function AyarEkrani({ acik, taslak, setTaslak, kapat, kaydetAdres, test, bul }) {
  const [sonuc, setSonuc] = useState('');
  const temiz = (a) => a.trim().replace(/^https?:\/\//, '').replace(/\/+$/, '');
  return (
    <Modal visible={acik} animationType="slide" transparent onRequestClose={kapat}>
      <View style={s.modalArka}>
        <View style={s.modal}>
          <Text style={s.modalBaslik}>Laptop adresi</Text>
          <Text style={s.aciklama}>Uygulama laptopu genelde kendisi bulur. Bulamazsa "Otomatik bul"a bas ya da laptoptaki siyah pencerede yazan "Kiosk ekranı" adresini, başındaki http:// olmadan yaz.</Text>
          <Pressable
            style={s.anaButon}
            onPress={async () => {
              setSonuc('Laptop aranıyor…');
              const a = await bul();
              if (a) { setTaslak(a); setSonuc('Bağlantı tamam: ' + a); } else setSonuc('Laptop bulunamadı. Program açık mı, aynı ağda mısınız?');
            }}
          >
            <Text style={s.anaButonYazi}>Otomatik bul</Text>
          </Pressable>
          <TextInput
            value={taslak}
            onChangeText={(t) => { setTaslak(t); setSonuc(''); }}
            placeholder="192.168.0.3:8000"
            placeholderTextColor={RENK.muted}
            autoCapitalize="none"
            autoCorrect={false}
            keyboardType="numbers-and-punctuation"
            style={s.girdi}
          />
          {!!sonuc && <Text style={[s.durum, { color: sonuc.startsWith('Bağlantı') ? RENK.ok : sonuc.endsWith('…') ? RENK.muted : RENK.err }]}>{sonuc}</Text>}
          <View style={s.modalButonlar}>
            <Pressable style={s.ikincilButon} onPress={async () => { setSonuc('Deneniyor…'); setSonuc((await test(temiz(taslak))) ? 'Bağlantı tamam.' : 'Laptopa ulaşılamadı.'); }}>
              <Text style={s.ikincilYazi}>Bağlantıyı dene</Text>
            </Pressable>
            <Pressable style={s.anaButon} onPress={() => kaydetAdres(temiz(taslak))}>
              <Text style={s.anaButonYazi}>Kaydet</Text>
            </Pressable>
          </View>
          <Pressable onPress={kapat}><Text style={[s.aciklama, { marginTop: 8 }]}>Vazgeç</Text></Pressable>
        </View>
      </View>
    </Modal>
  );
}

const s = StyleSheet.create({
  tam: { flex: 1, backgroundColor: RENK.bg },
  orta: { alignItems: 'center', justifyContent: 'center', padding: 24, gap: 16 },
  baglantiSatir: { position: 'absolute', top: 100, left: 16, right: 16, flexDirection: 'row', justifyContent: 'center' },
  ust: { position: 'absolute', top: 54, left: 16, right: 16, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: 8 },
  chip: { backgroundColor: RENK.panel, borderColor: RENK.line, borderWidth: 1, borderRadius: 999, paddingVertical: 8, paddingHorizontal: 14 },
  chipYazi: { color: RENK.fg, fontSize: 14, fontWeight: '600' },
  kayitChip: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  nokta: { width: 10, height: 10, borderRadius: 5, backgroundColor: RENK.rec },
  geriKutu: { ...StyleSheet.absoluteFillObject, alignItems: 'center', justifyContent: 'center' },
  geriYazi: { color: RENK.fg, fontSize: 160, fontWeight: '800', textShadowColor: 'rgba(0,0,0,0.6)', textShadowRadius: 20 },
  alt: { position: 'absolute', left: 0, right: 0, bottom: 0, paddingHorizontal: 16, paddingBottom: 40, paddingTop: 16, alignItems: 'center', gap: 12, backgroundColor: 'rgba(0,0,0,0.35)' },
  satir: { flexDirection: 'row', gap: 8, flexWrap: 'wrap', justifyContent: 'center' },
  secim: { backgroundColor: RENK.panel, borderColor: RENK.line, borderWidth: 1, borderRadius: 999, paddingVertical: 7, paddingHorizontal: 12 },
  secimAktif: { backgroundColor: RENK.accent, borderColor: RENK.accent },
  secimYazi: { color: RENK.muted, fontSize: 14, fontWeight: '600' },
  secimYaziAktif: { color: RENK.ink },
  butonSatir: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 28 },
  kayit: { width: 84, height: 84, borderRadius: 42, borderWidth: 5, borderColor: RENK.fg, backgroundColor: RENK.rec },
  kucuk: { width: 56, height: 56, borderRadius: 28, backgroundColor: RENK.panel, borderColor: RENK.line, borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
  kucukYazi: { color: RENK.fg, fontSize: 13, fontWeight: '600' },
  bar: { width: '80%', height: 8, borderRadius: 999, backgroundColor: RENK.panel, overflow: 'hidden' },
  barDolu: { height: '100%', backgroundColor: RENK.accent },
  durum: { color: RENK.fg, fontSize: 15, textAlign: 'center' },
  not: { color: RENK.muted, fontSize: 13, textAlign: 'center' },
  aciklama: { color: RENK.muted, fontSize: 15, textAlign: 'center', lineHeight: 21 },
  anaButon: { backgroundColor: RENK.accent, borderRadius: 14, paddingVertical: 14, paddingHorizontal: 22, alignItems: 'center' },
  anaButonYazi: { color: RENK.ink, fontSize: 17, fontWeight: '700' },
  ikincilButon: { borderColor: RENK.line, borderWidth: 1, borderRadius: 14, paddingVertical: 14, paddingHorizontal: 18, alignItems: 'center' },
  ikincilYazi: { color: RENK.fg, fontSize: 16, fontWeight: '600' },
  modalArka: { flex: 1, backgroundColor: 'rgba(0,0,0,0.6)', justifyContent: 'flex-end' },
  modal: { backgroundColor: '#1f1a2b', borderTopLeftRadius: 20, borderTopRightRadius: 20, padding: 24, paddingBottom: 44, gap: 14 },
  modalBaslik: { color: RENK.fg, fontSize: 20, fontWeight: '700', textAlign: 'center' },
  girdi: { backgroundColor: '#14101c', color: RENK.fg, borderColor: RENK.line, borderWidth: 1, borderRadius: 12, padding: 14, fontSize: 18 },
  modalButonlar: { flexDirection: 'row', gap: 12, justifyContent: 'center' },
});
