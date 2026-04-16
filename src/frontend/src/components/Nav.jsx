import s from './Nav.module.css'
import UserMenu from './UserMenu'

export default function Nav({ onBackToDetect, onLogout, onTabChange }) {
  const handleDetectClick = (e) => {
    e.preventDefault();
    if (onBackToDetect) onBackToDetect();
  };

  return (
    <nav className={s.nav}>
      <a className={s.brand} href="/">LIGHTSCAN</a>

      <div className={s.links}>
        <a href="#" onClick={handleDetectClick}>检测</a>
        <a href="#">关于</a>
      </div>

      <UserMenu onLogout={onLogout} onNavigate={onTabChange} />
    </nav>
  )
}
