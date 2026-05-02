import { View, Text, TouchableOpacity, Alert, StyleSheet, ScrollView } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import AsyncStorage from '@react-native-async-storage/async-storage'
import BrandWordmark from '../../components/BrandWordmark'
import { useNetwork } from '../../context/NetworkContext'
import { useThemedStyles } from '../../theme'

export default function HubScreen({ navigation }) {
  const s = useThemedStyles(createStyles)
  const { isOnline, queueCount } = useNetwork()

  const logout = () => {
    Alert.alert('退出登录', '确认退出专业版？', [
      { text: '取消', style: 'cancel' },
      {
        text: '退出',
        onPress: async () => {
          await AsyncStorage.multiRemove(['token', 'token_type', 'user'])
          navigation.replace('Home')
        },
      },
    ])
  }

  return (
    <SafeAreaView style={s.page}>
      <ScrollView contentContainerStyle={s.body} showsVerticalScrollIndicator={false}>
        <View style={s.header}>
          <BrandWordmark size={28} muted />
          <TouchableOpacity style={s.logoutBtn} onPress={logout} activeOpacity={0.7}>
            <Text style={s.logoutText}>退出</Text>
          </TouchableOpacity>
        </View>

        <View style={s.hero}>
          <View style={s.heroTop}>
            <Text style={s.heroTitle}>巡检工作台</Text>
            <View style={[s.netBadge, isOnline ? s.netOn : s.netOff]}>
              <View style={[s.netDot, isOnline ? s.netDotOn : s.netDotOff]} />
              <Text style={s.netText}>{isOnline ? '在线' : '离线'}</Text>
            </View>
          </View>
          <Text style={s.heroText}>采集、同步和处置现场任务。连续路段使用距离采样，避免上传大体积视频。</Text>
          {queueCount > 0 && (
            <Text style={s.queueText}>有 {queueCount} 个离线任务等待同步</Text>
          )}
        </View>

        <View style={s.section}>
          <Text style={s.sectionTitle}>采集</Text>
          <TouchableOpacity
            style={[s.actionCard, s.primaryCard]}
            onPress={() => navigation.navigate('Report', { source: 'worker' })}
            activeOpacity={0.75}
          >
            <View style={[s.iconBox, s.iconBlue]}>
              <Text style={s.iconText}>01</Text>
            </View>
            <View style={s.cardBody}>
              <Text style={s.cardTitle}>拍照巡检</Text>
              <Text style={s.cardDesc}>适合同一病害多角度取证，自动写入时间和位置。</Text>
            </View>
            <Text style={s.cardArrow}>›</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={s.actionCard}
            onPress={() => navigation.navigate('Record')}
            activeOpacity={0.75}
          >
            <View style={[s.iconBox, s.iconRed]}>
              <Text style={s.iconText}>02</Text>
            </View>
            <View style={s.cardBody}>
              <Text style={s.cardTitle}>距离采样</Text>
              <Text style={s.cardDesc}>横屏采样，可自定义距离间隔并自动抓拍。</Text>
            </View>
            <Text style={s.cardArrow}>›</Text>
          </TouchableOpacity>
        </View>

        <View style={s.section}>
          <Text style={s.sectionTitle}>处置</Text>
          <TouchableOpacity style={s.actionCard} onPress={() => navigation.navigate('Issues')} activeOpacity={0.75}>
            <View style={[s.iconBox, s.iconGray]}>
              <Text style={s.iconText}>03</Text>
            </View>
            <View style={s.cardBody}>
              <Text style={s.cardTitle}>养护工单</Text>
              <Text style={s.cardDesc}>查看已派发问题，接单、处理并完成闭环。</Text>
            </View>
            <Text style={s.cardArrow}>›</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </SafeAreaView>
  )
}

const createStyles = (t) => StyleSheet.create({
  page: { flex: 1, backgroundColor: t.bg },
  body: { padding: 22, paddingBottom: 44, gap: 22 },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  logoutBtn: {
    borderWidth: 1,
    borderColor: t.borderStrong,
    borderRadius: 4,
    paddingHorizontal: 14,
    paddingVertical: 8,
  },
  logoutText: { color: t.textMuted, fontSize: 13, fontWeight: '500' },
  hero: {
    borderRadius: 12,
    backgroundColor: t.panel,
    borderWidth: 1,
    borderColor: t.border,
    padding: 18,
    gap: 10,
  },
  heroTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: 12 },
  heroTitle: { color: t.text, fontSize: 22, fontWeight: '500' },
  heroText: { color: t.textMuted, fontSize: 13, lineHeight: 20 },
  queueText: { color: t.blueText, fontSize: 12, lineHeight: 18 },
  netBadge: { flexDirection: 'row', alignItems: 'center', gap: 6, borderRadius: 4, paddingHorizontal: 9, paddingVertical: 5, borderWidth: 1 },
  netOn: { backgroundColor: 'rgba(34,197,94,0.08)', borderColor: 'rgba(34,197,94,0.24)' },
  netOff: { backgroundColor: 'rgba(239,68,68,0.08)', borderColor: 'rgba(239,68,68,0.24)' },
  netDot: { width: 6, height: 6, borderRadius: 3 },
  netDotOn: { backgroundColor: '#22c55e' },
  netDotOff: { backgroundColor: '#ef4444' },
  netText: { color: t.textSoft, fontSize: 12, fontWeight: '500' },
  section: { gap: 12 },
  sectionTitle: { color: t.textMuted, fontSize: 13, fontWeight: '500', letterSpacing: 0 },
  actionCard: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 12,
    padding: 16,
    gap: 14,
    backgroundColor: t.panel,
    borderWidth: 1,
    borderColor: t.border,
  },
  primaryCard: { backgroundColor: t.panelStrong, borderColor: 'rgba(62,106,225,0.42)' },
  iconBox: {
    width: 42,
    height: 42,
    borderRadius: 4,
    alignItems: 'center',
    justifyContent: 'center',
  },
  iconBlue: { backgroundColor: t.blue },
  iconRed: { backgroundColor: '#b91c1c' },
  iconGray: { backgroundColor: t.surfaceStrong },
  iconText: { color: '#ffffff', fontSize: 13, fontWeight: '500' },
  cardBody: { flex: 1, gap: 5 },
  cardTitle: { color: t.text, fontSize: 18, fontWeight: '500' },
  cardDesc: { color: t.textFaint, fontSize: 12, lineHeight: 18 },
  cardArrow: { color: t.textFaint, fontSize: 30, lineHeight: 32 },
})
