import { useState, useRef, useEffect } from 'react';
import s from './UserMenu.module.css';

// 根据用户名生成一致的渐变色
function avatarGradient(name) {
  const palettes = [
    ['#667eea', '#764ba2'],
    ['#f093fb', '#f5576c'],
    ['#4facfe', '#00f2fe'],
    ['#43e97b', '#38f9d7'],
    ['#fa709a', '#fee140'],
    ['#30cfd0', '#667eea'],
    ['#a18cd1', '#fbc2eb'],
  ];
  const idx = (name?.charCodeAt(0) ?? 0) % palettes.length;
  return palettes[idx];
}

const IconMap = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <polygon points="3 6 9 3 15 6 21 3 21 18 15 21 9 18 3 21"/>
    <line x1="9" y1="3" x2="9" y2="18"/><line x1="15" y1="6" x2="15" y2="21"/>
  </svg>
);

const IconDownload = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
    <polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/>
  </svg>
);

const IconShield = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/>
  </svg>
);

const IconLogout = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/>
    <polyline points="16 17 21 12 16 7"/><line x1="21" y1="12" x2="9" y2="12"/>
  </svg>
);

const IconChevron = () => (
  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
    <polyline points="9 18 15 12 9 6"/>
  </svg>
);

export default function UserMenu({ onLogout, onNavigate }) {
  const [open, setOpen] = useState(false);
  const [total, setTotal] = useState('—');
  const ref = useRef(null);
  const username = localStorage.getItem('username') || '用户';
  const loginTime = localStorage.getItem('login_time') || null;
  const [c1, c2] = avatarGradient(username);

  // 拉取累计检出数量（只在面板打开时请求一次）
  useEffect(() => {
    if (!open || total !== '—') return;
    fetch('/api/v1/gis/stats')
      .then(r => r.json())
      .then(d => setTotal(d?.total ?? '—'))
      .catch(() => {});
  }, [open]);

  const initial = username.charAt(0).toUpperCase();

  // 点击外部关闭
  useEffect(() => {
    if (!open) return;
    const handler = (e) => {
      if (ref.current && !ref.current.contains(e.target)) setOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [open]);

  const handleLogout = () => {
    setOpen(false);
    onLogout?.();
  };

  const menuItems = [
    {
      icon: <IconMap />,
      iconBg: 'rgba(59,130,246,0.1)',
      iconColor: '#3b82f6',
      label: '检测历史',
      sub: '在地图上查看所有历史记录',
      action: () => { onNavigate?.('map'); setOpen(false); }
    },
    {
      icon: <IconDownload />,
      iconBg: 'rgba(16,185,129,0.1)',
      iconColor: '#10b981',
      label: '数据导出',
      sub: '导出 CSV / GeoJSON 格式',
      badge: '即将上线',
      action: null,
    },
    {
      icon: <IconShield />,
      iconBg: 'rgba(139,92,246,0.1)',
      iconColor: '#8b5cf6',
      label: '账号安全',
      sub: '修改密码与登录保护',
      badge: '即将上线',
      action: null,
    },
  ];

  // 本次登录时间显示
  const loginDisplay = loginTime
    ? new Date(Number(loginTime)).toLocaleString('zh-CN', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit', hour12: false })
    : null;

  return (
    <div ref={ref} style={{ position: 'relative' }}>
      {/* 头像按钮 */}
      <button
        className={s.avatarBtn}
        onClick={() => setOpen(p => !p)}
        style={{ background: `linear-gradient(135deg, ${c1}, ${c2})` }}
        aria-label="用户菜单"
      >
        {initial}
      </button>

      {/* 下拉面板 */}
      {open && (
        <div className={s.menu}>

          {/* 用户信息头部 */}
          <div className={s.header}>
            <div
              className={s.bigAvatar}
              style={{ background: `linear-gradient(135deg, ${c1}, ${c2})` }}
            >
              {initial}
            </div>
            <div className={s.userInfo}>
              <div className={s.username}>{username}</div>
              <div className={s.roleRow}>
                <span className={s.roleTag}>检测员</span>
                {loginDisplay && (
                  <span className={s.loginTime}>登录于 {loginDisplay}</span>
                )}
              </div>
            </div>
          </div>

          {/* 状态卡片 */}
          <div className={s.statsRow}>
            <div className={s.statItem}>
              <span className={s.statNum}>{total}</span>
              <span className={s.statLabel}>累计检出</span>
            </div>
            <div className={s.statDivider} />
            <div className={s.statItem}>
              <span className={s.statNum}>CCDC</span>
              <span className={s.statLabel}>竞赛版本</span>
            </div>
            <div className={s.statDivider} />
            <div className={s.statItem}>
              <span className={s.statNum}>v1.0</span>
              <span className={s.statLabel}>系统版本</span>
            </div>
          </div>

          <div className={s.divider} />

          {/* 功能菜单 */}
          <div className={s.section}>
            {menuItems.map(item => (
              <button
                key={item.label}
                className={s.menuItem}
                onClick={item.action || undefined}
                disabled={!item.action}
              >
                <div className={s.menuItemLeft}>
                  <span
                    className={s.menuIcon}
                    style={{ background: item.iconBg, color: item.iconColor }}
                  >
                    {item.icon}
                  </span>
                  <div>
                    <div className={s.menuLabel}>{item.label}</div>
                    <div className={s.menuSub}>{item.sub}</div>
                  </div>
                </div>
                <span className={s.menuRight}>
                  {item.badge
                    ? <span className={s.badge}>{item.badge}</span>
                    : <span className={s.chevron}><IconChevron /></span>
                  }
                </span>
              </button>
            ))}
          </div>

          <div className={s.divider} />

          {/* 退出区 */}
          <div className={s.footer}>
            <button className={s.logoutBtn} onClick={handleLogout}>
              <IconLogout />
              <span>退出登录</span>
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
