// Tanı sürümü: uygulamanın hangi parçasının sorun çıkardığını ekrana yazar.
// Normal uygulama yerine sadece "tani" seçeneğiyle derlenince kullanılır.
import { useEffect, useState } from 'react';
import { ScrollView, StatusBar, Text, View } from 'react-native';

const bekle = (ms) => new Promise((r) => setTimeout(r, ms));

export default function Tani() {
  const [satirlar, setSatirlar] = useState(['1) JavaScript çalışıyor: TAMAM']);
  const ekle = (s) => setSatirlar((x) => [...x, s]);

  useEffect(() => {
    (async () => {
      await bekle(400);
      try { require('expo-keep-awake'); ekle('2) expo-keep-awake: TAMAM'); } catch (e) { ekle('2) expo-keep-awake: HATA ' + e.message); }
      await bekle(300);
      try { require('@react-native-async-storage/async-storage'); ekle('3) async-storage: TAMAM'); } catch (e) { ekle('3) async-storage: HATA ' + e.message); }
      await bekle(300);
      try { require('expo-network'); ekle('4) expo-network: TAMAM'); } catch (e) { ekle('4) expo-network: HATA ' + e.message); }
      await bekle(300);
      let VC = null;
      try { VC = require('react-native-vision-camera'); ekle('5) vision-camera yükleme: TAMAM'); } catch (e) { ekle('5) vision-camera yükleme: HATA ' + e.message); }
      await bekle(300);
      if (VC) {
        try { ekle('6) kamera izni: ' + VC.Camera.getCameraPermissionStatus()); } catch (e) { ekle('6) kamera izni: HATA ' + e.message); }
        try {
          const d = VC.Camera.getAvailableCameraDevices();
          ekle('7) kamera sayısı: ' + d.length + ' (' + d.map((x) => (x.physicalDevices || []).join('+') || x.position).join(', ') + ')');
        } catch (e) { ekle('7) kamera listesi: HATA ' + e.message); }
      }
      ekle('Test bitti.');
    })();
  }, []);

  return (
    <View style={{ flex: 1, backgroundColor: '#14101c', paddingTop: 70, paddingHorizontal: 20 }}>
      <StatusBar barStyle="light-content" />
      <Text style={{ color: '#e6c48a', fontSize: 22, fontWeight: '700', marginBottom: 16 }}>360 Çekim – Tanı</Text>
      <ScrollView>
        {satirlar.map((s, i) => (
          <Text key={i} style={{ color: s.includes('HATA') ? '#f0938a' : '#f4eee6', fontSize: 16, marginBottom: 10 }} selectable>{s}</Text>
        ))}
      </ScrollView>
    </View>
  );
}
