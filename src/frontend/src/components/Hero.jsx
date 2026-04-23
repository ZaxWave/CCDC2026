import { useState, useEffect, useRef } from 'react'
import s from './Hero.module.css'

const SAMPLE_IMAGES = [
  {
    id: 1,
    url: '/sample1.jpg',
    caption: '道路病害检测1'
  },
  {
    id: 2,
    url: '/sample2.jpg',
    caption: '道路病害检测2'
  },
  {
    id: 3,
    url: '/sample3.jpg',
    caption: '道路病害检测3'
  }
]

export default function Hero({ onImageClick, onVideoClick }) {
  const [currentIndex, setCurrentIndex] = useState(0)
  const timerRef = useRef(null)

  const resetTimer = () => {
    if (timerRef.current) {
      clearInterval(timerRef.current)
    }
    timerRef.current = setInterval(() => {
      handleNext()
    }, 3500)
  }

  useEffect(() => {
    resetTimer()
    return () => {
      if (timerRef.current) {
        clearInterval(timerRef.current)
      }
    }
  }, [])

  const handleNext = () => {
    setCurrentIndex((prev) => (prev + 1) % SAMPLE_IMAGES.length)
    resetTimer()
  }

  const handlePrev = () => {
    setCurrentIndex((prev) => (prev - 1 + SAMPLE_IMAGES.length) % SAMPLE_IMAGES.length)
    resetTimer()
  }

  const getSlidePosition = (idx) => {
    const diff = idx - currentIndex
    if (diff === 0) {
      return 'center'
    } else if (diff === 1 || diff === -(SAMPLE_IMAGES.length - 1)) {
      return 'right'
    } else if (diff === -1 || diff === SAMPLE_IMAGES.length - 1) {
      return 'left'
    }
    return 'hidden'
  }

  return (
    <section className={s.hero}>
      {/* 3D轮播图 */}
      <div className={s.carousel3D}>
        {SAMPLE_IMAGES.map((img, idx) => {
          const position = getSlidePosition(idx)
          const positionClass = s[position]
          return (
            <div
              key={img.id}
              className={`${s.slide3D} ${positionClass}`}
              style={{ backgroundImage: `url(${img.url})` }}
            />
          )
        })}
      </div>

      {/* 箭头按钮 */}
      <button className={s.arrowBtn} onClick={handlePrev} style={{ left: '20px' }}>←</button>
      <button className={s.arrowBtn} onClick={handleNext} style={{ right: '20px' }}>→</button>

      {/* 遮罩层 */}
      <div className={s.overlay} />

      {/* 内容层 */}
      <div className={s.content}>
        <div className={s.tag}>道路病害智能巡检系统</div>
        <h1 className={s.title}>轻巡智维 LightScan</h1>
        <p className={s.sub}>基于 LS-Det 轻量化检测模型，一键识别路面裂缝、坑槽、修补等病害类型</p>
        <div className={s.actions}>
          <button className={s.btnPrimary} onClick={onImageClick}>上传图像检测</button>
          <button className={s.btnSecondary} onClick={onVideoClick}>上传视频检测</button>
        </div>
      </div>
    </section>
  )
}
