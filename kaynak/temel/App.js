// En basit test uygulaması: ek parça yok, sadece yazı.
import { Text, View } from 'react-native';

export default function App() {
  return (
    <View style={{ flex: 1, backgroundColor: '#3c2a5e', alignItems: 'center', justifyContent: 'center', padding: 24 }}>
      <Text style={{ color: '#ffffff', fontSize: 26, fontWeight: '700', textAlign: 'center' }}>360 Temel test</Text>
      <Text style={{ color: '#e6c48a', fontSize: 18, marginTop: 12, textAlign: 'center' }}>JavaScript çalışıyor</Text>
    </View>
  );
}
