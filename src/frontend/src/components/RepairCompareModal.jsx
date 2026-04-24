import { useRef, useState, useCallback, useEffect } from 'react'
import s from './RepairCompareModal.module.css'

export default function RepairCompareModal({ record, onClose }) {
  const [pos, setPos] = useState(50) // 0–100 %
  const [dragging, setDragging] = useState(false)
  const containerRef = useRef(null)

  const calcPos = useCallback((clientX) => {
    const rect = containerRef.current?.getBoundingClientRect()
    if (!rect) return
    const pct = Math.max(0, Math.min(100, ((clientX - rect.left) / rect.width) * 100))
    setPos(pct)
  }, [])

  const onMouseMove = useCallback((e) => {
    if (!dragging) return
    calcPos(e.clientX)
  }, [dragging, calcPos])

  const onMouseUp = useCallback(() => setDragging(false), [])

  useEffect(() => {
    if (dragging) {
      window.addEventListener('mousemove', onMouseMove)
      window.addEventListener('mouseup', onMouseUp)
    }
    return () => {
      window.removeEventListener('mousemove', onMouseMove)
      window.removeEventListener('mouseup', onMouseUp)
    }
  }, [dragging, onMouseMove, onMouseUp])

  // touch
  const onTouchMove = useCallback((e) => {
    calcPos(e.touches[0].clientX)
  }, [calcPos])

  const before = record.thumbnail_b64
  const after  = record.repaired_image_b64
  const hasRepairDate = record.repaired_at
  const label = record.label_cn || record.label || '病害'

  return (
    <div className={s.overlay} onClick={onClose}>
      <div className={s.panel} onClick={e => e.stopPropagation()}>

        {/* header */}
        <div className={s.header}>
          <div className={s.headerLeft}>
            <span
              className={s.chip}
              style={{
                color: record.color_hex || '#3E6AE1',
                background: (record.color_hex || '#3E6AE1') + '18',
                borderColor: (record.color_hex || '#3E6AE1') + '55',
              }}
            >
              {label}
            </span>
            <span className={s.title}>修复前后对比</span>
          </div>
          <div className={s.headerRight}>
            {hasRepairDate && (
              <span className={s.repairDate}>
                修复于 {new Date(hasRepairDate).toLocaleDateString('zh-CN')}
              </span>
            )}
            <button className={s.closeBtn} onClick={onClose}>✕</button>
          </div>
        </div>

        {/* slider area */}
        <div
          className={s.compare}
          ref={containerRef}
          onMouseDown={e => { setDragging(true); calcPos(e.clientX) }}
          onTouchStart={e => calcPos(e.touches[0].clientX)}
          onTouchMove={onTouchMove}
        >
          {/* BEFORE */}
          <div className={s.imgWrap}>
            {before
              ? <img src={before} className={s.img} alt="检测原图" draggable={false} />
              : <div className={s.placeholder}><span>暂无检测原图</span></div>
            }
            <div className={s.imgLabel} style={{ left: 12 }}>修复前</div>
          </div>

          {/* AFTER — clipped from the left edge to `pos` */}
          <div className={s.imgWrap} style={{ clipPath: `inset(0 0 0 ${pos}%)` }}>
            {after
              ? <img src={after} className={s.img} alt="修复后照片" draggable={false} />
              : <div className={s.placeholder}><span>暂无修复照片</span></div>
            }
            <div className={s.imgLabel} style={{ right: 12 }}>修复后</div>
          </div>

          {/* divider handle */}
          <div className={s.handle} style={{ left: `${pos}%` }}>
            <div className={s.handleLine} />
            <div className={s.handleKnob}>
              <svg width="18" height="18" viewBox="0 0 18 18" fill="none">
                <path d="M6 4l-4 5 4 5" stroke="#fff" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/>
                <path d="M12 4l4 5-4 5" stroke="#fff" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
            </div>
          </div>
        </div>

        {/* meta footer */}
        <div className={s.footer}>
          <div className={s.metaItem}>
            <span className={s.metaKey}>置信度</span>
            <span className={s.metaVal} style={{ color: record.color_hex || '#3E6AE1' }}>
              {record.confidence != null ? (record.confidence * 100).toFixed(1) + '%' : '—'}
            </span>
          </div>
          <div className={s.metaDivider} />
          <div className={s.metaItem}>
            <span className={s.metaKey}>负责人</span>
            <span className={s.metaVal}>{record.worker_name || '—'}</span>
          </div>
          <div className={s.metaDivider} />
          <div className={s.metaItem}>
            <span className={s.metaKey}>来源文件</span>
            <span className={s.metaVal}>{record.filename || '—'}</span>
          </div>
          {record.dispatch_info?.urgency && <>
            <div className={s.metaDivider} />
            <div className={s.metaItem}>
              <span className={s.metaKey}>紧急程度</span>
              <span className={s.metaVal}>{record.dispatch_info.urgency}</span>
            </div>
          </>}
        </div>

      </div>
    </div>
  )
}
