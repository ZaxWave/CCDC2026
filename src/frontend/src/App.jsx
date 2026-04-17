import { useState } from 'react'
import './App.css'
import Nav from './components/Nav'
import Hero from './components/Hero'
import TabBar from './components/TabBar'
import ImagePanel from './panels/ImagePanel'
import VideoPanel from './panels/VideoPanel'
import MapPanel from './panels/MapPanel'
import MyRecordsPanel from './panels/MyRecordsPanel'
import LoginPanel from './panels/LoginPanel'
import AboutPanel from './panels/AboutPanel'
import DashboardPanel from './panels/DashboardPanel'
import { ToastProvider } from './context/ToastContext'
import { NetworkProvider } from './context/NetworkContext'

const FULLSCREEN_TABS = ['map'];

export default function App() {
  const [isAuthenticated, setIsAuthenticated] = useState(!!localStorage.getItem('token'))
  const [tab, setTab] = useState('image')

  const handleLogout = () => {
    localStorage.removeItem('token')
    localStorage.removeItem('username')
    localStorage.removeItem('login_time')
    setIsAuthenticated(false)
  }

  if (!isAuthenticated) {
    return <LoginPanel onLoginSuccess={() => setIsAuthenticated(true)} />
  }

  // 大屏模式：沉浸式全屏，隐藏所有导航
  if (tab === 'dashboard') {
    return (
      <ToastProvider>
        <NetworkProvider>
          <DashboardPanel onExit={() => setTab('map')} />
        </NetworkProvider>
      </ToastProvider>
    )
  }

  const isFullscreen = FULLSCREEN_TABS.includes(tab);
  const showHero = !isFullscreen && tab !== 'about';

  return (
    <ToastProvider>
      <NetworkProvider>
      <Nav onBackToDetect={() => setTab('image')} onLogout={handleLogout} onTabChange={setTab} />

      {/* 只有在检测页面（image, video, records）才显示 Hero */}
      {showHero && (
        <Hero
          onImageClick={() => setTab('image')}
          onVideoClick={() => setTab('video')}
        />
      )}

      {/* 只有不是关于页面时，才显示 TabBar */}
      {tab !== 'about' && <TabBar active={tab} onChange={setTab} />}

      <div className={isFullscreen ? `content-wrapper fullscreen-map` : 'content-wrapper'}>
        {tab === 'image'   && <ImagePanel />}
        {tab === 'video'   && <VideoPanel />}
        {tab === 'map'     && <MapPanel />}
        {tab === 'records' && <MyRecordsPanel />}
        {tab === 'about'   && <AboutPanel />}
      </div>

      {tab !== 'map' && (
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
      </NetworkProvider>
    </ToastProvider>
  )
}