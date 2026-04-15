import { useState, useEffect } from 'react'
import './App.css'
import Nav from './components/Nav'
import Hero from './components/Hero'
import TabBar from './components/TabBar'
import ImagePanel from './panels/ImagePanel'
import VideoPanel from './panels/VideoPanel'
import MapPanel from './panels/MapPanel'
import LoginPanel from './panels/LoginPanel' 

export default function App() {
  // 增加登录鉴权状态
  const [isAuthenticated, setIsAuthenticated] = useState(!!localStorage.getItem('token'))
  const [tab, setTab] = useState('image')

  // 退出登录方法
  const handleLogout = () => {
    localStorage.removeItem('token')
    localStorage.removeItem('username')
    setIsAuthenticated(false)
  }

  // 路由守卫：未登录时展示登录页
  if (!isAuthenticated) {
    return <LoginPanel onLoginSuccess={() => setIsAuthenticated(true)} />
  }

  return (
    <>
      <Nav onBackToDetect={() => setTab('image')} onLogout={handleLogout} />
      
      {tab !== 'map' && (
        <Hero 
          onImageClick={() => setTab('image')} 
          onVideoClick={() => setTab('video')} 
        />
      )}

      <TabBar active={tab} onChange={setTab} />
      
      <div className={`content-wrapper ${tab === 'map' ? 'fullscreen-map' : ''}`}>
        {tab === 'image' && <ImagePanel />}
        {tab === 'video' && <VideoPanel />}
        {tab === 'map' && <MapPanel />}
      </div>

      {tab !== 'map' && (
        <footer style={{ borderTop: '1px solid var(--border)', padding: '32px', textAlign: 'center', fontSize: '12px', color: 'var(--muted)' }}>
          © 2026 LightScan Team · 第19届中国大学生计算机设计大赛
        </footer>
      )}
    </>
  )
}