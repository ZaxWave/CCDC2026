import { useState, useEffect } from 'react'
import { View, Text, ScrollView } from '@tarojs/components'
import Taro from '@tarojs/taro'
import styles from './index.module.scss'

const STATUS = {
  pending:    { label: '待处理', dot: '#f59e0b', bg: 'rgba(245,158,11,0.08)',  border: 'rgba(245,158,11,0.22)' },
  processing: { label: '处理中', dot: '#3e6ae1', bg: 'rgba(62,106,225,0.08)', border: 'rgba(62,106,225,0.22)' },
  done:       { label: '已完成', dot: '#1a8045', bg: 'rgba(26,128,69,0.08)',   border: 'rgba(26,128,69,0.22)'  },
}

const LEVEL_COLOR = { 严重: '#d93025', 中等: '#f59e0b', 轻微: '#1a8045' }

const MOCK = [
  { id: 'LS-001', type: '路面坑洞', location: '朝阳区建国路88号附近',     status: 'pending',    time: '10分钟前', level: '严重' },
  { id: 'LS-002', type: '护栏损坏', location: '海淀区中关村大街12号',     status: 'processing', time: '1小时前',  level: '中等' },
  { id: 'LS-003', type: '标线磨损', location: '西城区长安街与复兴路交口', status: 'done',       time: '昨天',    level: '轻微' },
  { id: 'LS-004', type: '路面裂缝', location: '丰台区南三环中路',         status: 'pending',    time: '30分钟前', level: '中等' },
  { id: 'LS-005', type: '积水内涝', location: '通州区运河东大街',         status: 'processing', time: '2小时前',  level: '严重' },
  { id: 'LS-006', type: '路面坑洞', location: '石景山区阜石路',           status: 'pending',    time: '5分钟前',  level: '严重' },
]

const FILTERS = [
  { key: 'all', label: '全部' },
  { key: 'pending', label: '待处理' },
  { key: 'processing', label: '处理中' },
  { key: 'done', label: '已完成' },
]

export default function WorkerList() {
  const [filter, setFilter] = useState('all')
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

  const list = filter === 'all' ? MOCK : MOCK.filter(t => t.status === filter)

  return (
    <View className={styles.page}>
      <View className={styles.fixedTop}>
        <View className={styles.topBar}>
          <View>
            <Text className={styles.greeting}>{user.name || '巡检员'}</Text>
            <Text className={styles.greetingSub}>
              {MOCK.filter(t => t.status === 'pending').length} 单待处理
            </Text>
          </View>
          <View className={styles.logoutBtn} onClick={logout}>
            <Text className={styles.logoutText}>退出</Text>
          </View>
        </View>

        <View className={styles.stats}>
          {Object.entries(STATUS).map(([k, v]) => (
            <View key={k} className={styles.statItem} onClick={() => setFilter(k)}>
              <Text className={styles.statNum} style={{ color: v.dot }}>
                {MOCK.filter(t => t.status === k).length}
              </Text>
              <Text className={styles.statLabel}>{v.label}</Text>
            </View>
          ))}
        </View>
      </View>

      <View className={styles.filterBar}>
        {FILTERS.map(f => (
          <View
            key={f.key}
            className={`${styles.filterTab} ${filter === f.key ? styles.filterTabOn : ''}`}
            onClick={() => setFilter(f.key)}
          >
            <Text className={styles.filterTabText}>{f.label}</Text>
          </View>
        ))}
      </View>

      <ScrollView className={styles.listScroll} scrollY>
        <View className={styles.list}>
          {list.length === 0
            ? <Text className={styles.empty}>暂无工单</Text>
            : list.map(task => {
                const s = STATUS[task.status]
                return (
                  <View key={task.id} className={styles.taskCard}>
                    <View className={styles.taskTop}>
                      <Text className={styles.taskId}>{task.id}</Text>
                      <View className={styles.statusBadge} style={{ background: s.bg, borderColor: s.border }}>
                        <View className={styles.statusDot} style={{ background: s.dot }} />
                        <Text className={styles.statusText} style={{ color: s.dot }}>{s.label}</Text>
                      </View>
                    </View>

                    <View className={styles.taskMain}>
                      <Text className={styles.taskType}>{task.type}</Text>
                      <Text className={styles.levelText} style={{ color: LEVEL_COLOR[task.level] }}>
                        {task.level}
                      </Text>
                    </View>

                    <Text className={styles.taskLocation}>📍 {task.location}</Text>

                    <View className={styles.taskBottom}>
                      <Text className={styles.taskTime}>{task.time}</Text>
                      <Text className={styles.actionText}>查看详情 ›</Text>
                    </View>
                  </View>
                )
              })
          }
          <View className={styles.listPad} />
        </View>
      </ScrollView>
    </View>
  )
}
