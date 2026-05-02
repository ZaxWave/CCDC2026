import { useState } from 'react'
import { View, Text, TextInput, TouchableOpacity, StyleSheet, ActivityIndicator } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import AsyncStorage from '@react-native-async-storage/async-storage'
import { login } from '../api/auth'
import BrandWordmark from '../components/BrandWordmark'
import { useThemedStyles } from '../theme'

export default function LoginScreen({ navigation, route }) {
  const s = useThemedStyles(createStyles)
  const [account, setAccount] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const handleLogin = async () => {
    if (!account.trim() || !password.trim()) {
      setError('请填写账号和密码')
      return
    }
    setError('')
    setLoading(true)
    try {
      const data = await login(account.trim(), password)
      await AsyncStorage.setItem('token', data.access_token)
      await AsyncStorage.setItem('token_type', data.token_type || 'bearer')
      await AsyncStorage.setItem('user', JSON.stringify({ account: account.trim(), name: account.trim() }))
      navigation.replace(route?.params?.redirect || 'WorkerHub', route?.params?.redirectParams)
    } catch (e) {
      setError(e.message || '登录失败，请检查账号和密码')
    } finally {
      setLoading(false)
    }
  }

  return (
    <SafeAreaView style={s.page}>
      <View style={s.topBar}>
        <TouchableOpacity style={s.backBtn} onPress={() => navigation.goBack()} activeOpacity={0.6}>
          <Text style={s.backIcon}>‹</Text>
          <Text style={s.backText}>返回</Text>
        </TouchableOpacity>
      </View>

      <View style={s.formWrap}>
        <BrandWordmark size={34} centered />
        <View style={s.header}>
          <Text style={s.roleLabel}>{route?.params?.redirect === 'Report' ? '上报前登录' : '专业版'}</Text>
          <Text style={s.title}>账号登录</Text>
          <Text style={s.subtitle}>连接 LightScan 服务器后继续使用现场端</Text>
        </View>

      <View style={s.form}>
        <View style={s.field}>
          <Text style={s.fieldLabel}>账号</Text>
          <TextInput
            style={s.input}
            placeholder="输入管理员或巡检员账号"
            placeholderTextColor={s.placeholder.color}
            value={account}
            onChangeText={setAccount}
            autoCapitalize="none"
          />
          <View style={s.inputUnderline} />
        </View>

        <View style={s.field}>
          <Text style={s.fieldLabel}>密码</Text>
          <TextInput
            style={s.input}
            placeholder="请输入密码"
            placeholderTextColor={s.placeholder.color}
            secureTextEntry
            value={password}
            onChangeText={setPassword}
          />
          <View style={s.inputUnderline} />
        </View>

        {error ? (
          <View style={s.errorBox}>
            <Text style={s.errorText}>{error}</Text>
          </View>
        ) : null}

        <TouchableOpacity
          style={[s.submitBtn, loading && s.submitLoading]}
          onPress={loading ? undefined : handleLogin}
          activeOpacity={0.75}
        >
          {loading
            ? <ActivityIndicator color="#fff" />
            : <Text style={s.submitText}>登录</Text>
          }
        </TouchableOpacity>

        <Text style={s.demoHint}>使用服务器账号登录，登录状态会保存在本机。</Text>
      </View>
      </View>
    </SafeAreaView>
  )
}

const createStyles = (t) => StyleSheet.create({
  page: { flex: 1, backgroundColor: t.bg },
  topBar: { paddingHorizontal: 24, paddingTop: 8 },
  backBtn: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  backIcon: { fontSize: 28, color: t.textMuted, lineHeight: 32 },
  backText: { fontSize: 16, color: t.textMuted },
  formWrap: { flex: 1, justifyContent: 'center', paddingHorizontal: 28, paddingBottom: 56, gap: 28 },
  header: { alignItems: 'center', gap: 8 },
  roleLabel: { fontSize: 12, color: t.textFaint, letterSpacing: 0 },
  title: { fontSize: 30, fontWeight: '500', color: t.text },
  subtitle: { fontSize: 13, color: t.textMuted, textAlign: 'center', lineHeight: 19 },
  form: {
    gap: 18,
    backgroundColor: t.panel,
    borderWidth: 1,
    borderColor: t.border,
    borderRadius: 12,
    padding: 18,
  },
  field: { gap: 8 },
  fieldLabel: { fontSize: 13, color: t.textMuted, letterSpacing: 0 },
  input: {
    fontSize: 16,
    color: t.text,
    paddingHorizontal: 12,
    height: 48,
    borderRadius: 4,
    backgroundColor: t.input,
    borderWidth: 1,
    borderColor: t.borderStrong,
  },
  placeholder: { color: t.textFaint },
  inputUnderline: { display: 'none' },
  errorBox: {
    backgroundColor: 'rgba(220,38,38,0.1)',
    borderRadius: 4,
    padding: 12,
    borderWidth: 1,
    borderColor: 'rgba(220,38,38,0.3)',
  },
  errorText: { color: '#ef4444', fontSize: 14 },
  submitBtn: {
    backgroundColor: t.blue,
    borderRadius: 4,
    height: 52,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 4,
  },
  submitLoading: { opacity: 0.7 },
  submitText: { fontSize: 16, fontWeight: '500', color: '#ffffff', letterSpacing: 0 },
  demoHint: { textAlign: 'center', fontSize: 12, color: t.textFaint, marginTop: 2, lineHeight: 18 },
})
