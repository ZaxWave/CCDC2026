import { useEffect, useMemo, useState } from 'react'
import { View, Text, ScrollView } from '@tarojs/components'
import Taro from '@tarojs/taro'
import { acceptOrder, completeOrder, getOrders } from '../../../api/orders'
import styles from './index.module.scss'

const STATUS = {
  pending:    { label: '待处理', dot: '#f59e0b', bg: 'rgba(245,158,11,0.08)',  border: 'rgba(245,158,11,0.22)' },
  processing: { label: '处理中', dot: '#3e6ae1', bg: 'rgba(62,106,225,0.08)', border: 'rgba(62,106,225,0.22)' },
  done:       { label: '已完成', dot: '#1a8045', bg: 'rgba(26,128,69,0.08)',   border: 'rgba(26,128,69,0.22)'  },
}

const URGENCY_COLOR = { 高危: '#d93025', 中危: '#f59e0b', 低危: '#1a8045' }

const FILTERS = [
  { key: 'all', label: '全部' },
  { key: 'pending', label: '待处理' },
  { key: 'processing', label: '处理中' },
  { key: 'done', label: '已完成' },
]

function uiStatus(order) {
  return order.status === 'repaired' ? 'done' : order.status
}

function timeAgo(isoStr) {
  if (!isoStr) return '--'
  const diff = Date.now() - new Date(isoStr).getTime()
  const mins = Math.floor(diff / 60000)
  if (Number.isNaN(mins)) return '--'
  if (mins < 1) return '刚刚'
  if (mins < 60) return `${mins}分钟前`
  const hrs = Math.floor(mins / 60)
  if (hrs < 24) return `${hrs}小时前`
  return `${Math.floor(hrs / 24)}天前`
}

function locText(order) {
  if (order.lat != null && order.lng != null) {
    return `${Number(order.lat).toFixed(4)}°N  ${Number(order.lng).toFixed(4)}°E`
  }
  return '坐标未知'
}

export default function WorkerIssues() {
  const [filter, setFilter] = useState('all')
  const [orders, setOrders] = useState([])
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [actioning, setActioning] = useState({})

  const goBack = () => {
    const pages = Taro.getCurrentPages()
    if (pages.length > 1) {
      Taro.navigateBack()
    } else {
      Taro.reLaunch({ url: '/pages/worker/list/index' })
    }
  }

  const load = async (isRefresh = false) => {
    if (isRefresh) setRefreshing(true)
    else setLoading(true)
    try {
      const data = await getOrders()
      setOrders(data || [])
    } catch (e) {
      Taro.showToast({ title: e.message || '工单加载失败', icon: 'none' })
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }

  useEffect(() => {
    load()
  }, [])

  const counts = useMemo(() => ({
    pending: orders.filter(o => o.status === 'pending').length,
    processing: orders.filter(o => o.status === 'processing').length,
    done: orders.filter(o => o.status === 'repaired').length,
  }), [orders])

  const list = useMemo(() => {
    if (filter === 'all') return orders
    if (filter === 'done') return orders.filter(o => o.status === 'repaired')
    return orders.filter(o => o.status === filter)
  }, [filter, orders])

  const handleAccept = async (order) => {
    setActioning(a => ({ ...a, [order.id]: true }))
    try {
      await acceptOrder(order.id)
      setOrders(prev => prev.map(o => o.id === order.id ? { ...o, status: 'processing' } : o))
      Taro.showToast({ title: '已接单', icon: 'success' })
    } catch (e) {
      Taro.showToast({ title: e.message || '接单失败', icon: 'none' })
    } finally {
      setActioning(a => ({ ...a, [order.id]: false }))
    }
  }

  const handleComplete = (order) => {
    Taro.showModal({
      title: '确认完工',
      content: `确认将工单 ${order.order_no} 标记为已完成？`,
      confirmText: '确认完工',
      success: async (res) => {
        if (!res.confirm) return
        setActioning(a => ({ ...a, [order.id]: true }))
        try {
          await completeOrder(order.id)
          setOrders(prev => prev.map(o => o.id === order.id ? { ...o, status: 'repaired' } : o))
          Taro.showToast({ title: '已完工', icon: 'success' })
        } catch (e) {
          Taro.showToast({ title: e.message || '提交失败', icon: 'none' })
        } finally {
          setActioning(a => ({ ...a, [order.id]: false }))
        }
      },
    })
  }

  return (
    <View className={styles.page}>
      <View className={styles.fixedTop}>
        <View className={styles.topBar}>
          <View className={styles.backBtn} onClick={goBack}>
            <Text className={styles.backIcon}>‹</Text>
            <Text className={styles.topTitle}>养护工单</Text>
          </View>
          <Text className={styles.topCount}>{counts.pending} 单待处理</Text>
        </View>

        <View className={styles.stats}>
          {Object.entries(STATUS).map(([k, v]) => (
            <View key={k} className={styles.statItem} onClick={() => setFilter(k)}>
              <Text className={styles.statNum} style={{ color: v.dot }}>{counts[k]}</Text>
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

      <ScrollView
        className={styles.listScroll}
        scrollY
        refresherEnabled
        refresherTriggered={refreshing}
        onRefresherRefresh={() => load(true)}
      >
        <View className={styles.list}>
          {loading ? (
            <View className={styles.emptyBox}>
              <Text className={styles.emptyTitle}>加载工单...</Text>
            </View>
          ) : list.length === 0 ? (
            <View className={styles.emptyBox}>
              <Text className={styles.emptyTitle}>
                {filter === 'all' ? '暂无工单' : `暂无${FILTERS.find(f => f.key === filter)?.label}工单`}
              </Text>
              {filter === 'all' && <Text className={styles.emptyHint}>Web 端产生病害记录后会同步到这里。</Text>}
            </View>
          ) : list.map(order => {
            const st = STATUS[uiStatus(order)] || STATUS.pending
            const urgencyColor = URGENCY_COLOR[order.urgency] || '#9ca3af'
            const isActing = actioning[order.id]
            return (
              <View key={order.id} className={styles.taskCard}>
                <View className={styles.taskTop}>
                  <Text className={styles.taskId}>{order.order_no}</Text>
                  <View className={styles.statusBadge} style={{ background: st.bg, borderColor: st.border }}>
                    <View className={styles.statusDot} style={{ background: st.dot }} />
                    <Text className={styles.statusText} style={{ color: st.dot }}>{st.label}</Text>
                  </View>
                </View>

                <View className={styles.taskMain}>
                  <Text className={styles.taskType}>{order.label_cn}</Text>
                  <View
                    className={styles.urgencyBadge}
                    style={{ borderColor: `${urgencyColor}55`, background: `${urgencyColor}15` }}
                  >
                    <Text className={styles.urgencyText} style={{ color: urgencyColor }}>{order.urgency}</Text>
                  </View>
                </View>

                {(order.cluster_count || 0) > 1 && (
                  <View className={styles.clusterRow}>
                    <Text className={styles.clusterText}>同点位检出 {order.cluster_count} 次</Text>
                  </View>
                )}

                {!!order.repair_method && <Text className={styles.repairMethod}>{order.repair_method}</Text>}
                {!!order.priority_reason && <Text className={styles.priorityReason}>{order.priority_reason}</Text>}

                <View className={styles.taskMeta}>
                  <Text className={styles.taskLocation}>{locText(order)}</Text>
                  {!!order.estimated_hours && <Text className={styles.hoursText}>约 {order.estimated_hours}h</Text>}
                </View>

                <View className={styles.taskBottom}>
                  <Text className={styles.taskTime}>{timeAgo(order.dispatched_at || order.timestamp)}</Text>
                  {order.status === 'pending' && (
                    <View
                      className={`${styles.actionBtn} ${styles.acceptBtn} ${isActing ? styles.btnDisabled : ''}`}
                      onClick={() => !isActing && handleAccept(order)}
                    >
                      <Text className={styles.acceptBtnText}>{isActing ? '接单中...' : '接单'}</Text>
                    </View>
                  )}
                  {order.status === 'processing' && (
                    <View
                      className={`${styles.actionBtn} ${styles.doneBtn} ${isActing ? styles.btnDisabled : ''}`}
                      onClick={() => !isActing && handleComplete(order)}
                    >
                      <Text className={styles.doneBtnText}>{isActing ? '提交中...' : '标记完工'}</Text>
                    </View>
                  )}
                </View>
              </View>
            )
          })}
          <View className={styles.listPad} />
        </View>
      </ScrollView>
    </View>
  )
}
