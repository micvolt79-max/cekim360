// Uygulamanın giriş noktası.
// Her şeyden önce bir hata yakalayıcı kurar: açılışta bir hata olursa uygulama kapanmak yerine
// hatanın tam metnini ekranda gösterir. Expo'nun açılış adımlarını atlayıp doğrudan React Native'e kayıt olur.

let baslangicHatasi = null;
const dinleyiciler = new Set();
function hataKaydet(e) {
  if (!baslangicHatasi) baslangicHatasi = e;
  dinleyiciler.forEach((f) => f(baslangicHatasi));
}
if (global.ErrorUtils && global.ErrorUtils.setGlobalHandler) {
  global.ErrorUtils.setGlobalHandler((e) => hataKaydet(e)); // varsayılan işleyici çağrılmaz: uygulama kapanmaz
}

const React = require('react');
const RN = require('react-native');

let Uygulama = null;
try {
  Uygulama = require('./App').default;
} catch (e) {
  hataKaydet(e);
}

function HataEkrani({ hata }) {
  const metin = String((hata && (hata.message || hata)) || 'Bilinmeyen hata');
  const yigin = String((hata && hata.stack) || '').slice(0, 4000);
  return React.createElement(
    RN.ScrollView,
    { style: { flex: 1, backgroundColor: '#14101c' }, contentContainerStyle: { padding: 22, paddingTop: 80 } },
    React.createElement(RN.Text, { style: { color: '#f0938a', fontSize: 20, fontWeight: '700' } }, 'Açılış hatası'),
    React.createElement(RN.Text, { style: { color: '#a99fb5', fontSize: 14, marginTop: 8 } }, 'Bu ekranın görüntüsünü al ve gönder.'),
    React.createElement(RN.Text, { selectable: true, style: { color: '#ffffff', fontSize: 15, marginTop: 16 } }, metin),
    React.createElement(RN.Text, { selectable: true, style: { color: '#d8d0e2', fontSize: 12, marginTop: 14 } }, yigin)
  );
}

function Kok() {
  const [hata, setHata] = React.useState(baslangicHatasi);
  React.useEffect(() => {
    dinleyiciler.add(setHata);
    return () => dinleyiciler.delete(setHata);
  }, []);
  if (hata || !Uygulama) return React.createElement(HataEkrani, { hata: hata || new Error('Uygulama dosyası yüklenemedi') });
  return React.createElement(Uygulama);
}

RN.AppRegistry.registerComponent('main', () => Kok);
