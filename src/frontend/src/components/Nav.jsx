import s from './Nav.module.css'
import UserMenu from './UserMenu'
import NetStatus from './NetStatus'
import { useTaskCenter } from '../context/TaskContext'

export default function Nav({ onBackToDetect, onLogout, onTabChange, onTaskCenterClick, darkMode, onToggleDark }) {
  const { tasks } = useTaskCenter()
  const activeCount = tasks.filter(t => t.status === 'queued' || t.status === 'processing').length

  return (
    <nav className={s.nav}>
      <a className={s.brand} href="/">LIGHTSCAN</a>

      <div className={s.right}>
        <div className={s.links}>
          <a href="#" onClick={e => { e.preventDefault(); onBackToDetect?.() }}>检测</a>
          <a href="#" onClick={e => { e.preventDefault(); onTabChange?.('about') }}>关于</a>
        </div>
        <div className={s.divider} />
        <NetStatus />
        <div className={s.divider} />
        <button className={s.themeBtn} onClick={onToggleDark} title={darkMode ? '切换浅色模式' : '切换深色模式'}>
          {darkMode ? (
            <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor">
              <path d="M8 11a3 3 0 1 1 0-6 3 3 0 0 1 0 6zm0 1a4 4 0 1 0 0-8 4 4 0 0 0 0 8zM8 0a.5.5 0 0 1 .5.5v1a.5.5 0 0 1-1 0v-1A.5.5 0 0 1 8 0zm0 13a.5.5 0 0 1 .5.5v1a.5.5 0 0 1-1 0v-1A.5.5 0 0 1 8 13zm8-5a.5.5 0 0 1-.5.5h-1a.5.5 0 0 1 0-1h1a.5.5 0 0 1 .5.5zM2 8a.5.5 0 0 1-.5.5h-1a.5.5 0 0 1 0-1h1A.5.5 0 0 1 2 8zm10.95-4.95a.5.5 0 0 1 0 .707l-.707.707a.5.5 0 0 1-.707-.707l.707-.707a.5.5 0 0 1 .707 0zm-9.9 9.9a.5.5 0 0 1 0 .707l-.707.707a.5.5 0 0 1-.707-.707l.707-.707a.5.5 0 0 1 .707 0zm9.9 0a.5.5 0 0 1-.707 0l-.707-.707a.5.5 0 0 1 .707-.707l.707.707a.5.5 0 0 1 0 .707zM3.05 3.05a.5.5 0 0 1 .707 0l.707.707a.5.5 0 0 1-.707.707l-.707-.707a.5.5 0 0 1 0-.707z"/>
            </svg>
          ) : (
            <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor">
              <path d="M6 .278a.768.768 0 0 1 .08.858 7.208 7.208 0 0 0-.878 3.46c0 4.021 3.278 7.277 7.318 7.277.527 0 1.04-.055 1.533-.16a.787.787 0 0 1 .81.316.733.733 0 0 1-.031.893A8.349 8.349 0 0 1 8.344 16C3.734 16 0 12.286 0 7.71 0 4.266 2.114 1.312 5.124.06A.752.752 0 0 1 6 .278z"/>
            </svg>
          )}
        </button>
        <div className={s.divider} />
        <button className={s.taskBtn} onClick={onTaskCenterClick} title="任务中心">
          <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
            <rect x="2" y="3" width="12" height="1.5" rx="0.75" fill="currentColor"/>
            <rect x="2" y="7.25" width="12" height="1.5" rx="0.75" fill="currentColor"/>
            <rect x="2" y="11.5" width="8" height="1.5" rx="0.75" fill="currentColor"/>
          </svg>
          {activeCount > 0 && <span className={s.badge}>{activeCount}</span>}
        </button>
        <div className={s.divider} />
        <UserMenu onLogout={onLogout} onNavigate={onTabChange} />
      </div>
    </nav>
  )
}
