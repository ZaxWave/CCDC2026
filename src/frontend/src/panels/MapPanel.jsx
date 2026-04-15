import { useEffect, useRef, useState, useMemo } from 'react';
import AMapLoader from '@amap/amap-jsapi-loader';
import s from './MapPanel.module.css';
import ReactECharts from 'echarts-for-react';

const AMAP_KEY           = import.meta.env.VITE_AMAP_KEY           ;
const AMAP_SECURITY_CODE = import.meta.env.VITE_AMAP_SECURITY_CODE ;

window._AMapSecurityConfig = {
  securityJsCode: AMAP_SECURITY_CODE,
};

// 注入脉冲动画（只注入一次）
if (!document.getElementById('ls-map-style')) {
  const el = document.createElement('style');
  el.id = 'ls-map-style';
  el.textContent = `
    @keyframes ls-pulse {
      0%   { transform: scale(1);   box-shadow: 0 0 0 0   rgba(255,255,255,0.6); }
      50%  { transform: scale(1.35);box-shadow: 0 0 0 8px rgba(255,255,255,0); }
      100% { transform: scale(1);   box-shadow: 0 0 0 0   rgba(255,255,255,0); }
    }
  `;
  document.head.appendChild(el);
}

export default function MapPanel() {
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);
  const mapRef = useRef(null);
  const mapObjRef = useRef(null);
  const markersDataRef = useRef([]);    // 存 {marker, item} 供样式更新 effect 使用
  const [mapInstance, setMapInstance] = useState(null);
  const [records, setRecords] = useState([]);
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const [selectedType, setSelectedType] = useState(null); // 饼图点击筛选的病害类型

  // 初始化地图
  // cleanup 使用 mapObjRef（ref 不受闭包旧值影响），确保 StrictMode 双执行时
  // 第一个 map 实例被正确销毁，第二次不会在同一容器上叠加创建。
  useEffect(() => {
    AMapLoader.load({
      key: AMAP_KEY,
      version: "2.0",
      plugins: ['AMap.Scale', 'AMap.ToolBar'],
    }).then((AMap) => {
      const map = new AMap.Map(mapRef.current, {
        viewMode: '3D',
        zoom: 14,
        center: [114.405, 30.482],
        mapStyle: 'amap://styles/darkblue',
      });
      mapObjRef.current = map;
      setMapInstance(map);
    }).catch(e => console.error("高德地图加载失败:", e));

    return () => {
      if (mapObjRef.current) {
        mapObjRef.current.destroy();
        mapObjRef.current = null;
        setMapInstance(null);
      }
    };
  }, []);

  // 获取病害记录
  useEffect(() => {
    fetch('/api/v1/gis/records?limit=500')
      .then(res => res.json())
      .then(data => {
        setRecords(data || []);
        setLoading(false);
      })
      .catch(err => {
        console.error("获取病害记录失败:", err);
        setLoading(false);
      });
  }, []);

  // 获取近 7 日真实统计数据
  useEffect(() => {
    fetch('/api/v1/gis/stats')
      .then(res => res.json())
      .then(data => setStats(data))
      .catch(err => console.error("获取统计数据失败:", err));
  }, []);

  // marker 内容生成器
  function mkContent(color, mode) {
    if (mode === 'pulse') return `<div style="background:${color};width:18px;height:18px;border-radius:50%;border:2px solid #fff;box-shadow:0 0 15px ${color};animation:ls-pulse 1s ease-in-out infinite;cursor:pointer;"></div>`;
    if (mode === 'dim')   return `<div style="background:${color};width:9px;height:9px;border-radius:50%;border:1px solid rgba(255,255,255,0.2);opacity:0.2;cursor:pointer;"></div>`;
    return `<div style="background:${color};width:14px;height:14px;border-radius:50%;border:2px solid #fff;box-shadow:0 0 15px ${color};cursor:pointer;"></div>`;
  }

  // 动态打点 + InfoWindow 点击详情
  useEffect(() => {
    if (!mapInstance) return;

    mapInstance.clearMap();
    markersDataRef.current = [];
    if (records.length === 0) return;

    // 共享一个 InfoWindow 实例（避免多次 new 的性能开销）
    const infoWindow = new window.AMap.InfoWindow({
      isCustom: true,
      autoMove: true,
      offset: new window.AMap.Pixel(0, -22),
    });

    // 将 close 挂到 window，供 InfoWindow 内部 HTML 的 onclick 调用
    window.__lsCloseInfoWindow = () => infoWindow.close();

    // 点击地图空白处关闭
    mapInstance.on('click', () => infoWindow.close());

    records.forEach(item => {
      const lng = parseFloat(item?.lng);
      const lat = parseFloat(item?.lat);
      if (!isNaN(lng) && !isNaN(lat) && lng !== 0 && lat !== 0) {
        try {
          const color = item.color_hex || '#ff4444';
          const conf  = item.confidence != null ? (item.confidence * 100).toFixed(1) : '--';
          const ts    = item.timestamp
            ? new Date(item.timestamp).toLocaleString('zh-CN', { hour12: false })
            : '--';

          const marker = new window.AMap.Marker({
            position: [lng, lat],
            title: item.label_cn || '病害',
            content: mkContent(color, 'normal'),
          });

          markersDataRef.current.push({ marker, item });

          marker.on('click', () => {
            const html = `
              <div style="
                background:rgba(8,12,26,0.96);
                border:1px solid rgba(255,255,255,0.12);
                border-radius:10px;
                padding:0;
                min-width:220px;
                font-family:-apple-system,'PingFang SC',sans-serif;
                box-shadow:0 8px 32px rgba(0,0,0,0.6);
                overflow:hidden;
              ">
                <!-- 顶部色带 + 标题 -->
                <div style="
                  background:${color};
                  padding:10px 14px 8px;
                  display:flex;align-items:center;gap:8px;
                ">
                  <span style="
                    font-size:15px;font-weight:700;color:#fff;
                    text-shadow:0 1px 4px rgba(0,0,0,0.4);
                  ">${item.label_cn || '未知病害'}</span>
                  <span style="
                    margin-left:auto;font-size:11px;
                    background:rgba(0,0,0,0.25);
                    color:#fff;border-radius:4px;padding:1px 6px;
                  ">${item.label || ''}</span>
                </div>
                <!-- 详情区 -->
                <div style="padding:12px 14px;display:flex;flex-direction:column;gap:8px;">
                  <!-- 置信度 -->
                  <div>
                    <div style="display:flex;justify-content:space-between;margin-bottom:4px;">
                      <span style="font-size:11px;color:#9ca3af;">置信度</span>
                      <span style="font-size:12px;font-weight:600;color:#fff;">${conf}%</span>
                    </div>
                    <div style="height:4px;border-radius:2px;background:rgba(255,255,255,0.1);">
                      <div style="height:100%;border-radius:2px;width:${conf}%;background:${color};transition:width 0.3s;"></div>
                    </div>
                  </div>
                  <!-- 坐标 -->
                  <div style="display:flex;gap:6px;">
                    <span style="font-size:11px;color:#9ca3af;white-space:nowrap;">经纬度</span>
                    <span style="font-size:11px;color:#e5e7eb;font-variant-numeric:tabular-nums;">
                      ${lat.toFixed(5)}, ${lng.toFixed(5)}
                    </span>
                  </div>
                  <!-- 时间 -->
                  <div style="display:flex;gap:6px;">
                    <span style="font-size:11px;color:#9ca3af;white-space:nowrap;">检测时间</span>
                    <span style="font-size:11px;color:#e5e7eb;">${ts}</span>
                  </div>
                  <!-- 文件名 -->
                  ${item.filename ? `
                  <div style="display:flex;gap:6px;">
                    <span style="font-size:11px;color:#9ca3af;white-space:nowrap;">来源文件</span>
                    <span style="font-size:11px;color:#e5e7eb;word-break:break-all;">${item.filename}</span>
                  </div>` : ''}
                </div>
                <!-- 关闭按钮：调用 window.__lsCloseInfoWindow() 真正关闭 InfoWindow -->
                <div
                  onclick="window.__lsCloseInfoWindow()"
                  style="
                    position:absolute;top:8px;right:10px;
                    color:rgba(255,255,255,0.6);font-size:16px;
                    cursor:pointer;line-height:1;
                  ">×</div>
              </div>
            `;
            infoWindow.setContent(html);
            infoWindow.open(mapInstance, marker.getPosition());
          });

          mapInstance.add(marker);
        } catch (_) {}
      }
    });
  }, [mapInstance, records]);

  // 根据 selectedType 更新所有 marker 的外观
  useEffect(() => {
    markersDataRef.current.forEach(({ marker, item }) => {
      const color = item.color_hex || '#ff4444';
      if (!selectedType) {
        marker.setContent(mkContent(color, 'normal'));
      } else if (item.label_cn === selectedType) {
        marker.setContent(mkContent(color, 'pulse'));
      } else {
        marker.setContent(mkContent(color, 'dim'));
      }
    });
  }, [selectedType]);

  // [图表 1] 病害类型占比环形图
  const pieOption = useMemo(() => {
    const counts = {};
    records.forEach(r => {
      const name = r.label_cn || '未知类型';
      counts[name] = (counts[name] || 0) + 1;
    });
    const data = Object.keys(counts).map(key => ({
      name: key,
      value: counts[key],
      itemStyle: { color: key.includes('坑槽') ? '#ef4444' : (key.includes('裂缝') ? '#f59e0b' : '#3b82f6') }
    }));
    return {
      tooltip: { trigger: 'item', backgroundColor: 'rgba(10, 15, 30, 0.9)', borderColor: '#3b82f6', textStyle: { color: '#fff' } },
      legend: { top: 'bottom', textStyle: { color: '#9ca3af' } },
      series: [{
        name: '病害类型', type: 'pie', radius: ['50%', '70%'], avoidLabelOverlap: false,
        itemStyle: { borderRadius: 8, borderColor: 'rgba(10, 15, 30, 0.85)', borderWidth: 2 },
        label: { show: false, position: 'center' },
        emphasis: { label: { show: true, fontSize: 16, fontWeight: 'bold', color: '#fff' } },
        labelLine: { show: false },
        data: data.length > 0 ? data : [{ name: '暂无数据', value: 0 }]
      }]
    };
  }, [records]);

  // [图表 2] 近七日检出趋势折线图（真实数据）
  const lineOption = useMemo(() => {
    const daily = stats?.daily ?? [];
    const xData = daily.length > 0
      ? daily.map(d => {
          const date = new Date(d.date + 'T00:00:00');
          const days = ['周日', '周一', '周二', '周三', '周四', '周五', '周六'];
          const isToday = d.date === new Date().toISOString().slice(0, 10);
          return isToday ? '今日' : days[date.getDay()];
        })
      : ['周一', '周二', '周三', '周四', '周五', '周六', '今日'];
    const yData = daily.length > 0 ? daily.map(d => d.count) : [0, 0, 0, 0, 0, 0, 0];
    return {
      tooltip: { trigger: 'axis', backgroundColor: 'rgba(10, 15, 30, 0.9)', borderColor: '#3b82f6', textStyle: { color: '#fff' } },
      grid: { left: '3%', right: '4%', bottom: '3%', top: '10%', containLabel: true },
      xAxis: {
        type: 'category', boundaryGap: false, data: xData,
        axisLabel: { color: '#9ca3af' }, axisLine: { lineStyle: { color: '#374151' } }
      },
      yAxis: {
        type: 'value', minInterval: 1,
        axisLabel: { color: '#9ca3af' }, splitLine: { lineStyle: { color: '#1f2937', type: 'dashed' } }
      },
      series: [{
        name: '检出数量', type: 'line', smooth: true, data: yData,
        lineStyle: { color: '#3b82f6', width: 3 },
        areaStyle: {
          color: { type: 'linear', x: 0, y: 0, x2: 0, y2: 1, colorStops: [
            { offset: 0, color: 'rgba(59, 130, 246, 0.5)' },
            { offset: 1, color: 'rgba(59, 130, 246, 0)' }
          ]}
        },
        symbol: 'circle', symbolSize: 8, itemStyle: { color: '#60a5fa', borderColor: '#fff', borderWidth: 2 }
      }]
    };
  }, [stats]);

  const totalCount = loading ? '-' : (stats?.total ?? records.length);

  return (
    <div className={s.container} style={{ position: 'relative', width: '100%', height: 'calc(100vh - 60px)', overflow: 'hidden' }}>
      {/* 地图底层 */}
      <div ref={mapRef} style={{ width: '100%', height: '100%', background: '#090a0f' }}></div>

      {/* 可收起的数据仪表盘 */}
      <div style={{
        position: 'absolute', top: '20px', bottom: '20px',
        left: isSidebarOpen ? '20px' : '-340px', width: '320px',
        background: 'rgba(10, 15, 30, 0.85)', backdropFilter: 'blur(10px)',
        border: '1px solid rgba(255,255,255,0.1)', borderRadius: '12px',
        display: 'flex', flexDirection: 'column', zIndex: 999,
        transition: 'all 0.4s cubic-bezier(0.4, 0, 0.2, 1)',
      }}>
        <div onClick={() => setIsSidebarOpen(!isSidebarOpen)} style={{
          position: 'absolute', right: '-35px', top: '20px',
          width: '35px', height: '60px',
          background: 'rgba(10, 15, 30, 0.85)', backdropFilter: 'blur(10px)',
          border: '1px solid rgba(255,255,255,0.1)', borderLeft: 'none',
          borderRadius: '0 8px 8px 0',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          cursor: 'pointer', color: '#60a5fa', fontSize: '12px',
          boxShadow: '4px 0 10px rgba(0,0,0,0.3)'
        }}>
          {isSidebarOpen ? '◀' : '▶'}
        </div>

        <div style={{
          opacity: isSidebarOpen ? 1 : 0, transition: 'opacity 0.2s',
          display: 'flex', flexDirection: 'column', height: '100%',
          pointerEvents: isSidebarOpen ? 'auto' : 'none'
        }}>
          <div style={{ padding: '20px', borderBottom: '1px solid rgba(255,255,255,0.1)' }}>
            <h3 style={{ margin: '0 0 15px 0', fontSize: '18px', color: '#60a5fa', display: 'flex', alignItems: 'center', gap: '8px' }}>
              <span style={{ width: '8px', height: '18px', background: '#3b82f6', borderRadius: '4px' }}></span>
              态势感知面板
            </h3>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end' }}>
              <span style={{ color: '#9ca3af', fontSize: '14px' }}>累计检出病害</span>
              <strong style={{ fontSize: '32px', color: '#fff', lineHeight: '1' }}>{totalCount}</strong>
            </div>
          </div>

          <div style={{ padding: '20px', flex: 1, borderBottom: '1px solid rgba(255,255,255,0.1)', minHeight: '240px' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '6px' }}>
              <h4 style={{ margin: 0, fontSize: '14px', color: '#d1d5db', fontWeight: 'normal' }}>分布占比</h4>
              {selectedType && (
                <span
                  onClick={() => setSelectedType(null)}
                  style={{ fontSize: '11px', color: '#60a5fa', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '3px' }}
                >
                  已筛选：{selectedType} &nbsp;×
                </span>
              )}
            </div>
            <ReactECharts
              option={pieOption}
              style={{ height: 'calc(100% - 24px)', width: '100%' }}
              onEvents={{
                click: (params) => {
                  if (params.componentType === 'series') {
                    setSelectedType(prev => prev === params.name ? null : params.name);
                  }
                }
              }}
            />
          </div>

          <div style={{ padding: '20px', flex: 1, minHeight: '240px' }}>
            <h4 style={{ margin: '0 0 10px 0', fontSize: '14px', color: '#d1d5db', fontWeight: 'normal' }}>近七日检出趋势</h4>
            <ReactECharts option={lineOption} style={{ height: '100%', width: '100%' }} />
          </div>
        </div>
      </div>
    </div>
  );
}
