import { useEffect, useState } from 'react'
import { getClusterFusion } from '../../api/client'
import s from './FusionModal.module.css'

// ── 数据来源元数据 ────────────────────────────────────────────────────────────
const SOURCE_META = {
  bus_dashcam:   { label: '公交记录仪', color: '#3b82f6' },
  dashcam:       { label: '行车记录仪', color: '#8b5cf6' },
  mobile:        { label: '手机拍摄',   color: '#22c55e' },
  camera:        { label: '路侧摄像头', color: '#f97316' },
  street_camera: { label: '路侧监控',   color: '#f97316' },
  drone:         { label: '无人机',     color: '#06b6d4' },
  manual:        { label: '手动上传',   color: '#9ca3af' },
  unknown:       { label: '未知来源',   color: '#6b7280' },
}

function fmtTs(iso) {
  if (!iso) return ''
  const d = new Date(iso)
  return `${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')} ${String(d.getHours()).padStart(2,'0')}:${String(d.getMinutes()).padStart(2,'0')}`
}

function imageSrc(item) {
  const thumb = item?.thumbnail_b64
  if (!thumb) return ''
  return thumb.startsWith('data:') ? thumb : `data:image/jpeg;base64,${thumb}`
}

// ── 多图证据查看 ─────────────────────────────────────────────────────────────
function EvidenceGallery({ evidence, color }) {
  const [activeIdx, setActiveIdx] = useState(0)
  if (!evidence.length) return null

  const active = evidence[Math.min(activeIdx, evidence.length - 1)]
  const srcMeta = SOURCE_META[active.source_type] || SOURCE_META.unknown
  const activeSrc = imageSrc(active)

  return (
    <div className={s.gallery}>
      <div className={s.galleryMain}>
        {activeSrc ? (
          <img src={activeSrc} alt="融合证据" />
        ) : (
          <div className={s.noImage}>无图像预览</div>
        )}
        <div className={s.imageMetaBar}>
          <span className={s.sourcePill} style={{ borderColor: srcMeta.color, color: srcMeta.color }}>
            {srcMeta.label}
          </span>
          <span>{fmtTs(active.timestamp) || '--'}</span>
          {active.confidence != null && <span>{(active.confidence * 100).toFixed(1)}%</span>}
          {active.bearing_deg != null && <span>{active.bearing_deg.toFixed(0)}°</span>}
        </div>
      </div>
      <div className={s.thumbRail}>
        {evidence.map((item, i) => {
          const meta = SOURCE_META[item.source_type] || SOURCE_META.unknown
          const src = imageSrc(item)
          const activeThumb = i === activeIdx
          return (
            <button
              key={item.id || i}
              className={s.thumb}
              data-active={activeThumb ? 'true' : 'false'}
              style={{ borderColor: activeThumb ? color : 'rgba(255,255,255,0.08)' }}
              onClick={() => setActiveIdx(i)}
            >
              {src ? <img src={src} alt="" /> : <span>无图</span>}
              <em style={{ background: meta.color }} />
            </button>
          )
        })}
      </div>
    </div>
  )
}

function SourceSummary({ sourceStats }) {
  const entries = Object.entries(sourceStats)
  const total = entries.reduce((sum, [, st]) => sum + st.count, 0) || 1

  return (
    <div className={s.infoSection}>
      <div className={s.sectionTitle}>来源构成</div>
      <div className={s.sourceRows}>
        {entries.map(([src, st]) => {
          const meta = SOURCE_META[src] || SOURCE_META.unknown
          return (
            <div key={src} className={s.sourceRow}>
              <span className={s.sourceName}>{meta.label}</span>
              <span className={s.sourceBar}><i style={{ width: `${(st.count / total) * 100}%`, background: meta.color }} /></span>
              <span className={s.sourceCount}>{st.count}</span>
            </div>
          )
        })}
      </div>
    </div>
  )
}

// ── 置信度提升对比 ────────────────────────────────────────────────────────────
function ConfBoost({ data, color }) {
  const { source_stats, fused_confidence, max_individual_conf, boost } = data
  const entries = Object.entries(source_stats)

  // 各来源颜色列表（按顺序取）
  const srcColors = entries.map(([src]) => (SOURCE_META[src] || SOURCE_META.unknown).color)

  return (
    <div className={s.infoSection}>
      <div className={s.sectionTitle}>置信度对比</div>

      <div className={s.barRows}>
        {/* 各来源最高置信度 */}
        {entries.map(([src, st], i) => (
          <div key={src} className={s.barRow}>
            <span className={s.barLabel}
              style={{ color: srcColors[i] + 'cc' }}>
              {(SOURCE_META[src] || SOURCE_META.unknown).label}
            </span>
            <div className={s.barTrack}>
              <div
                className={s.barFill}
                style={{ width: `${(st.max_conf * 100).toFixed(1)}%`, background: srcColors[i] + 'cc' }}
              />
            </div>
            <span className={s.barVal}>{(st.max_conf * 100).toFixed(1)}%</span>
          </div>
        ))}

        <div className={s.barDivider} />

        {/* 融合后 */}
        <div className={s.barRow}>
          <span className={s.barLabel} style={{ color, fontWeight: 700 }}>融合后</span>
          <div className={s.barTrack} style={{ border: `1px solid ${color}40` }}>
            <div
              className={s.barFill}
              style={{
                width: `${(fused_confidence * 100).toFixed(1)}%`,
                background: `linear-gradient(to right, ${color}cc, ${color})`,
              }}
            />
          </div>
          <span className={s.barVal} style={{ color, fontWeight: 700 }}>
            {(fused_confidence * 100).toFixed(1)}%
          </span>
        </div>
        <div className={s.boostNote}>较单源最高值提升 {(boost * 100).toFixed(1)}%</div>
      </div>
    </div>
  )
}

// ── 主组件 ────────────────────────────────────────────────────────────────────
export default function FusionModal({ recordId, onClose }) {
  const [data,    setData]    = useState(null)
  const [loading, setLoading] = useState(true)
  const [error,   setError]   = useState('')

  useEffect(() => {
    if (recordId == null) return
    setLoading(true)
    setError('')
    setData(null)
    getClusterFusion(recordId)
      .then(setData)
      .catch(e => setError(e.message || '加载失败'))
      .finally(() => setLoading(false))
  }, [recordId])

  const color = data?.color_hex || '#3b82f6'

  return (
    <div className={s.overlay} onClick={e => e.target === e.currentTarget && onClose()}>
      <div className={s.modal}>

        {/* ── 头部 ── */}
        <div className={s.header} style={{ borderTopColor: color }}>
          <div className={s.headerLeft}>
            <span className={s.dot} style={{ background: color, boxShadow: `0 0 8px ${color}` }} />
            <span className={s.title}>{data?.label_cn || '聚类证据'}</span>
            {data && (
              <span className={s.subtitle}>
                {data.total} 个视角
                {data.cluster_id ? ` · #${data.cluster_id.slice(0, 6)}` : ''}
              </span>
            )}
          </div>
          <div className={s.headerTag}>
            <svg width="11" height="11" viewBox="0 0 24 24" fill="none"
              stroke="currentColor" strokeWidth="2.2">
              <circle cx="12" cy="12" r="10"/>
              <line x1="2" y1="12" x2="22" y2="12"/>
              <path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"/>
            </svg>
            聚类证据
          </div>
          <button className={s.closeBtn} onClick={onClose}>×</button>
        </div>

        {/* ── 主体 ── */}
        <div className={s.body}>
          {loading && (
            <div className={s.center}>
              <div className={s.spinner} />
              <span>加载融合数据…</span>
            </div>
          )}

          {!loading && error && (
            <div className={s.center} style={{ color: '#ef4444' }}>{error}</div>
          )}

          {!loading && !error && data && (
            <>
              <EvidenceGallery evidence={data.evidence} color={color} />

              {/* 统计摘要行 */}
              <div className={s.statsRow}>
                <div className={s.statItem}>
                  <span className={s.statVal}>{data.total}</span>
                  <span className={s.statLabel}>观测记录</span>
                </div>
                <div className={s.statItem}>
                  <span className={s.statVal}>{Object.keys(data.source_stats).length}</span>
                  <span className={s.statLabel}>数据来源</span>
                </div>
                <div className={s.statItem}>
                  <span className={s.statVal} style={{ color }}>
                    {(data.fused_confidence * 100).toFixed(1)}%
                  </span>
                  <span className={s.statLabel}>融合置信度</span>
                </div>
                <div className={s.statItem}>
                  <span className={s.statVal}>{data.scatter_radius_m}m</span>
                  <span className={s.statLabel}>GPS 散布半径</span>
                </div>
              </div>

              {/* 双栏分析 */}
              <div className={s.analysisRow}>
                <SourceSummary sourceStats={data.source_stats} />
                <ConfBoost   data={data} color={color} />
              </div>

              {/* 底部说明 */}
              <div className={s.footerNote}>
                来自 {Object.keys(data.source_stats).length} 类数据源的 {data.total} 条观测记录已按位置、时间和病害类型聚合。
                当前簇 GPS 散布半径为 {data.scatter_radius_m}m，融合置信度为
                <strong style={{ color }}> {(data.fused_confidence * 100).toFixed(1)}%</strong>。
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  )
}
