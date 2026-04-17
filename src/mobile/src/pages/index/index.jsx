import { View, Text } from '@tarojs/components'
import Taro from '@tarojs/taro'
import styles from './index.module.scss'

export default function Index() {
  const goToCitizen = () => Taro.navigateTo({ url: '/pages/citizen/report/index' })

  const goToWorker = () => {
    const token = Taro.getStorageSync('token')
    Taro.navigateTo({
      url: token ? '/pages/worker/list/index' : '/pages/login/index'
    })
  }

  return (
    <View className={styles.page}>
      {/* 品牌区 */}
      <View className={styles.brand}>
        <View className={styles.wordmark}>
          <Text className={styles.wordLight}>Light</Text>
          <Text className={styles.wordScan}>Scan</Text>
        </View>
        <Text className={styles.tagline}>智慧公路巡检系统</Text>
      </View>

      {/* 分隔 */}
      <View className={styles.divider} />

      {/* 入口列表 */}
      <View className={styles.entries}>
        <View className={styles.entryRow} onClick={goToCitizen}>
          <View className={styles.entryLeft}>
            <Text className={styles.entryTitle}>市民上报</Text>
            <Text className={styles.entryDesc}>发现道路问题，拍照一键上报</Text>
          </View>
          <View className={styles.entryRight}>
            <View className={styles.entryTag}>
              <Text className={styles.entryTagText}>随手拍</Text>
            </View>
            <Text className={styles.entryChevron}>›</Text>
          </View>
        </View>

        <View className={styles.rowDivider} />

        <View className={styles.entryRow} onClick={goToWorker}>
          <View className={styles.entryLeft}>
            <Text className={styles.entryTitle}>巡检员工作台</Text>
            <Text className={styles.entryDesc}>查看工单，记录处理，专业巡检</Text>
          </View>
          <View className={styles.entryRight}>
            <View className={`${styles.entryTag} ${styles.entryTagBlue}`}>
              <Text className={`${styles.entryTagText} ${styles.entryTagTextBlue}`}>专业版</Text>
            </View>
            <Text className={styles.entryChevron}>›</Text>
          </View>
        </View>
      </View>

      <Text className={styles.footer}>LightScan v1.0</Text>
    </View>
  )
}
