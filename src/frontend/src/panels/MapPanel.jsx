import { useEffect, useRef, useState, useMemo } from 'react';
import AMapLoader from '@amap/amap-jsapi-loader';
import s from './MapPanel.module.css';
import ReactECharts from 'echarts-for-react';

window._AMapSecurityConfig = {
  securityJsCode: '5925c6e1bb0cc5d88d379ff29ad85a94', 
};

export default function MapPanel() {
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);
  const mapRef = useRef(null);
  const [mapInstance, setMapInstance] = useState(null);
  const [records, setRecords] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    AMapLoader.load({
      key: "f275bdf35f914d36658f2ab2c7c0feb4", 
      version: "2.0",
      plugins: ['AMap.Scale', 'AMap.ToolBar'], 
    }).then((AMap) => {
      const map = new AMap.Map(mapRef.current, {
        viewMode: '3D',
        zoom: 14,
        center: [114.405, 30.482], // 默认视角：武汉光谷
        mapStyle: 'amap://styles/darkblue', 
      });
      setMapInstance(map);
    }).catch(e => console.error("高德地图加载失败:", e));

    return () => mapInstance && mapInstance.destroy();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // 异步获取真实的后端数据库数据
  useEffect(() => {
    fetch('/api/v1/gis/records')
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

  // 3. 动态打点（监听 records 和 mapInstance 的变化）
  useEffect(() => {
    if (!mapInstance) return;

    mapInstance.clearMap();

    if (records.length === 0) return;

    records.forEach(item => {
      const lng = parseFloat(item?.lng);
      const lat = parseFloat(item?.lat);

      if (!isNaN(lng) && !isNaN(lat) && lng !== 0 && lat !== 0) {
        try {
          const marker = new window.AMap.Marker({
            position: [lng, lat],
            title: item.label_cn || '病害',
            content: `
              <div style="
                background: ${item.color_hex || '#ff4444'}; 
                width: 14px; height: 14px; 
                border-radius: 50%; border: 2px solid #fff;
                box-shadow: 0 0 15px ${item.color_hex || '#ff4444'};
                cursor: pointer;
              "></div>
            `
          });
          mapInstance.add(marker); 
        } catch (error) {}
      }
    });
  }, [mapInstance, records]);
  

  // ==========================================
  // 根据 records 动态生成 ECharts 配置）
  // ==========================================

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
      series: [
        {
          name: '病害类型', type: 'pie', radius: ['50%', '70%'], avoidLabelOverlap: false,
          itemStyle: { borderRadius: 8, borderColor: 'rgba(10, 15, 30, 0.85)', borderWidth: 2 },
          label: { show: false, position: 'center' },
          emphasis: { label: { show: true, fontSize: 16, fontWeight: 'bold', color: '#fff' } },
          labelLine: { show: false },
          data: data.length > 0 ? data : [{ name: '暂无数据', value: 0 }]
        }
      ]
    };
  }, [records]);

  // [图表 2] 近期巡检趋势折线图
  const lineOption = useMemo(() => {
    const total = records.length;
    // 模拟联动趋势
    const mockTrend = [
      Math.floor(total * 0.1), Math.floor(total * 0.2), Math.floor(total * 0.15),
      Math.floor(total * 0.3), Math.floor(total * 0.1), Math.floor(total * 0.05), total
    ];

    return {
      tooltip: { trigger: 'axis', backgroundColor: 'rgba(10, 15, 30, 0.9)', borderColor: '#3b82f6', textStyle: { color: '#fff' } },
      grid: { left: '3%', right: '4%', bottom: '3%', top: '10%', containLabel: true },
      xAxis: { 
        type: 'category', boundaryGap: false, data: ['周一', '周二', '周三', '周四', '周五', '周六', '今日'],
        axisLabel: { color: '#9ca3af' }, axisLine: { lineStyle: { color: '#374151' } }
      },
      yAxis: { type: 'value', axisLabel: { color: '#9ca3af' }, splitLine: { lineStyle: { color: '#1f2937', type: 'dashed' } } },
      series: [
        {
          name: '检出数量', type: 'line', smooth: true, data: mockTrend,
          lineStyle: { color: '#3b82f6', width: 3 },
          areaStyle: {
            color: { type: 'linear', x: 0, y: 0, x2: 0, y2: 1, colorStops: [{ offset: 0, color: 'rgba(59, 130, 246, 0.5)' }, { offset: 1, color: 'rgba(59, 130, 246, 0)' }] }
          },
          symbol: 'circle', symbolSize: 8, itemStyle: { color: '#60a5fa', borderColor: '#fff', borderWidth: 2 }
        }
      ]
    };
  }, [records]);

  // ==========================================

  return (
    <div className={s.container} style={{ position: 'relative', width: '100%', height: 'calc(100vh - 60px)', overflow: 'hidden' }}>
      {/* 1. 地图底层 */}
      <div ref={mapRef} style={{ width: '100%', height: '100%', background: '#090a0f' }}></div>
      
      {/* 2. 可收起的数据仪表盘 */}
      <div 
        style={{
          position: 'absolute', 
          top: '20px', 
          bottom: '20px', 
          left: isSidebarOpen ? '20px' : '-340px', 
          width: '320px',
          background: 'rgba(10, 15, 30, 0.85)', 
          backdropFilter: 'blur(10px)',
          border: '1px solid rgba(255,255,255,0.1)', 
          borderRadius: '12px',
          display: 'flex', 
          flexDirection: 'column', 
          zIndex: 999,
          transition: 'all 0.4s cubic-bezier(0.4, 0, 0.2, 1)', 
        }}
      >
        <div 
          onClick={() => setIsSidebarOpen(!isSidebarOpen)}
          style={{
            position: 'absolute',
            right: '-35px',
            top: '20px',
            width: '35px',
            height: '60px',
            background: 'rgba(10, 15, 30, 0.85)',
            backdropFilter: 'blur(10px)',
            border: '1px solid rgba(255,255,255,0.1)',
            borderLeft: 'none',
            borderRadius: '0 8px 8px 0',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            cursor: 'pointer',
            color: '#60a5fa',
            fontSize: '12px',
            boxShadow: '4px 0 10px rgba(0,0,0,0.3)'
          }}
        >
          {isSidebarOpen ? '◀' : '▶'}
        </div>

        <div style={{ 
          opacity: isSidebarOpen ? 1 : 0, 
          transition: 'opacity 0.2s', 
          display: 'flex', 
          flexDirection: 'column', 
          height: '100%',
          pointerEvents: isSidebarOpen ? 'auto' : 'none'
        }}>
          {/* 头部：总数统计 */}
          <div style={{ padding: '20px', borderBottom: '1px solid rgba(255,255,255,0.1)' }}>
            <h3 style={{ margin: '0 0 15px 0', fontSize: '18px', color: '#60a5fa', display: 'flex', alignItems: 'center', gap: '8px' }}>
              <span style={{ width: '8px', height: '18px', background: '#3b82f6', borderRadius: '4px' }}></span>
              态势感知面板
            </h3>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end' }}>
              <span style={{ color: '#9ca3af', fontSize: '14px' }}>累计检出病害</span>
              <strong style={{ fontSize: '32px', color: '#fff', lineHeight: '1' }}>{loading ? '-' : records.length}</strong>
            </div>
          </div>

          {/* 渲染图表 1：ECharts 环形图 */}
          <div style={{ padding: '20px', flex: 1, borderBottom: '1px solid rgba(255,255,255,0.1)', minHeight: '240px' }}>
            <h4 style={{ margin: '0 0 10px 0', fontSize: '14px', color: '#d1d5db', fontWeight: 'normal' }}>分布占比</h4>
            <ReactECharts option={pieOption} style={{ height: '100%', width: '100%' }} />
          </div>

          {/* 渲染图表 2：ECharts 折线图 */}
          <div style={{ padding: '20px', flex: 1, minHeight: '240px' }}>
            <h4 style={{ margin: '0 0 10px 0', fontSize: '14px', color: '#d1d5db', fontWeight: 'normal' }}>近七日检出趋势</h4>
            <ReactECharts option={lineOption} style={{ height: '100%', width: '100%' }} />
          </div>
        </div>

      </div>
    </div>
  );
}
