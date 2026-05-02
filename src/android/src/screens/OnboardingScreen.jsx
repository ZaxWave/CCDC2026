import React, { useRef, useState } from 'react'
import {
  View, Text, FlatList, TouchableOpacity,
  StyleSheet, Dimensions, StatusBar
} from 'react-native'
import AsyncStorage from '@react-native-async-storage/async-storage'
import BrandWordmark from '../components/BrandWordmark'
import { useThemedStyles, useTheme } from '../theme'

const { width } = Dimensions.get('window')

const SLIDES = [
  {
    id: '1',
    index: '01',
    title: '现场采集',
    desc: '拍照和录像都可以直接写入平台记录，保留位置、时间和识别结果。',
    accent: '#3E6AE1',
  },
  {
    id: '2',
    index: '02',
    title: '多角度聚合',
    desc: '同一病害的多次拍摄会被聚合为一个病害点，便于后续查看和处置。',
    accent: '#0ea770',
  },
  {
    id: '3',
    index: '03',
    title: '闭环处理',
    desc: '巡检员可以接收工单、更新状态，并把处理结果回传到平台。',
    accent: '#f59e0b',
  },
]

export default function OnboardingScreen({ navigation }) {
  const styles = useThemedStyles(createStyles)
  const theme = useTheme()
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
      <StatusBar barStyle={theme.isDark ? 'light-content' : 'dark-content'} backgroundColor={theme.bg} />

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
            <BrandWordmark size={34} centered />
            <Text style={[styles.index, { color: item.accent }]}>{item.index}</Text>
            <Text style={styles.title}>{item.title}</Text>
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

const createStyles = (t) => StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: t.bg,
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
  index: { fontSize: 13, fontWeight: '600', marginTop: 58, marginBottom: 12 },
  title: {
    fontSize: 34,
    fontWeight: '600',
    textAlign: 'center',
    lineHeight: 42,
    marginBottom: 18,
    color: t.text,
  },
  desc: {
    fontSize: 15,
    color: t.textMuted,
    textAlign: 'center',
    lineHeight: 24,
    maxWidth: 310,
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
    backgroundColor: t.surfaceStrong,
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
    color: t.textMuted,
    fontSize: 15,
  },
  nextBtn: {
    paddingHorizontal: 32,
    paddingVertical: 14,
    borderRadius: 8,
  },
  nextText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '700',
  },
})
