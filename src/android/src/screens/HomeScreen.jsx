import { View, Text, TouchableOpacity, StyleSheet, ScrollView } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import AsyncStorage from '@react-native-async-storage/async-storage'
import BrandWordmark from '../components/BrandWordmark'
import { useThemedStyles } from '../theme'

async function getValidToken() {
  const token = await AsyncStorage.getItem('token')
  if (!token) return ''
  const isJwtLike = token.split('.').length === 3
  if (!isJwtLike) {
    await AsyncStorage.multiRemove(['token', 'token_type', 'user'])
    return ''
  }
  return token
}

export default function HomeScreen({ navigation }) {
  const s = useThemedStyles(createStyles)

  const goToCitizen = () => {
    navigation.navigate('Report')
  }

  const goToWorker = async () => {
    const token = await getValidToken()
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
              <Text style={[s.modeNumText, s.modeNumTextPrimary]}>02</Text>
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

const createStyles = (t) => StyleSheet.create({
  page: { flex: 1, backgroundColor: t.bg },
  body: { flexGrow: 1, paddingHorizontal: 24, paddingTop: 18, paddingBottom: 34, justifyContent: 'center' },
  topBar: { position: 'absolute', top: 18, left: 24, right: 24, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  version: { color: t.textFaint, fontSize: 12, fontWeight: '500' },
  hero: { marginTop: 58, marginBottom: 34, gap: 9 },
  heroKicker: { color: t.blue, fontSize: 13, fontWeight: '500', letterSpacing: 0 },
  heroTitle: { color: t.text, fontSize: 34, fontWeight: '500', letterSpacing: 0, lineHeight: 42 },
  heroText: { color: t.textMuted, fontSize: 14, lineHeight: 22, maxWidth: 310 },
  modePanel: {
    borderRadius: 12,
    backgroundColor: t.panel,
    borderWidth: 1,
    borderColor: t.border,
    overflow: 'hidden',
  },
  panelTitle: { color: t.textMuted, fontSize: 12, fontWeight: '500', letterSpacing: 0, paddingHorizontal: 18, paddingTop: 18, paddingBottom: 4 },
  modeCard: { flexDirection: 'row', alignItems: 'center', padding: 18, gap: 13, minHeight: 94 },
  modeCardPrimary: { backgroundColor: t.blueSoft },
  modeNum: {
    width: 42,
    height: 42,
    borderRadius: 4,
    backgroundColor: t.surfaceStrong,
    alignItems: 'center',
    justifyContent: 'center',
  },
  modeNumPrimary: { backgroundColor: t.blue },
  modeNumText: { color: t.textSoft, fontSize: 13, fontWeight: '500' },
  modeNumTextPrimary: { color: '#ffffff' },
  modeBody: { flex: 1, gap: 5 },
  modeTop: { flexDirection: 'row', alignItems: 'center', gap: 8, flexWrap: 'wrap' },
  modeTitle: { color: t.text, fontSize: 18, fontWeight: '500' },
  modeTag: {
    color: t.textMuted,
    fontSize: 11,
    fontWeight: '500',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 4,
    backgroundColor: t.surfaceStrong,
  },
  modeTagPrimary: { color: t.blueText, backgroundColor: t.blueSoft },
  modeDesc: { color: t.textFaint, fontSize: 13, lineHeight: 19 },
  arrow: { color: t.textFaint, fontSize: 30, lineHeight: 32 },
  divider: { height: 1, backgroundColor: t.border, marginHorizontal: 18 },
  statusRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 9, marginTop: 26 },
  statusText: { color: t.textFaint, fontSize: 12, fontWeight: '500' },
  statusDot: { width: 3, height: 3, borderRadius: 2, backgroundColor: t.borderStrong },
})
