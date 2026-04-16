import { useEffect, useRef, useState, useMemo } from 'react';
import AMapLoader from '@amap/amap-jsapi-loader';
import ReactECharts from 'echarts-for-react';

const AMAP_KEY           = import.meta.env.VITE_AMAP_KEY;
const AMAP_SECURITY_CODE = import.meta.env.VITE_AMAP_SECURITY_CODE;

if (typeof window !== 'undefined' && !window._AMapSecurityConfig) {
  window._AMapSecurityConfig = { securityJsCode: AMAP_SECURITY_CODE };
}

// 注入帧动画（只注入一次）
if (typeof document !== 'undefined' && !document.getElementById('ls-dash-style')) {
  const el = document.createElement('style');
  el.id = 'ls-dash-style';
  el.textContent = `
    @keyframes dashFadeUp {
      from { opacity: 0; transform: translateY(8px); }
      to   { opacity: 1; transform: none; }
    }
    @keyframes dashBlink {
      0%, 100% { opacity: 1; }
      50%       { opacity: 0.3; }
    }
    @keyframes dashScan {
      0%   { transform: translateY(0); opacity: 0.6; }
      100% { transform: translateY(100%); opacity: 0; }
    }
  `;
  document.head.appendChild(el);
}

const HEAT_WEIGHT = { D40: 1.0, D20: 0.7, D10: 0.5, D00: 0.3 };

const BLUE  = '#00d4ff';
const GREEN = '#39ff14';
const DIM   = 'rgba(255,255,255,0.25)';
const PANEL_BG     = 'rgba(0,200,255,0.03)';
const PANEL_BORDER = 'rgba(0,200,255,0.12)';

function panelStyle(accent = BLUE) {
  return {
    background: PANEL_BG,
    border: `1px solid ${PANEL_BORDER}`,
    borderTop: `2px solid ${accent}`,
  };
}

function timeAgo(ts) {
  if (!ts) return '--';
  const diff = Date.now() - new Date(ts).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1)  return '刚刚';
  if (mins < 60) return `${mins}分钟前`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24)  return `${hrs}小时前`;
  return `${Math.floor(hrs / 24)}天前`;
}

function SectionLabel({ children }) {
  return (
    <div style={{
      fontSize: 10, fontWeight: 700,
      letterSpacing: '0.14em', textTransform: 'uppercase',
      color: 'rgba(255,255,255,0.3)',
      marginBottom: 6, flexShrink: 0,
      display: 'flex', alignItems: 'center', gap: 6,
    }}>
      <span style={{ width: 6, height: 6, borderRadius: '50%', background: BLUE, display: 'inline-block', animation: 'dashBlink 2s ease infinite' }} />
      {children}
    </div>
  );
}

export default function DashboardPanel({ onExit }) {
  const [records,  setRecords]  = useState([]);
  const [stats,    setStats]    = useState(null);
  const [now,      setNow]      = useState(new Date());
  const [mapReady, setMapReady] = useState(false);
  const [tickIdx,  setTickIdx]  = useState(0);

  const mapRef     = useRef(null);
  const mapObjRef  = useRef(null);
  const heatmapRef = useRef(null);

  // 实时时钟
  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(t);
  }, []);

  // 数据加载（30s 自动刷新）
  const load = () => {
    fetch('/api/v1/gis/records?limit=500')
      .then(r => r.json()).then(d => setRecords(d || [])).catch(() => {});
    fetch('/api/v1/gis/stats')
      .then(r => r.json()).then(setStats).catch(() => {});
  };
  useEffect(() => {
    load();
    const t = setInterval(load, 30000);
    return () => clearInterval(t);
  }, []);

  // 右侧记录轮播（每 3.5s 切一格）
  useEffect(() => {
    const t = setInterval(() => setTickIdx(i => i + 1), 3500);
    return () => clearInterval(t);
  }, []);

  // 高德地图初始化
  useEffect(() => {
    AMapLoader.load({
      key: AMAP_KEY,
      version: '2.0',
      plugins: ['AMap.HeatMap'],
    }).then(AMap => {
      if (!mapRef.current) return;
      const map = new AMap.Map(mapRef.current, {
        viewMode: '3D',
        pitch: 45,
        zoom: 13,
        center: [114.405, 30.482],
        mapStyle: 'amap://styles/darkblue',
      });
      mapObjRef.current = map;
      setMapReady(true);
    }).catch(e => console.error('AMap load error:', e));

    return () => {
      if (mapObjRef.current) {
        mapObjRef.current.destroy();
        mapObjRef.current = null;
        heatmapRef.current = null;
        setMapReady(false);
      }
    };
  }, []);

  // 热力图层
  useEffect(() => {
    if (!mapReady || !mapObjRef.current || records.length === 0) return;

    const heatData = records
      .filter(r => r.lat && r.lng && parseFloat(r.lat) !== 0 && parseFloat(r.lng) !== 0)
      .map(r => ({
        lng: parseFloat(r.lng),
        lat: parseFloat(r.lat),
        count: HEAT_WEIGHT[r.label] ?? 0.3,
      }));

    if (!heatmapRef.current) {
      heatmapRef.current = new window.AMap.HeatMap(mapObjRef.current, {
        radius: 40,
        opacity: [0, 0.88],
        gradient: {
          0.2: '#39ff14',
          0.5: '#00d4ff',
          0.75: '#f97316',
          1.0:  '#ef4444',
        },
        zooms: [3, 20],
      });
    }
    heatmapRef.current.setDataSet({ data: heatData, max: 1.0 });
    heatmapRef.current.show();
  }, [mapReady, records]);

  // ── 最新记录（轮播取 5 条）
  const latest = useMemo(() =>
    [...records].sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp)),
  [records]);

  const tickerItems = useMemo(() => {
    if (latest.length === 0) return [];
    const count = Math.min(5, latest.length);
    return Array.from({ length: count }, (_, i) => latest[(tickIdx + i) % latest.length]);
  }, [latest, tickIdx]);

  // ── 饼图（中心显示总数）
  const total = records.length;
  const pieOption = useMemo(() => {
    const counts = {};
    records.forEach(r => {
      const name = r.label_cn || '未知';
      counts[name] = (counts[name] || 0) + 1;
    });
    const colorMap = { '坑槽': '#ef4444', '网状裂缝': '#f59e0b', '纵横裂缝': '#f97316', '横向裂缝': '#3b82f6' };
    const data = Object.entries(counts).map(([name, value]) => ({
      name, value,
      itemStyle: {
        color: Object.entries(colorMap).find(([k]) => name.includes(k))?.[1] || '#6366f1',
      },
    }));
    return {
      backgroundColor: 'transparent',
      tooltip: {
        trigger: 'item',
        backgroundColor: 'rgba(8,12,26,0.95)',
        borderColor: 'rgba(0,212,255,0.25)',
        textStyle: { color: '#fff', fontSize: 12 },
        formatter: '{b}: {c} ({d}%)',
      },
      graphic: [
        {
          type: 'text', left: 'center', top: '42%',
          style: { text: String(total), fill: '#fff', font: 'bold 26px sans-serif' },
        },
        {
          type: 'text', left: 'center', top: '57%',
          style: { text: '总计', fill: 'rgba(255,255,255,0.35)', font: '10px sans-serif' },
        },
      ],
      series: [{
        type: 'pie',
        radius: ['44%', '66%'],
        center: ['50%', '52%'],
        avoidLabelOverlap: true,
        itemStyle: { borderRadius: 4, borderColor: 'rgba(8,12,26,0.85)', borderWidth: 2 },
        label: {
          show: true,
          position: 'outside',
          color: 'rgba(255,255,255,0.6)',
          fontSize: 10,
          formatter: '{b}\n{d}%',
          lineHeight: 14,
        },
        labelLine: { length: 8, length2: 6, lineStyle: { color: 'rgba(255,255,255,0.2)' } },
        data: data.length > 0 ? data : [{ name: '暂无数据', value: 0, itemStyle: { color: '#333' } }],
      }],
    };
  }, [records, total]);

  // ── 折线图
  const lineOption = useMemo(() => {
    const daily = stats?.daily ?? [];
    const xData = daily.length > 0
      ? daily.map(d => {
          const date  = new Date(d.date + 'T00:00:00');
          const days  = ['周日', '周一', '周二', '周三', '周四', '周五', '周六'];
          const today = new Date().toISOString().slice(0, 10);
          return d.date === today ? '今日' : days[date.getDay()];
        })
      : ['周一', '周二', '周三', '周四', '周五', '周六', '今日'];
    const yData = daily.length > 0 ? daily.map(d => d.count) : Array(7).fill(0);

    return {
      backgroundColor: 'transparent',
      tooltip: {
        trigger: 'axis',
        backgroundColor: 'rgba(8,12,26,0.95)',
        borderColor: 'rgba(57,255,20,0.25)',
        textStyle: { color: '#fff', fontSize: 11 },
      },
      grid: { left: '2%', right: '3%', bottom: '3%', top: '10%', containLabel: true },
      xAxis: {
        type: 'category',
        boundaryGap: false,
        data: xData,
        axisLabel: { color: 'rgba(255,255,255,0.3)', fontSize: 9 },
        axisLine: { lineStyle: { color: 'rgba(255,255,255,0.08)' } },
        axisTick: { show: false },
      },
      yAxis: {
        type: 'value',
        minInterval: 1,
        axisLabel: { color: 'rgba(255,255,255,0.3)', fontSize: 9 },
        splitLine: { lineStyle: { color: 'rgba(255,255,255,0.05)', type: 'dashed' } },
      },
      series: [{
        type: 'line',
        smooth: 0.4,
        data: yData,
        lineStyle: { color: GREEN, width: 1.5 },
        areaStyle: {
          color: {
            type: 'linear', x: 0, y: 0, x2: 0, y2: 1,
            colorStops: [
              { offset: 0, color: 'rgba(57,255,20,0.28)' },
              { offset: 1, color: 'rgba(57,255,20,0)' },
            ],
          },
        },
        symbol: 'circle',
        symbolSize: 5,
        itemStyle: { color: GREEN, borderColor: '#080c14', borderWidth: 1.5 },
      }],
    };
  }, [stats]);

  // ── 顶部统计
  const weekTotal  = stats?.daily?.reduce((a, d) => a + d.count, 0) ?? 0;
  const todayCount = stats?.daily?.at(-1)?.count ?? 0;

  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 9000,
      background: '#080c14',
      display: 'flex', flexDirection: 'column',
      fontFamily: '-apple-system, "PingFang SC", "SF Mono", monospace',
      overflow: 'hidden',
      color: '#fff',
    }}>

      {/* ────────── 顶部栏 ────────── */}
      <div style={{
        height: 52, flexShrink: 0,
        display: 'flex', alignItems: 'center',
        padding: '0 20px',
        background: 'rgba(0,0,0,0.55)',
        borderBottom: `1px solid ${PANEL_BORDER}`,
        gap: 0,
      }}>
        {/* 品牌标题 */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginRight: 28 }}>
          <span style={{ width: 3, height: 18, background: BLUE, display: 'inline-block', flexShrink: 0 }} />
          <span style={{ fontSize: 13, fontWeight: 800, letterSpacing: '0.18em', textTransform: 'uppercase', color: BLUE }}>
            LightScan
          </span>
          <span style={{ fontSize: 11, color: 'rgba(255,255,255,0.35)', letterSpacing: '0.06em' }}>
            · 路政态势感知大屏
          </span>
        </div>

        {/* 中央统计数字 */}
        <div style={{ flex: 1, display: 'flex', justifyContent: 'center', gap: 40 }}>
          {[
            { label: '累计病害', value: total,      accent: BLUE  },
            { label: '今日新增', value: todayCount, accent: GREEN },
            { label: '七日合计', value: weekTotal,  accent: '#f97316' },
          ].map(item => (
            <div key={item.label} style={{ display: 'flex', alignItems: 'baseline', gap: 6 }}>
              <span style={{
                fontSize: 24, fontWeight: 700,
                color: item.accent,
                fontVariantNumeric: 'tabular-nums',
                textShadow: `0 0 16px ${item.accent}80`,
              }}>
                {item.value}
              </span>
              <span style={{ fontSize: 9, color: 'rgba(255,255,255,0.3)', letterSpacing: '0.1em', textTransform: 'uppercase' }}>
                {item.label}
              </span>
            </div>
          ))}
        </div>

        {/* 时钟 + 退出 */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
          <span style={{
            fontSize: 12, color: 'rgba(255,255,255,0.35)',
            fontVariantNumeric: 'tabular-nums',
            letterSpacing: '0.05em',
          }}>
            {now.toLocaleString('zh-CN', { hour12: false })}
          </span>
          <button
            onClick={onExit}
            style={{
              height: 26, padding: '0 14px',
              background: 'transparent',
              border: '1px solid rgba(255,255,255,0.15)',
              color: 'rgba(255,255,255,0.4)',
              fontSize: 11, fontWeight: 500,
              cursor: 'pointer',
              letterSpacing: '0.06em',
              transition: 'all 0.15s',
            }}
            onMouseEnter={e => {
              e.currentTarget.style.borderColor = BLUE;
              e.currentTarget.style.color = BLUE;
            }}
            onMouseLeave={e => {
              e.currentTarget.style.borderColor = 'rgba(255,255,255,0.15)';
              e.currentTarget.style.color = 'rgba(255,255,255,0.4)';
            }}
          >
            退出大屏
          </button>
        </div>
      </div>

      {/* ────────── 主内容区 ────────── */}
      <div style={{ flex: 1, display: 'flex', overflow: 'hidden', minHeight: 0 }}>

        {/* ── 左侧面板：图表 ── */}
        <div style={{
          width: 288, flexShrink: 0,
          display: 'flex', flexDirection: 'column',
          padding: '12px 10px 12px 14px',
          gap: 10,
          borderRight: `1px solid ${PANEL_BORDER}`,
          background: 'rgba(0,0,0,0.35)',
        }}>

          {/* 饼图 */}
          <div style={{
            ...panelStyle(BLUE),
            flex: 1,
            padding: '10px 12px',
            display: 'flex', flexDirection: 'column',
            minHeight: 0,
          }}>
            <SectionLabel>病害类型占比</SectionLabel>
            <div style={{ flex: 1, minHeight: 0 }}>
              <ReactECharts option={pieOption} style={{ height: '100%', width: '100%' }} />
            </div>
          </div>

          {/* 折线图 */}
          <div style={{
            ...panelStyle(GREEN),
            flex: 1,
            padding: '10px 12px',
            display: 'flex', flexDirection: 'column',
            minHeight: 0,
          }}>
            <SectionLabel>近七日检出趋势</SectionLabel>
            <div style={{ flex: 1, minHeight: 0 }}>
              <ReactECharts option={lineOption} style={{ height: '100%', width: '100%' }} />
            </div>
          </div>
        </div>

        {/* ── 中央地图 ── */}
        <div style={{ flex: 1, position: 'relative', minWidth: 0 }}>
          <div ref={mapRef} style={{ width: '100%', height: '100%', background: '#090a0f' }} />

          {/* 扫描线效果 */}
          <div style={{
            position: 'absolute', inset: 0, pointerEvents: 'none', overflow: 'hidden',
          }}>
            <div style={{
              position: 'absolute', left: 0, right: 0, top: 0, height: '30%',
              background: 'linear-gradient(to bottom, rgba(0,212,255,0.04), transparent)',
              animation: 'dashScan 4s linear infinite',
            }} />
          </div>

          {/* 左下标签 */}
          <div style={{
            position: 'absolute', bottom: 14, left: 14,
            fontSize: 9, color: 'rgba(255,255,255,0.2)',
            letterSpacing: '0.14em', textTransform: 'uppercase',
            pointerEvents: 'none',
          }}>
            3D 热力图 · 实时数据
          </div>

          {/* 右下图例 */}
          <div style={{
            position: 'absolute', bottom: 14, right: 14,
            display: 'flex', gap: 10, alignItems: 'center',
            pointerEvents: 'none',
          }}>
            {[
              { label: '低密度', color: '#39ff14' },
              { label: '中密度', color: '#00d4ff' },
              { label: '高密度', color: '#f97316' },
              { label: '极高',   color: '#ef4444' },
            ].map(item => (
              <div key={item.label} style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                <span style={{ width: 8, height: 8, borderRadius: '50%', background: item.color, display: 'inline-block' }} />
                <span style={{ fontSize: 9, color: 'rgba(255,255,255,0.35)', letterSpacing: '0.06em' }}>{item.label}</span>
              </div>
            ))}
          </div>
        </div>

        {/* ── 右侧面板：最新记录 ── */}
        <div style={{
          width: 264, flexShrink: 0,
          display: 'flex', flexDirection: 'column',
          padding: '12px 14px 12px 10px',
          gap: 8,
          borderLeft: `1px solid ${PANEL_BORDER}`,
          background: 'rgba(0,0,0,0.35)',
        }}>
          <div style={{ flexShrink: 0 }}>
            <SectionLabel>最新巡检记录</SectionLabel>
          </div>

          {/* 记录卡片 */}
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 8, minHeight: 0 }}>
            {tickerItems.length === 0 ? (
              <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'rgba(255,255,255,0.15)', fontSize: 12 }}>
                暂无巡检数据
              </div>
            ) : tickerItems.map((r, i) => r && (
              <div
                key={`${r.id}-${tickIdx}-${i}`}
                style={{
                  ...panelStyle(r.color_hex || BLUE),
                  flex: 1,
                  padding: '10px 12px',
                  display: 'flex', flexDirection: 'column', justifyContent: 'space-between',
                  borderLeft: `3px solid ${r.color_hex || BLUE}`,
                  gap: 6,
                  minHeight: 0,
                  animation: 'dashFadeUp 0.4s ease both',
                  animationDelay: `${i * 60}ms`,
                }}
              >
                {/* 顶部：标签 + 时间 */}
                <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 6 }}>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                    <span style={{
                      fontSize: 12, fontWeight: 700,
                      color: r.color_hex || BLUE,
                      textShadow: `0 0 8px ${r.color_hex || BLUE}60`,
                    }}>
                      {r.label_cn || r.label || '—'}
                    </span>
                    <span style={{ fontSize: 9, color: 'rgba(255,255,255,0.3)', letterSpacing: '0.06em' }}>
                      #{r.id}
                    </span>
                  </div>
                  <span style={{
                    fontSize: 9, color: 'rgba(255,255,255,0.25)',
                    fontVariantNumeric: 'tabular-nums', whiteSpace: 'nowrap',
                    paddingTop: 2,
                  }}>
                    {timeAgo(r.timestamp)}
                  </span>
                </div>

                {/* 置信度进度条 */}
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <div style={{ flex: 1, height: 2, background: 'rgba(255,255,255,0.07)', borderRadius: 1 }}>
                    <div style={{
                      height: '100%',
                      width: `${r.confidence != null ? r.confidence * 100 : 0}%`,
                      background: r.color_hex || BLUE,
                      borderRadius: 1,
                      boxShadow: `0 0 6px ${r.color_hex || BLUE}80`,
                    }} />
                  </div>
                  <span style={{
                    fontSize: 10, fontWeight: 600,
                    color: r.color_hex || BLUE,
                    fontVariantNumeric: 'tabular-nums',
                    whiteSpace: 'nowrap',
                  }}>
                    {r.confidence != null ? `${(r.confidence * 100).toFixed(1)}%` : '--'}
                  </span>
                </div>

                {/* 坐标 */}
                {r.lat != null && r.lng != null && (
                  <div style={{
                    fontSize: 9, color: 'rgba(255,255,255,0.2)',
                    fontVariantNumeric: 'tabular-nums',
                    letterSpacing: '0.04em',
                  }}>
                    {parseFloat(r.lat).toFixed(5)}, {parseFloat(r.lng).toFixed(5)}
                  </div>
                )}
              </div>
            ))}
          </div>

          {/* 底部刷新提示 */}
          <div style={{
            flexShrink: 0,
            paddingTop: 6,
            display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
          }}>
            <span style={{ width: 5, height: 5, borderRadius: '50%', background: GREEN, display: 'inline-block', animation: 'dashBlink 2s ease infinite' }} />
            <span style={{ fontSize: 9, color: 'rgba(255,255,255,0.15)', letterSpacing: '0.08em' }}>
              30s 自动刷新
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}
