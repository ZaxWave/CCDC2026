import React, { useRef, useState } from 'react'
import {
  View, Text, FlatList, TouchableOpacity,
  StyleSheet, Dimensions, StatusBar
} from 'react-native'
import AsyncStorage from '@react-native-async-storage/async-storage'

const { width, height } = Dimensions.get('window')

const SLIDES = [
  {
    id: '1',
    icon: '⚡',
    title: '轻量化\n实时检测',
    desc: '搭载自研 ls-det 轻量模型，单帧推理仅需 18ms。无论行车记录仪、路侧摄像头还是手机拍摄，随时随地精准识别 8 类路面病害。',
    accent: '#3E6AE1',
  },
  {
    id: '2',
    icon: '📈',
    title: 'AI 趋势\n演化预测',
    desc: '时间轴引擎持续追踪同一病害的置信度变化，自动生成"稳定 / 恶化 / 好转"趋势判断，提前预警高风险路段，让维护更主动。',
    accent: '#0ea770',
  },
  {
    id: '3',
    icon: '🔁',
    title: '一键派单\n闭环处理',
    desc: 'DeepSeek 大模型自动生成工料估算与维修方案，一键推送至巡检员任务列表，实现"发现病害 → 生成报告 → 派发工单 → 闭环修复"全生命周期管理。',
    accent: '#f59e0b',
  },
]

export default function OnboardingScreen({ navigation }) {
  const [activeIndex, setActiveIndex] = useState(0)
  const flatRef = useRef(null)

  const handleNext = () => {
    if (activeIndex < SLIDES.length - 1) {
      flatRef.current?.scrollToIndex({ index: activeIndex + 1, animated: true })
    } else {
      finish()
    }
  }

  const finish = async () => {
    await AsyncStorage.setItem('onboarding_done', '1')
    navigation.replace('Home')
  }

  return (
    <View style={styles.root}>
      <StatusBar barStyle="light-content" backgroundColor="#0d1018" />

      <FlatList
        ref={flatRef}
        data={SLIDES}
        horizontal
        pagingEnabled
        showsHorizontalScrollIndicator={false}
        keyExtractor={item => item.id}
        onMomentumScrollEnd={e => {
          setActiveIndex(Math.round(e.nativeEvent.contentOffset.x / width))
        }}
        renderItem={({ item }) => (
          <View style={styles.slide}>
            {/* background glow */}
            <View style={[styles.glow, { backgroundColor: item.accent + '22' }]} />

            <Text style={styles.icon}>{item.icon}</Text>
            <Text style={[styles.title, { color: item.accent }]}>{item.title}</Text>
            <Text style={styles.desc}>{item.desc}</Text>
          </View>
        )}
      />

      {/* dot indicators */}
      <View style={styles.dots}>
        {SLIDES.map((s, i) => (
          <View
            key={s.id}
            style={[
              styles.dot,
              i === activeIndex && { backgroundColor: SLIDES[activeIndex].accent, width: 20 },
            ]}
          />
        ))}
      </View>

      {/* action buttons */}
      <View style={styles.footer}>
        <TouchableOpacity onPress={finish} style={styles.skipBtn}>
          <Text style={styles.skipText}>跳过</Text>
        </TouchableOpacity>

        <TouchableOpacity
          onPress={handleNext}
          style={[styles.nextBtn, { backgroundColor: SLIDES[activeIndex].accent }]}
        >
          <Text style={styles.nextText}>
            {activeIndex === SLIDES.length - 1 ? '开始使用' : '下一步'}
          </Text>
        </TouchableOpacity>
      </View>
    </View>
  )
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: '#0d1018',
    justifyContent: 'center',
  },
  slide: {
    width,
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 40,
    paddingTop: 60,
  },
  glow: {
    position: 'absolute',
    width: width * 0.8,
    height: width * 0.8,
    borderRadius: width * 0.4,
    top: '10%',
    alignSelf: 'center',
  },
  icon: {
    fontSize: 72,
    marginBottom: 32,
  },
  title: {
    fontSize: 32,
    fontWeight: '800',
    textAlign: 'center',
    lineHeight: 42,
    marginBottom: 24,
  },
  desc: {
    fontSize: 16,
    color: '#8892a4',
    textAlign: 'center',
    lineHeight: 26,
  },
  dots: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 6,
    marginBottom: 24,
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#2c3347',
    transition: 'all 0.3s',
  },
  footer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 32,
    paddingBottom: 48,
  },
  skipBtn: {
    padding: 12,
  },
  skipText: {
    color: '#8892a4',
    fontSize: 15,
  },
  nextBtn: {
    paddingHorizontal: 32,
    paddingVertical: 14,
    borderRadius: 12,
  },
  nextText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '700',
  },
})
