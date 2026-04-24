import { useEffect, useState, useMemo } from 'react'
import ReactECharts from 'echarts-for-react'
import { getClusterTimeline } from '../../api/client'
import s from './TimelineModal.module.css'

const TREND_CONFIG = {
  deteriorating: { label: '持续恶化',     color: '#ef4444', arrow: '↑' },
  improving:     { label: '有改善趋势',   color: '#22c55e', arrow: '↓' },
  stable:        { label: '暂无明显变化', color: '#9ca3af', arrow: '—' },
}

function fmt(iso) {
  const d  = new Date(iso)
  const mm = String(d.getMonth() + 1).padStart(2, '0')
  const dd = String(d.getDate()).padStart(2, '0')
  return `${mm}-${dd}`
}

function fmtFull(iso) {
  return new Date(iso).toLocaleString('zh-CN', { hour12: false })
}

function fmtDate(iso) {
  return new Date(iso).toLocaleDateString('zh-CN', { year: 'numeric', month: 'numeric', day: 'numeric' })
}

// ── 损伤可视化卡片 ──────────────────────────────────────────────────────────────
function DamageCard({ entry, color, label, era, isCurrent = false }) {
  const conf  = entry?.confidence ?? 0
  const area  = entry?.bbox_area  ?? 0
  const thumb = entry?.thumbnail_b64 ?? null
  const W = 258, H = 162

  const borderStyle = {
    border: `1px solid ${isCurrent ? color + '60' : 'rgba(255,255,255,0.08)'}`,
    borderRadius: 8, overflow: 'hidden', position: 'relative',
    boxShadow: isCurrent ? `0 0 18px ${color}20` : 'none',
  }
  const scanLine = isCurrent && (
    <div style={{
      position: 'absolute', inset: 0, pointerEvents: 'none',
      background: `linear-gradient(to bottom, transparent 0%, ${color}18 50%, transparent 100%)`,
      animation: 'tlScan 2.8s ease-in-out infinite',
    }} />
  )
  const metaChip = (text, right = false) => (
    <div style={{
      position: 'absolute',
      top: right ? undefined : 8, bottom: right ? 8 : undefined,
      left: right ? undefined : 8, right: right ? 8 : undefined,
      background: 'rgba(0,0,0,0.72)', borderRadius: 4,
      padding: '2px 7px', fontSize: 10, fontWeight: 700,
      color: right ? 'rgba(255,255,255,0.45)' : color,
      fontFamily: "'SF Mono',monospace",
    }}>{text}</div>
  )

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 5, flex: 1, minWidth: 0 }}>
      {/* Era label */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
        <span style={{ fontSize: 9, letterSpacing: '0.14em', textTransform: 'uppercase', color: isCurrent ? color : 'rgba(255,255,255,0.25)' }}>
          {era}
        </span>
        {isCurrent && (
          <span style={{ fontSize: 8, color, background: color + '22', border: '1px solid ' + color + '44', borderRadius: 3, padding: '1px 5px', letterSpacing: '0.06em' }}>
            LATEST
          </span>
        )}
      </div>

      {/* Image / fallback SVG */}
      {thumb ? (
        <div style={{ ...borderStyle, width: W, height: H }}>
          <img
            src={thumb.startsWith('data:') ? thumb : `data:image/jpeg;base64,${thumb}`}
            style={{ width: W, height: H, objectFit: 'cover', display: 'block' }}
            alt="detection"
          />
          {metaChip(`${(conf * 100).toFixed(0)}%`)}
          {area > 0 && metaChip(area >= 1000 ? `${(area/1000).toFixed(1)}K px²` : `${area} px²`, true)}
          {scanLine}
        </div>
      ) : (
        /* SVG 合成可视化（无图时 fallback） */
        (() => {
          const MAX_AREA = 35000
          const scale = area > 0 ? Math.min(area / MAX_AREA, 1) : Math.min(conf, 0.9)
          const dW = Math.round(W * (0.18 + 0.52 * scale))
          const dH = Math.round(H * (0.20 + 0.48 * scale))
          const dX = Math.round((W - dW) / 2)
          const dY = Math.round((H - dH) / 2)
          const rx = label?.includes('坑槽') ? Math.round(Math.min(dW, dH) * 0.35) : 3
          const L  = 10
          const corners = [
            [dX, dY + L, dX, dY, dX + L, dY],
            [dX + dW - L, dY, dX + dW, dY, dX + dW, dY + L],
            [dX, dY + dH - L, dX, dY + dH, dX + L, dY + dH],
            [dX + dW - L, dY + dH, dX + dW, dY + dH, dX + dW, dY + dH - L],
          ]
          return (
            <div style={borderStyle}>
              <svg width={W} height={H} viewBox={`0 0 ${W} ${H}`} style={{ display: 'block' }}>
                <defs>
                  <linearGradient id={`rg${isCurrent}`} x1="0" y1="0" x2="1" y2="1">
                    <stop offset="0%" stopColor="#18202e" />
                    <stop offset="100%" stopColor="#0d1117" />
                  </linearGradient>
                </defs>
                <rect width={W} height={H} fill={`url(#rg${isCurrent})`} />
                {[...Array(9)].map((_, i) => (
                  <line key={i} x1={0} y1={18 + i * 17} x2={W} y2={18 + i * 17} stroke="rgba(255,255,255,0.025)" strokeWidth={1} />
                ))}
                <rect x={dX} y={dY} width={dW} height={dH} fill={color + (isCurrent ? '28' : '18')} stroke={color} strokeWidth={isCurrent ? 2 : 1.5} strokeDasharray={isCurrent ? 'none' : '5,3'} rx={rx} />
                {corners.map((pts, ci) => <polyline key={ci} points={pts.join(',')} fill="none" stroke={color} strokeWidth={2} strokeLinecap="round" />)}
                <rect x={dX + 5} y={dY + 5} width={38} height={16} rx={3} fill="rgba(0,0,0,0.75)" />
                <text x={dX + 8} y={dY + 16} fontSize={10} fill={color} fontWeight="700" fontFamily="'SF Mono',monospace">{(conf * 100).toFixed(0)}%</text>
                {area > 0 && <>
                  <rect x={dX + dW - 54} y={dY + dH - 21} width={50} height={16} rx={3} fill="rgba(0,0,0,0.7)" />
                  <text x={dX + dW - 50} y={dY + dH - 10} fontSize={9} fill="rgba(255,255,255,0.5)" fontFamily="'SF Mono',monospace">{area >= 1000 ? `${(area/1000).toFixed(1)}K` : area} px²</text>
                </>}
              </svg>
              {scanLine}
            </div>
          )
        })()
      )}

      {/* Metadata row */}
      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 10, color: 'rgba(255,255,255,0.3)', padding: '0 2px' }}>
        <span>{entry?.timestamp ? fmtDate(entry.timestamp) : '--'}</span>
        <span style={{ color: 'rgba(255,255,255,0.2)', letterSpacing: '0.04em' }}>#{entry?.id}</span>
      </div>
    </div>
  )
}

// ── 指标差值徽章 ────────────────────────────────────────────────────────────────
function DeltaBadge({ label, value, negative = false }) {
  const color = negative ? '#ef4444' : '#9ca3af'
  return (
    <div style={{
      display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2,
      padding: '6px 12px',
      background: negative ? 'rgba(239,68,68,0.07)' : 'rgba(255,255,255,0.04)',
      border: `1px solid ${negative ? 'rgba(239,68,68,0.2)' : 'rgba(255,255,255,0.07)'}`,
      borderRadius: 6,
    }}>
      <span style={{ fontSize: 13, fontWeight: 700, color, fontVariantNumeric: 'tabular-nums' }}>{value}</span>
      <span style={{ fontSize: 9, color: 'rgba(255,255,255,0.25)', letterSpacing: '0.08em' }}>{label}</span>
    </div>
  )
}

// ── 演化对比双屏对比 ────────────────────────────────────────────────────────────
function DualView({ data }) {
  const tl     = data.timeline
  const first  = tl[0]
  const latest = tl[tl.length - 1]
  const color  = data.color_hex || '#ef4444'

  const confDelta = (first?.confidence != null && latest?.confidence != null)
    ? +((latest.confidence - first.confidence) * 100).toFixed(1)
    : null
  const areaDelta = (first?.bbox_area != null && latest?.bbox_area != null)
    ? latest.bbox_area - first.bbox_area
    : null
  const days = (first?.timestamp && latest?.timestamp)
    ? Math.floor((new Date(latest.timestamp) - new Date(first.timestamp)) / 86400000)
    : null

  if (tl.length < 2) {
    return (
      <div style={{ textAlign: 'center', padding: '36px 0', color: 'rgba(255,255,255,0.3)', fontSize: 13 }}>
        需要至少 2 次检测记录才能进行演化对比分析
      </div>
    )
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
      {/* 变化摘要 */}
      <div style={{ display: 'flex', gap: 8, justifyContent: 'center', flexWrap: 'wrap' }}>
        {confDelta !== null && (
          <DeltaBadge label="置信度变化" value={`${confDelta > 0 ? '+' : ''}${confDelta}%`} negative={confDelta > 0} />
        )}
        {areaDelta !== null && (
          <DeltaBadge label="损伤面积" value={`${areaDelta > 0 ? '+' : ''}${areaDelta >= 1000 ? (areaDelta/1000).toFixed(1)+'K' : areaDelta} px²`} negative={areaDelta > 0} />
        )}
        {days !== null && days > 0 && (
          <DeltaBadge label="记录跨度" value={`${days} 天`} />
        )}
        <DeltaBadge label="检测次数" value={`${tl.length} 次`} />
      </div>

      {/* 双屏对比 */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
        <DamageCard entry={first}  color={color} label={data.label_cn} era="初次检测" />

        {/* 演变箭头 */}
        <div style={{ flexShrink: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4, padding: '0 4px' }}>
          <svg width={28} height={48} viewBox="0 0 28 48">
            <defs>
              <linearGradient id="arrowGrad" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%"   stopColor={color} stopOpacity="0.8" />
                <stop offset="100%" stopColor={color} stopOpacity="0.2" />
              </linearGradient>
            </defs>
            <line x1="14" y1="4" x2="14" y2="36" stroke="url(#arrowGrad)" strokeWidth="2" strokeDasharray="4,3" />
            <polyline points="7,30 14,42 21,30" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
          <span style={{ fontSize: 8, color: 'rgba(255,255,255,0.2)', letterSpacing: '0.12em', textTransform: 'uppercase', textAlign: 'center' }}>演变</span>
        </div>

        <DamageCard entry={latest} color={color} label={data.label_cn} era="最新检测" isCurrent />
      </div>

      {/* 时空演化说明 */}
      <div style={{
        padding: '10px 14px',
        background: 'rgba(255,255,255,0.025)',
        border: '1px solid rgba(255,255,255,0.06)',
        borderRadius: 8,
        fontSize: 12,
        color: 'rgba(255,255,255,0.35)',
        lineHeight: 1.6,
      }}>
        <span style={{ color: color, fontWeight: 600 }}>时序演化分析：</span>
        {' '}{data.label_cn}自{first?.timestamp ? fmtDate(first.timestamp) : '初次检测'}以来
        {confDelta !== null && confDelta > 0
          ? `，AI 置信度提升 ${confDelta}%，病害识别愈加清晰`
          : confDelta !== null && confDelta < 0
          ? `，置信度下降 ${Math.abs(confDelta)}%，可能经过局部修复`
          : '，病害状态相对稳定'}
        {areaDelta !== null && areaDelta > 0 ? `，损伤面积扩大约 ${areaDelta} px²` : ''}
        {days !== null && days > 0 ? `，持续追踪 ${days} 天` : ''}。
      </div>
    </div>
  )
}

// ── 主组件 ──────────────────────────────────────────────────────────────────────
export default function TimelineModal({ recordId, onClose }) {
  const [data,     setData]     = useState(null)
  const [loading,  setLoading]  = useState(true)
  const [error,    setError]    = useState('')
  const [viewMode, setViewMode] = useState('chart')   // 'chart' | 'compare'

  useEffect(() => {
    if (!recordId) return
    setLoading(true)
    setError('')
    setData(null)
    setViewMode('chart')
    getClusterTimeline(recordId)
      .then(setData)
      .catch(e => setError(e.message || '加载失败'))
      .finally(() => setLoading(false))
  }, [recordId])

  const chartOption = useMemo(() => {
    if (!data?.timeline?.length) return null

    const tl       = data.timeline
    const xData    = tl.map(t => fmt(t.timestamp))
    const confData = tl.map(t => t.confidence != null ? +(t.confidence * 100).toFixed(1) : null)
    const areaData = tl.map(t => t.bbox_area)
    const hasArea  = areaData.some(v => v != null)
    const color    = data.color_hex || '#ef4444'

    return {
      backgroundColor: 'transparent',
      tooltip: {
        trigger: 'axis',
        backgroundColor: 'rgba(8,12,26,0.95)',
        borderColor: 'rgba(255,255,255,0.1)',
        textStyle: { color: '#e5e7eb', fontSize: 12 },
        formatter: params => {
          const idx = params[0]?.dataIndex
          if (idx == null) return ''
          const entry = tl[idx]
          let html = `<div style="font-size:11px;color:#9ca3af;margin-bottom:4px;">${fmtFull(entry.timestamp)}</div>`
          params.forEach(p => {
            if (p.value == null) return
            html += `<div style="display:flex;align-items:center;gap:6px;margin:2px 0;">
              <span style="display:inline-block;width:8px;height:8px;border-radius:50%;background:${p.color};"></span>
              <span style="color:#9ca3af;">${p.seriesName}</span>
              <strong style="color:#fff;margin-left:auto;padding-left:12px;">${p.value}${p.seriesName === '置信度' ? '%' : ' px²'}</strong>
            </div>`
          })
          return html
        },
      },
      legend: {
        top: 6, left: 'center',
        textStyle: { color: '#9ca3af', fontSize: 11 },
        itemWidth: 12, itemHeight: 8, itemGap: 20,
      },
      grid: { left: 8, right: hasArea ? 48 : 8, bottom: 4, top: 34, containLabel: true },
      xAxis: {
        type: 'category', data: xData, boundaryGap: false,
        axisLabel: { color: 'rgba(255,255,255,0.3)', fontSize: 10 },
        axisLine: { lineStyle: { color: 'rgba(255,255,255,0.08)' } },
        axisTick: { show: false },
      },
      yAxis: [
        {
          type: 'value', min: 0, max: 100,
          axisLabel: { color: 'rgba(255,255,255,0.3)', fontSize: 10, formatter: v => `${v}%` },
          splitLine: { lineStyle: { color: 'rgba(255,255,255,0.05)', type: 'dashed' } },
        },
        ...(hasArea ? [{
          type: 'value',
          axisLabel: { color: 'rgba(255,255,255,0.3)', fontSize: 10, formatter: v => v >= 1000 ? `${(v/1000).toFixed(0)}K` : v },
          splitLine: { show: false },
        }] : []),
      ],
      series: [
        {
          name: '置信度', type: 'line', yAxisIndex: 0,
          data: confData, smooth: 0.3, connectNulls: true,
          lineStyle: { color, width: 2.5 },
          areaStyle: {
            color: { type: 'linear', x: 0, y: 0, x2: 0, y2: 1,
              colorStops: [{ offset: 0, color: color + '55' }, { offset: 1, color: color + '08' }],
            },
          },
          symbol: 'circle', symbolSize: 7,
          itemStyle: { color, borderColor: '#fff', borderWidth: 1.5 },
          markLine: tl.length >= 2 ? {
            silent: true,
            lineStyle: { color: 'rgba(255,255,255,0.12)', type: 'dashed' },
            data: [{ type: 'average', name: '均值', label: { color: 'rgba(255,255,255,0.3)', fontSize: 10, formatter: p => `均${p.value.toFixed(1)}%` } }],
          } : undefined,
        },
        ...(hasArea ? [{
          name: '损伤面积', type: 'bar', yAxisIndex: 1,
          data: areaData, barMaxWidth: 18,
          itemStyle: {
            color: { type: 'linear', x: 0, y: 0, x2: 0, y2: 1,
              colorStops: [{ offset: 0, color: 'rgba(249,115,22,0.75)' }, { offset: 1, color: 'rgba(249,115,22,0.15)' }],
            },
            borderRadius: [3, 3, 0, 0],
          },
        }] : []),
      ],
    }
  }, [data])

  const trend      = data ? TREND_CONFIG[data.trend] ?? TREND_CONFIG.stable : null
  const firstTs    = data?.timeline?.[0]?.timestamp
  const lastTs     = data?.timeline?.at?.(-1)?.timestamp
  const maxConf    = data?.timeline ? Math.max(...data.timeline.map(t => t.confidence ?? 0)) * 100 : 0
  const latestConf = data?.timeline?.at?.(-1)?.confidence != null
    ? (data.timeline.at(-1).confidence * 100).toFixed(1)
    : '--'
  const canCompare = (data?.total ?? 0) >= 2

  return (
    <div className={s.overlay} onClick={e => e.target === e.currentTarget && onClose()}>
      <div className={s.modal} style={{ width: viewMode === 'compare' ? 680 : 660 }}>

        {/* ── 顶部色带 ── */}
        <div className={s.header} style={{ borderBottom: `3px solid ${data?.color_hex || '#ef4444'}` }}>
          <div className={s.headerLeft}>
            <span className={s.dot} style={{ background: data?.color_hex || '#ef4444', boxShadow: `0 0 8px ${data?.color_hex || '#ef4444'}` }} />
            <span className={s.title}>{data?.label_cn || '演变时间轴'}</span>
            <span className={s.subtitle}>{data?.label || ''}</span>
          </div>

          {/* 视图切换 */}
          {!loading && !error && data && (
            <div style={{ display: 'flex', gap: 4, marginRight: 8 }}>
              {[
                { key: 'chart',   label: '趋势图' },
                { key: 'compare', label: '演化对比', disabled: !canCompare },
              ].map(({ key, label, disabled }) => (
                <button
                  key={key}
                  onClick={() => !disabled && setViewMode(key)}
                  disabled={disabled}
                  style={{
                    height: 24, padding: '0 10px',
                    background: viewMode === key ? (data?.color_hex || '#ef4444') + '28' : 'transparent',
                    border: `1px solid ${viewMode === key ? (data?.color_hex || '#ef4444') + '80' : 'rgba(255,255,255,0.12)'}`,
                    color: viewMode === key ? (data?.color_hex || '#ef4444') : disabled ? 'rgba(255,255,255,0.2)' : 'rgba(255,255,255,0.5)',
                    fontSize: 11, fontWeight: viewMode === key ? 600 : 400,
                    cursor: disabled ? 'not-allowed' : 'pointer',
                    borderRadius: 4,
                    transition: 'all 0.15s',
                    whiteSpace: 'nowrap',
                  }}
                  title={disabled ? '需要至少 2 次检测记录' : ''}
                >
                  {label}
                </button>
              ))}
            </div>
          )}

          {trend && (
            <span className={s.trendBadge} style={{ color: trend.color, borderColor: trend.color + '55', background: trend.color + '18' }}>
              {trend.arrow} {trend.label}
            </span>
          )}
          <button className={s.closeBtn} onClick={onClose}>×</button>
        </div>

        {/* ── 主体 ── */}
        <div className={s.body}>
          {loading && (
            <div className={s.center}>
              <div className={s.spinner} />
              <span>加载时间轴数据…</span>
            </div>
          )}

          {!loading && error && (
            <div className={s.center} style={{ color: '#ef4444' }}>{error}</div>
          )}

          {!loading && !error && data && (
            <>
              {/* 统计摘要 */}
              <div className={s.statsRow}>
                <div className={s.statItem}>
                  <span className={s.statVal}>{data.total}</span>
                  <span className={s.statLabel}>次检测</span>
                </div>
                <div className={s.statItem}>
                  <span className={s.statVal}>{latestConf}%</span>
                  <span className={s.statLabel}>最新置信度</span>
                </div>
                <div className={s.statItem}>
                  <span className={s.statVal}>{maxConf.toFixed(1)}%</span>
                  <span className={s.statLabel}>峰值置信度</span>
                </div>
                {firstTs && lastTs && firstTs !== lastTs && (
                  <div className={s.statItem}>
                    <span className={s.statVal}>{fmt(firstTs)} → {fmt(lastTs)}</span>
                    <span className={s.statLabel}>记录跨度</span>
                  </div>
                )}
              </div>

              {data.total === 1 && (
                <p className={s.hint}>仅有 1 次检测记录，积累更多巡检数据后可查看趋势及演化对比</p>
              )}

              {/* ── 趋势图模式 ── */}
              {viewMode === 'chart' && (
                <>
                  {chartOption && (
                    <ReactECharts option={chartOption} style={{ width: '100%', height: '240px' }} notMerge />
                  )}
                  {data.total > 1 && (
                    <div className={s.list}>
                      <div className={s.listHeader}>检测记录明细</div>
                      {[...data.timeline].reverse().map((entry, i) => (
                        <div key={entry.id} className={s.listRow}>
                          <span className={s.listIndex}>{data.total - i}</span>
                          <span className={s.listTime}>{fmtFull(entry.timestamp)}</span>
                          <span className={s.listConf} style={{ color: data.color_hex || '#ef4444' }}>
                            {entry.confidence != null ? `${(entry.confidence * 100).toFixed(1)}%` : '--'}
                          </span>
                          {entry.bbox_area != null && (
                            <span className={s.listArea}>
                              {entry.bbox_area >= 1000
                                ? `${(entry.bbox_area / 1000).toFixed(1)}K px²`
                                : `${entry.bbox_area} px²`}
                            </span>
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                </>
              )}

              {/* ── 演化对比对比模式 ── */}
              {viewMode === 'compare' && <DualView data={data} />}
            </>
          )}
        </div>
      </div>
    </div>
  )
}
