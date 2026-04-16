import s from './TabBar.module.css'

const TABS = [
  { id: 'image',   label: '图像检测' },
  { id: 'video',   label: '视频流分析' },
  { id: 'map',     label: '全平台态势' },
  { id: 'records', label: '我的检测' },
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
