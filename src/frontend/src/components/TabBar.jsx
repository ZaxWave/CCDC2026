import s from './TabBar.module.css'

const TABS = [
  { id: 'image', label: '图像检测' },
  { id: 'video', label: '视频流分析' },
  { id: 'map', label: '空间态势' }
]

export default function TabBar({ active, onChange }) {
  return (
    <div className={s.bar}>
      {TABS.map((tab) => (
        <button 
          key={tab.id} 
          className={`${s.tab} ${active === tab.id ? s.active : ''}`} 
          onClick={() => onChange(tab.id)}
        >
          {tab.label}
        </button>
      ))}
    </div>
  )
}