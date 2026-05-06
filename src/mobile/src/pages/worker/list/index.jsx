import { View, Text } from '@tarojs/components'
import Taro from '@tarojs/taro'
import { useState, useEffect } from 'react'
import styles from './index.module.scss'

export default function WorkerHub() {
  const [user, setUser] = useState({})

  useEffect(() => {
    const u = Taro.getStorageSync('user')
    if (u) setUser(u)
  }, [])

  const logout = () => {
    Taro.showModal({
      title: '退出登录',
      content: '确认退出专业版？',
      success: r => {
        if (r.confirm) {
          Taro.removeStorageSync('token')
          Taro.removeStorageSync('user')
          Taro.redirectTo({ url: '/pages/index/index' })
        }
      }
    })
  }

  return (
    <View className={styles.page}>
      <View className={styles.header}>
        <View>
          <Text className={styles.greeting}>{user.name || '巡检员'}</Text>
          <Text className={styles.greetingSub}>今日工作台</Text>
        </View>
        <View className={styles.logoutBtn} onClick={logout}>
          <Text className={styles.logoutText}>退出</Text>
        </View>
      </View>

      <View className={styles.tiles}>
        <Text className={styles.sectionLabel}>采集</Text>
        <View
          className={styles.tile}
          onClick={() => Taro.navigateTo({ url: '/pages/citizen/report/index?source=worker' })}
        >
          <Text className={`${styles.tileNumber} ${styles.tileNumberBlue}`}>01</Text>
          <View className={styles.tileBody}>
            <Text className={styles.tileTitle}>拍照巡检</Text>
            <Text className={styles.tileDesc}>多角度取证 · 自动写入时间位置</Text>
          </View>
          <Text className={styles.tileArrow}>›</Text>
        </View>

        <View
          className={styles.tile}
          onClick={() => Taro.navigateTo({ url: '/pages/worker/record/index' })}
        >
          <Text className={`${styles.tileNumber} ${styles.tileNumberRed}`}>02</Text>
          <View className={styles.tileBody}>
            <Text className={styles.tileTitle}>距离采样</Text>
            <Text className={styles.tileDesc}>横屏采样 · 自定义距离间隔</Text>
          </View>
          <Text className={styles.tileArrow}>›</Text>
        </View>

        <Text className={styles.sectionLabel}>处置</Text>
        <View
          className={styles.tile}
          onClick={() => Taro.navigateTo({ url: '/pages/worker/issues/index' })}
        >
          <Text className={`${styles.tileNumber} ${styles.tileNumberGray}`}>03</Text>
          <View className={styles.tileBody}>
            <Text className={styles.tileTitle}>养护工单</Text>
            <Text className={styles.tileDesc}>查看工单 · 接单处理闭环</Text>
          </View>
          <Text className={styles.tileArrow}>›</Text>
        </View>
      </View>
    </View>
  )
}
