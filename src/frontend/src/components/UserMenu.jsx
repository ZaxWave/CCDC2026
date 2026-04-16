import { useState, useRef, useEffect } from 'react';
import s from './UserMenu.module.css';
import { getMyProfile, changePassword } from '../api/client';

// 固定品牌蓝渐变
function avatarGradient() {
  return ['#3E6AE1', '#60a5fa'];
}

const IconRecords = () => (
  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <polygon points="3 6 9 3 15 6 21 3 21 18 15 21 9 18 3 21"/>
    <line x1="9" y1="3" x2="9" y2="18"/><line x1="15" y1="6" x2="15" y2="21"/>
  </svg>
);
const IconLock = () => (
  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <rect x="3" y="11" width="18" height="11" rx="2" ry="2"/>
    <path d="M7 11V7a5 5 0 0 1 10 0v4"/>
  </svg>
);
const IconLogout = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
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
  const [open, setOpen]       = useState(false);
  const [profile, setProfile] = useState(null);
  const [showPw, setShowPw]   = useState(false);
  const [pwForm, setPwForm]   = useState({ old: '', new1: '', new2: '' });
  const [pwStatus, setPwStatus] = useState({ type: '', msg: '' });
  const [pwLoading, setPwLoading] = useState(false);
  const ref = useRef(null);

  const username  = localStorage.getItem('username') || '用户';
  const loginTime = localStorage.getItem('login_time');
  const [c1, c2]  = avatarGradient();
  const initial   = username.charAt(0).toUpperCase();

  // 点击外部关闭
  useEffect(() => {
    if (!open) return;
    const h = (e) => { if (ref.current && !ref.current.contains(e.target)) setOpen(false); };
    document.addEventListener('mousedown', h);
    return () => document.removeEventListener('mousedown', h);
  }, [open]);

  // 面板打开时拉取个人信息
  useEffect(() => {
    if (open && !profile) getMyProfile().then(setProfile).catch(() => {});
  }, [open]);

  const handleLogout = () => { setOpen(false); onLogout?.(); };

  const handlePwSubmit = async (e) => {
    e.preventDefault();
    if (pwForm.new1 !== pwForm.new2) {
      setPwStatus({ type: 'err', msg: '两次新密码不一致' }); return;
    }
    if (pwForm.new1.length < 6) {
      setPwStatus({ type: 'err', msg: '新密码至少 6 位' }); return;
    }
    setPwLoading(true);
    try {
      await changePassword(pwForm.old, pwForm.new1);
      setPwStatus({ type: 'ok', msg: '密码修改成功' });
      setPwForm({ old: '', new1: '', new2: '' });
      setTimeout(() => { setShowPw(false); setPwStatus({ type: '', msg: '' }); }, 1800);
    } catch (err) {
      setPwStatus({ type: 'err', msg: err.message });
    } finally {
      setPwLoading(false);
    }
  };

  const loginDisplay = loginTime
    ? new Date(Number(loginTime)).toLocaleString('zh-CN', {
        month: 'short', day: 'numeric',
        hour: '2-digit', minute: '2-digit', hour12: false,
      })
    : null;

  return (
    <div ref={ref} style={{ position: 'relative' }}>
      {/* 头像按钮 */}
      <button
        className={s.avatarBtn}
        onClick={() => setOpen(p => !p)}
        style={{ background: `linear-gradient(135deg, ${c1}, ${c2})` }}
        aria-label="用户设置"
      >
        {initial}
      </button>

      {open && (
        <div className={s.menu}>

          {/* ── 用户信息头部 ─── */}
          <div className={s.header}>
            <div className={s.bigAvatar} style={{ background: `linear-gradient(135deg, ${c1}, ${c2})` }}>
              {initial}
            </div>
            <div className={s.userInfo}>
              <div className={s.username}>{username}</div>
              <div className={s.roleLine}>
                <span className={s.roleTag}>{profile?.role === 'admin' ? '管理员' : '检测员'}</span>
                {loginDisplay && <span className={s.loginTime}>{loginDisplay} 登录</span>}
              </div>
            </div>
          </div>

          {/* ── 统计数据 ─── */}
          <div className={s.statsRow}>
            <div className={s.statItem}>
              <span className={s.statNum}>{profile?.record_count ?? '—'}</span>
              <span className={s.statLabel}>我的记录</span>
            </div>
            <div className={s.statDiv} />
            <div className={s.statItem}>
              <span className={s.statNum}>{profile?.role === 'admin' ? 'Admin' : 'Worker'}</span>
              <span className={s.statLabel}>权限等级</span>
            </div>
            <div className={s.statDiv} />
            <div className={s.statItem}>
              <span className={s.statNum}>v1.0</span>
              <span className={s.statLabel}>版本</span>
            </div>
          </div>

          <div className={s.divider} />

          {/* ── 功能菜单 ─── */}
          <div className={s.section}>
            <div className={s.sectionTitle}>快捷操作</div>

            <button className={s.menuItem} onClick={() => { onNavigate?.('records'); setOpen(false); }}>
              <span className={s.menuIcon} style={{ color: '#3E6AE1' }}><IconRecords /></span>
              <div className={s.menuText}>
                <span className={s.menuLabel}>我的检测记录</span>
                <span className={s.menuSub}>查看并管理个人上传的数据</span>
              </div>
              <span className={s.chevron}><IconChevron /></span>
            </button>

            <button className={s.menuItem} onClick={() => { setShowPw(p => !p); setPwStatus({ type: '', msg: '' }); }}>
              <span className={s.menuIcon} style={{ color: '#7c3aed' }}><IconLock /></span>
              <div className={s.menuText}>
                <span className={s.menuLabel}>修改密码</span>
                <span className={s.menuSub}>更新账户登录凭证</span>
              </div>
              <span className={s.chevron} style={{ transform: showPw ? 'rotate(-90deg)' : 'rotate(90deg)', transition: 'transform 0.2s', display: 'flex' }}>
                <IconChevron />
              </span>
            </button>
          </div>

          {/* ── 密码修改表单 ─── */}
          {showPw && (
            <div className={s.pwSection}>
              <form className={s.pwForm} onSubmit={handlePwSubmit}>
                <div>
                  <label className={s.pwLabel}>当前密码</label>
                  <input
                    className={s.pwInput}
                    type="password"
                    placeholder="请输入当前密码"
                    value={pwForm.old}
                    onChange={e => setPwForm(p => ({ ...p, old: e.target.value }))}
                    required
                  />
                </div>
                <div>
                  <label className={s.pwLabel}>新密码</label>
                  <input
                    className={s.pwInput}
                    type="password"
                    placeholder="至少 6 位"
                    value={pwForm.new1}
                    onChange={e => setPwForm(p => ({ ...p, new1: e.target.value }))}
                    required
                  />
                </div>
                <div>
                  <label className={s.pwLabel}>确认新密码</label>
                  <input
                    className={s.pwInput}
                    type="password"
                    placeholder="再次输入新密码"
                    value={pwForm.new2}
                    onChange={e => setPwForm(p => ({ ...p, new2: e.target.value }))}
                    required
                  />
                </div>
                {pwStatus.msg && (
                  <div className={pwStatus.type === 'ok' ? s.pwOk : s.pwErr}>{pwStatus.msg}</div>
                )}
                <button type="submit" className={s.pwSubmit} disabled={pwLoading}>
                  {pwLoading ? '更新中...' : '确认修改'}
                </button>
              </form>
            </div>
          )}

          <div className={s.divider} />

          {/* ── 退出 ─── */}
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
