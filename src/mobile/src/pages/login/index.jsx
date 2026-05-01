import { useState } from 'react'
import { View, Text, Input } from '@tarojs/components'
import Taro from '@tarojs/taro'
import { login } from '../../api/auth'
import styles from './index.module.scss'

export default function Login() {
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
      Taro.setStorageSync('token', data.access_token)
      Taro.setStorageSync('token_type', data.token_type || 'bearer')
      Taro.setStorageSync('user', { account: account.trim(), name: account.trim() })
      setLoading(false)
      Taro.showToast({ title: '登录成功', icon: 'success', duration: 1000 })
      setTimeout(() => Taro.redirectTo({ url: '/pages/worker/list/index' }), 1000)
    } catch (e) {
      setLoading(false)
      setError(e.message || '登录失败')
    }
  }

  return (
    <View className={styles.page}>
      <View className={styles.topBar}>
        <View className={styles.backBtn} onClick={() => Taro.navigateBack()}>
          <Text className={styles.backIcon}>‹</Text>
          <Text className={styles.backText}>返回</Text>
        </View>
      </View>

      <View className={styles.header}>
        <Text className={styles.roleLabel}>INSPECTOR · 巡检员</Text>
        <Text className={styles.title}>登录</Text>
        <Text className={styles.subtitle}>使用工号和系统密码登录专业版</Text>
      </View>

      <View className={styles.form}>
        <View className={styles.field}>
          <Text className={styles.fieldLabel}>工号 / 账号</Text>
          <View className={styles.inputRow}>
            <Text className={styles.inputIcon}>—</Text>
            <Input
              className={styles.input}
              placeholder="请输入工号"
              placeholderClass={styles.ph}
              value={account}
              onInput={e => setAccount(e.detail.value)}
            />
          </View>
        </View>

        <View className={styles.field}>
          <Text className={styles.fieldLabel}>密码</Text>
          <View className={styles.inputRow}>
            <Text className={styles.inputIcon}>—</Text>
            <Input
              className={styles.input}
              placeholder="请输入密码"
              placeholderClass={styles.ph}
              password
              value={password}
              onInput={e => setPassword(e.detail.value)}
            />
          </View>
        </View>

        {error ? (
          <View className={styles.errorBox}>
            <Text className={styles.errorText}>{error}</Text>
          </View>
        ) : null}

        <View
          className={`${styles.submitBtn} ${loading ? styles.submitLoading : ''}`}
          onClick={loading ? undefined : handleLogin}
        >
          <Text className={styles.submitText}>{loading ? '验证中...' : '登 录'}</Text>
        </View>

        <Text className={styles.demoHint}>使用服务器账号登录</Text>
      </View>
    </View>
  )
}
