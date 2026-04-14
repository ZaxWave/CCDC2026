import { useEffect, useRef, useState } from 'react';
import AMapLoader from '@amap/amap-jsapi-loader';
import s from './MapPanel.module.css';

window._AMapSecurityConfig = {
  securityJsCode: '5925c6e1bb0cc5d88d379ff29ad85a94', 
};

export default function MapPanel() {
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

  return (
    <div className={s.container} style={{ position: 'relative', width: '100%', height: 'calc(100vh - 60px)' }}>
      <div ref={mapRef} style={{ width: '100%', height: '100%', background: '#090a0f' }}></div>
      
      {/* 数据仪表盘 */}
      <div style={{
        position: 'absolute', top: '20px', left: '20px', background: 'rgba(10, 15, 30, 0.85)',
        backdropFilter: 'blur(10px)', border: '1px solid rgba(255,255,255,0.1)', padding: '20px',
        borderRadius: '12px', color: '#fff', zIndex: 999, minWidth: '250px'
      }}>
        <h3 style={{ margin: '0 0 15px 0', fontSize: '18px', color: '#60a5fa' }}>⚡ 实时监测面板</h3>
        {loading ? (
          <div style={{ color: '#9ca3af' }}>数据同步中...</div>
        ) : (
          <div style={{ display: 'flex', justifyContent: 'space-between' }}>
            <span style={{ color: '#9ca3af' }}>已归档病害：</span>
            <strong style={{ fontSize: '18px', color: '#f87171' }}>{records.length}</strong>
          </div>
        )}
      </div>
    </div>
  );
}
