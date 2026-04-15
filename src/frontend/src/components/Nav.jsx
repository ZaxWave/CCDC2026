import s from './Nav.module.css'

export default function Nav({ onBackToDetect, onLogout }) {
  const username = localStorage.getItem('username') || '用户';
  
  const handleDetectClick = (e) => {
    e.preventDefault(); 
    if (onBackToDetect) {
      onBackToDetect(); 
    }
  };

  return (
    <nav className={s.nav}>
      <a className={s.brand} href="/">LIGHTSCAN</a>
      
      <div className={s.links}>
        <a href="#" onClick={handleDetectClick}>检测</a>
        <a href="#">关于</a>
        
        {/* 新增的用户信息与退出区 */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '15px', marginLeft: '20px', borderLeft: '1px solid rgba(255,255,255,0.2)', paddingLeft: '20px' }}>
          <span style={{ fontSize: '0.9rem', color: '#8892b0' }}>{username}</span>
          <button 
            onClick={onLogout}
            style={{
              background: 'transparent',
              border: '1px solid rgba(255,68,68,0.5)',
              color: '#ff4444',
              padding: '4px 12px',
              borderRadius: '4px',
              cursor: 'pointer',
              fontSize: '0.85rem'
            }}
          >
            退出
          </button>
        </div>
      </div>
    </nav>
  )
}