/**
 * NetStatus.jsx
 * 导航栏右上角的网络/连接状态指示器。
 *
 * 三种状态：
 *   online   — 绿色脉冲点 + "在线"
 *   offline  — 红色静止点 + "离线 · N 条待传"
 *   syncing  — 蓝色旋转环 + "同步中…"
 */

import { useNetwork } from '../context/NetworkContext';
import s from './NetStatus.module.css';

// 信号格 SVG：4 格，根据 bars(1-4) 点亮
function SignalIcon({ bars, className }) {
  return (
    <svg width="14" height="12" viewBox="0 0 14 12" fill="none" className={className}>
      {[
        { x: 0,  h: 3,  minBars: 1 },
        { x: 3,  h: 5,  minBars: 2 },
        { x: 6,  h: 8,  minBars: 3 },
        { x: 9,  h: 11, minBars: 4 },
      ].map(({ x, h, minBars }) => (
        <rect
          key={x}
          x={x} y={12 - h} width="2.5" height={h} rx="0.8"
          fill={bars >= minBars ? 'currentColor' : 'currentColor'}
          opacity={bars >= minBars ? 1 : 0.18}
        />
      ))}
    </svg>
  );
}

// 旋转同步图标
function SyncIcon() {
  return (
    <svg width="12" height="12" viewBox="0 0 24 24" fill="none"
      stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"
      className={s.spinIcon}
    >
      <path d="M23 4v6h-6"/>
      <path d="M1 20v-6h6"/>
      <path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15"/>
    </svg>
  );
}

export default function NetStatus() {
  const { isOnline, pendingCount, isSyncing, triggerSync } = useNetwork();

  // 决定显示模式
  const mode = isSyncing ? 'syncing' : isOnline ? 'online' : 'offline';
  const bars = isOnline ? 4 : 0;

  const label = mode === 'syncing'
    ? '同步中…'
    : mode === 'online'
      ? (pendingCount > 0 ? `${pendingCount} 条待传` : '在线')
      : `离线${pendingCount > 0 ? ` · ${pendingCount} 条待传` : ''}`;

  return (
    <button
      className={`${s.pill} ${s[mode]}`}
      title={
        mode === 'syncing'  ? '正在将离线任务同步到服务器…' :
        mode === 'offline'  ? '当前处于离线状态，检测任务已缓存本地' :
        pendingCount > 0    ? '点击立即同步离线缓存' :
                              '网络连接正常'
      }
      onClick={() => {
        if (mode === 'online' && pendingCount > 0) triggerSync();
      }}
      style={{ cursor: mode === 'online' && pendingCount > 0 ? 'pointer' : 'default' }}
    >
      {/* 状态图标 */}
      {mode === 'syncing' ? (
        <SyncIcon />
      ) : (
        <SignalIcon bars={bars} />
      )}

      {/* 文字标签 */}
      <span className={s.label}>{label}</span>

      {/* 待传数量徽章 */}
      {mode !== 'syncing' && pendingCount > 0 && (
        <span className={s.badge}>{pendingCount}</span>
      )}

      {/* 在线脉冲圆点 */}
      {mode === 'online' && pendingCount === 0 && (
        <span className={s.pulse} />
      )}
    </button>
  );
}
