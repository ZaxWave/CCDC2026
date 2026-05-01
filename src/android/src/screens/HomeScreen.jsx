import { View, Text, TouchableOpacity, StyleSheet, ScrollView } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import AsyncStorage from '@react-native-async-storage/async-storage'
import BrandWordmark from '../components/BrandWordmark'

export default function HomeScreen({ navigation }) {
  const goToCitizen = async () => {
    const token = await AsyncStorage.getItem('token')
    navigation.navigate(token ? 'Report' : 'Login', token ? undefined : { redirect: 'Report' })
  }

  const goToWorker = async () => {
    const token = await AsyncStorage.getItem('token')
    if (token === 'mock_token_123') {
      await AsyncStorage.multiRemove(['token', 'token_type', 'user'])
      navigation.navigate('Login')
      return
    }
    navigation.navigate(token ? 'WorkerHub' : 'Login', token ? undefined : { redirect: 'WorkerHub' })
  }

  return (
    <SafeAreaView style={s.page}>
      <ScrollView contentContainerStyle={s.body} showsVerticalScrollIndicator={false}>
        <View style={s.topBar}>
          <BrandWordmark size={25} />
          <Text style={s.version}>现场端</Text>
        </View>

        <View style={s.hero}>
          <Text style={s.heroKicker}>轻巡智维</Text>
          <Text style={s.heroTitle}>巡检数据采集</Text>
          <Text style={s.heroText}>拍照、距离采样、定位和工单处理都从这里进入。</Text>
        </View>

        <View style={s.modePanel}>
          <Text style={s.panelTitle}>工作模式</Text>

          <TouchableOpacity style={s.modeCard} onPress={goToCitizen} activeOpacity={0.76}>
            <View style={s.modeNum}>
              <Text style={s.modeNumText}>01</Text>
            </View>
            <View style={s.modeBody}>
              <View style={s.modeTop}>
                <Text style={s.modeTitle}>市民上报</Text>
                <Text style={s.modeTag}>公众</Text>
              </View>
              <Text style={s.modeDesc}>拍摄现场照片，提交给平台审核。</Text>
            </View>
            <Text style={s.arrow}>›</Text>
          </TouchableOpacity>

          <View style={s.divider} />

          <TouchableOpacity style={[s.modeCard, s.modeCardPrimary]} onPress={goToWorker} activeOpacity={0.76}>
            <View style={[s.modeNum, s.modeNumPrimary]}>
              <Text style={s.modeNumText}>02</Text>
            </View>
            <View style={s.modeBody}>
              <View style={s.modeTop}>
                <Text style={s.modeTitle}>巡检员工作台</Text>
                <Text style={[s.modeTag, s.modeTagPrimary]}>专业</Text>
              </View>
              <Text style={s.modeDesc}>检测上传、距离采样、养护工单。</Text>
            </View>
            <Text style={s.arrow}>›</Text>
          </TouchableOpacity>
        </View>

        <View style={s.statusRow}>
          <Text style={s.statusText}>采集</Text>
          <View style={s.statusDot} />
          <Text style={s.statusText}>聚合</Text>
          <View style={s.statusDot} />
          <Text style={s.statusText}>处置</Text>
        </View>
      </ScrollView>
    </SafeAreaView>
  )
}

const s = StyleSheet.create({
  page: { flex: 1, backgroundColor: '#111111' },
  body: { flexGrow: 1, paddingHorizontal: 24, paddingTop: 18, paddingBottom: 34, justifyContent: 'center' },
  topBar: { position: 'absolute', top: 18, left: 24, right: 24, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  version: { color: 'rgba(255,255,255,0.34)', fontSize: 12, fontWeight: '500' },
  hero: { marginTop: 58, marginBottom: 34, gap: 9 },
  heroKicker: { color: '#3e6ae1', fontSize: 13, fontWeight: '500', letterSpacing: 0 },
  heroTitle: { color: '#ffffff', fontSize: 34, fontWeight: '600', letterSpacing: 0, lineHeight: 42 },
  heroText: { color: 'rgba(255,255,255,0.5)', fontSize: 14, lineHeight: 22, maxWidth: 310 },
  modePanel: {
    borderRadius: 14,
    backgroundColor: 'rgba(255,255,255,0.045)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.09)',
    overflow: 'hidden',
  },
  panelTitle: { color: 'rgba(255,255,255,0.48)', fontSize: 12, fontWeight: '500', letterSpacing: 0, paddingHorizontal: 18, paddingTop: 18, paddingBottom: 4 },
  modeCard: { flexDirection: 'row', alignItems: 'center', padding: 18, gap: 13, minHeight: 94 },
  modeCardPrimary: { backgroundColor: 'rgba(62,106,225,0.08)' },
  modeNum: {
    width: 42,
    height: 42,
    borderRadius: 10,
    backgroundColor: 'rgba(255,255,255,0.08)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  modeNumPrimary: { backgroundColor: '#3e6ae1' },
  modeNumText: { color: '#ffffff', fontSize: 13, fontWeight: '600' },
  modeBody: { flex: 1, gap: 5 },
  modeTop: { flexDirection: 'row', alignItems: 'center', gap: 8, flexWrap: 'wrap' },
  modeTitle: { color: '#ffffff', fontSize: 18, fontWeight: '600' },
  modeTag: {
    color: 'rgba(255,255,255,0.6)',
    fontSize: 11,
    fontWeight: '500',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 5,
    backgroundColor: 'rgba(255,255,255,0.08)',
  },
  modeTagPrimary: { color: '#8fb0ff', backgroundColor: 'rgba(62,106,225,0.16)' },
  modeDesc: { color: 'rgba(255,255,255,0.42)', fontSize: 13, lineHeight: 19 },
  arrow: { color: 'rgba(255,255,255,0.28)', fontSize: 30, lineHeight: 32 },
  divider: { height: 1, backgroundColor: 'rgba(255,255,255,0.07)', marginHorizontal: 18 },
  statusRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 9, marginTop: 26 },
  statusText: { color: 'rgba(255,255,255,0.32)', fontSize: 12, fontWeight: '500' },
  statusDot: { width: 3, height: 3, borderRadius: 2, backgroundColor: 'rgba(255,255,255,0.24)' },
})
