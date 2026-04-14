import s from './ResultCard.module.css'

export default function ResultCard({ item }) {
  const { filename, detections, image_b64, inference_ms } = item

  return (
    <div className={s.card}>
      <div className={s.thumb}>
        {image_b64 ? <img src={image_b64} alt={filename} /> : <span>无预览</span>}
      </div>
      <div className={s.info}>
        <div className={s.filename}>{filename}</div>
        <div className={s.tags}>
          {detections.length === 0
            ? (
              <span 
                className="tag" 
                style={{ backgroundColor: '#e6f9ee', color: '#1a8045' }}
              >
                正常
              </span>
            )
            : detections.map((d, i) => (
                <span 
                  key={i} 
                  className="tag" 
                  // 直接使用后端传来的十六进制颜色
                  style={{ 
                    backgroundColor: d.color || '#eeeeee', 
                    color: '#000',
                    fontWeight: 'bold',
                    border: 'none'
                  }}
                >
                  {d.label_cn} {d.conf}
                </span>
              ))
          }
        </div>
        <div className={s.meta}>
          {detections.length > 0 && `${detections.length} 处病害 · `}
          {inference_ms != null && `${inference_ms} ms`}
        </div>
      </div>
    </div>
  )
}