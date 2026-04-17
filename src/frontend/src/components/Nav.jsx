import s from './Nav.module.css'
import UserMenu from './UserMenu'
import NetStatus from './NetStatus'

export default function Nav({ onBackToDetect, onLogout, onTabChange }) {
  const handleDetectClick = (e) => {
    e.preventDefault();
    if (onBackToDetect) onBackToDetect();
  };

  return (
    <nav className={s.nav}>
      <a className={s.brand} href="/">LIGHTSCAN</a>

      <div className={s.right}>
        <div className={s.links}>
          <a href="#" onClick={handleDetectClick}>检测</a>
          <a href="#" onClick={(e) => { e.preventDefault(); onTabChange?.('about'); }}>关于</a>
        </div>
        <div className={s.divider} />
        <NetStatus />
        <div className={s.divider} />
        <UserMenu onLogout={onLogout} onNavigate={onTabChange} />
      </div>
    </nav>
  )
}
