import { lazy, Suspense, useEffect, useState } from 'react'
import './App.css'
import Nav from './components/Nav'
import Hero from './components/Hero'
import TabBar from './components/TabBar'
import TaskCenterDrawer from './components/TaskCenterDrawer'
import { ToastProvider } from './context/ToastContext'
import { NetworkProvider } from './context/NetworkContext'
import { TaskProvider } from './context/TaskContext'

const FULLSCREEN_TABS = ['map', 'dashboard'];

const ImagePanel = lazy(() => import('./panels/ImagePanel'))
const VideoPanel = lazy(() => import('./panels/VideoPanel'))
const MapPanel = lazy(() => import('./panels/MapPanel'))
const MyRecordsPanel = lazy(() => import('./panels/MyRecordsPanel'))
const LoginPanel = lazy(() => import('./panels/LoginPanel'))
const AboutPanel = lazy(() => import('./panels/AboutPanel'))
const DashboardPanel = lazy(() => import('./panels/DashboardPanel'))

function PanelFallback() {
  return (
    <div style={{
      minHeight: '220px',
      display: 'grid',
      placeItems: 'center',
      color: 'var(--muted)',
      fontSize: '13px',
    }}>
      加载中...
    </div>
  )
}

export default function App() {
  const [isAuthenticated, setIsAuthenticated] = useState(!!localStorage.getItem('token'))
  const [tab, setTab] = useState('image')
  const [prevTab, setPrevTab] = useState('image')
  const [taskDrawerOpen, setTaskDrawerOpen] = useState(false)
  const [themeMode, setThemeMode] = useState(() => {
    const saved = localStorage.getItem('theme')
    return ['system', 'light', 'dark'].includes(saved) ? saved : 'system'
  })
  const [systemDark, setSystemDark] = useState(() =>
    window.matchMedia?.('(prefers-color-scheme: dark)').matches ?? false
  )

  const effectiveTheme = themeMode === 'system'
    ? (systemDark ? 'dark' : 'light')
    : themeMode

  useEffect(() => {
    const media = window.matchMedia?.('(prefers-color-scheme: dark)')
    if (!media) return
    const handleChange = e => setSystemDark(e.matches)
    handleChange(media)
    media.addEventListener?.('change', handleChange)
    return () => media.removeEventListener?.('change', handleChange)
  }, [])

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', effectiveTheme)
    document.documentElement.setAttribute('data-theme-mode', themeMode)
    localStorage.setItem('theme', themeMode)
  }, [effectiveTheme, themeMode])

  const handleLogout = () => {
    localStorage.removeItem('token')
    localStorage.removeItem('username')
    localStorage.removeItem('login_time')
    setIsAuthenticated(false)
  }

  const handleTabChange = (newTab) => {
    if (tab !== newTab) {
      setPrevTab(tab)
    }
    setTab(newTab)
  }

  if (!isAuthenticated) {
    return (
      <Suspense fallback={<PanelFallback />}>
        <LoginPanel onLoginSuccess={() => setIsAuthenticated(true)} />
      </Suspense>
    )
  }

  const isFullscreen = FULLSCREEN_TABS.includes(tab);
  const showHero = !isFullscreen && tab !== 'about';

  return (
    <ToastProvider>
      <NetworkProvider>
      <TaskProvider>
      <Nav
        onBackToDetect={() => handleTabChange('image')}
        onLogout={handleLogout}
        onTabChange={handleTabChange}
        onTaskCenterClick={() => setTaskDrawerOpen(true)}
        themeMode={themeMode}
        effectiveTheme={effectiveTheme}
        onThemeModeChange={setThemeMode}
      />

      {/* 只有在检测页面（image, video, records）才显示 Hero */}
      {showHero && (
        <Hero
          onImageClick={() => handleTabChange('image')}
          onVideoClick={() => handleTabChange('video')}
        />
      )}

      {/* 只有不是关于页面时，才显示 TabBar */}
      {tab !== 'about' && <TabBar active={tab} onChange={handleTabChange} />}

      <div className={isFullscreen ? `content-wrapper fullscreen-map` : 'content-wrapper'}>
        <Suspense fallback={<PanelFallback />}>
          {tab === 'image'   && <ImagePanel />}
          {tab === 'video'   && <VideoPanel />}
          {tab === 'map'     && <MapPanel onBackToDetect={() => handleTabChange('image')} />}
          {tab === 'records' && <MyRecordsPanel />}
          {tab === 'about'   && <AboutPanel />}
          {tab === 'dashboard' && <DashboardPanel onExit={() => handleTabChange(prevTab)} />}
        </Suspense>
      </div>

      {tab !== 'map' && tab !== 'dashboard' && (
        <footer style={{
          borderTop: '1px solid var(--border)',
          padding: '32px',
          textAlign: 'center',
          fontSize: '12px',
          color: 'var(--muted)',
        }}>
          © 2026 LightScan Team · 第19届中国大学生计算机设计大赛
        </footer>
      )}

      <TaskCenterDrawer
        open={taskDrawerOpen}
        onClose={() => setTaskDrawerOpen(false)}
        onViewRecords={() => handleTabChange('records')}
      />
      </TaskProvider>
      </NetworkProvider>
    </ToastProvider>
  )
}
