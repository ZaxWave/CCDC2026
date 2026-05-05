import s from './AboutPanel.module.css';

// ── 数据定义 ────────────────────────────────────────────────

const TECH_STACK = [
  { group: 'AI Engine',       items: ['LS-Det v1  (road defect detection)', 'SAHI  (slicing aided hyper inference)', 'DeepSeek-V3  (report & dispatch generation)'] },
  { group: 'Frontend',        items: ['React 18 + Vite 5', 'AMap JS API 2.0  (GIS / heatmap)', 'ECharts 5  (data visualization)'] },
  { group: 'Backend',         items: ['FastAPI 0.111  (async REST)', 'PostgreSQL 15 + SQLAlchemy 2', 'Uvicorn  (ASGI server)'] },
  { group: 'LLM Integration', items: ['DeepSeek-V3  (report generation)', 'OpenAI-compatible  Chat Completions API'] },
  { group: 'Infrastructure',  items: ['Python 3.11 runtime', 'JWT Bearer authentication', 'Soft-delete + recycle bin storage'] },
];

const PIPELINE = [
  {
    color: '#3E6AE1',
    icon: '📡',
    title: '多源采集',
    sub:  'Data Ingestion',
    points: ['行车记录仪', '路侧监控摄像头', '无人机航拍', '人工手机巡检'],
  },
  {
    color: '#7c3aed',
    icon: '⚡',
    title: '边缘推理',
    sub:  'Edge Inference',
    points: ['LS-Det v1 轻量模型', 'SAHI 自适应切片', '18 ms / 帧', '4 类病害识别'],
  },
  {
    color: '#0891b2',
    icon: '🗺️',
    title: '时空融合',
    sub:  'Spatio-temporal',
    points: ['GPS / EXIF 定位', 'ReID 特征聚类', '演化时间轴', '健康评分网格'],
  },
  {
    color: '#d97706',
    icon: '🤖',
    title: 'AI 生成',
    sub:  'LLM Generation',
    points: ['DeepSeek-V3 调用', '结构化周报输出', '工料估算建议', '紧急程度评级'],
  },
  {
    color: '#1a8045',
    icon: '✅',
    title: '闭环处置',
    sub:  'Work Order Loop',
    points: ['一键派发工单', '移动端接单完工', '修后照片存档', '状态全程跟踪'],
  },
];

const MODEL_METRICS = [
  { key: 'mAP@50',    val: '69.2%', accent: '#3E6AE1' },
  { key: 'mAP@50:95', val: '38.6%', accent: '#7c3aed' },
  { key: 'Precision', val: '71.4%', accent: '#0891b2' },
  { key: 'Recall',    val: '66.8%', accent: '#1a8045' },
  { key: 'Speed',     val: '18 ms', accent: '#d97706' },
  { key: 'Params',    val: '3.2 M', accent: '#9ca3af' },
];

const CLASS_AP = [
  { code: 'D00', name: '纵向裂缝', ap: 72.1, color: '#3E6AE1' },
  { code: 'D10', name: '横向裂缝', ap: 68.4, color: '#7c3aed' },
  { code: 'D20', name: '龟裂',     ap: 61.8, color: '#d97706' },
  { code: 'D40', name: '坑槽',     ap: 74.5, color: '#D93025' },
];

const DEFECT_CLASSES = [
  { code: 'D00', name: '纵向裂缝', color: '#3E6AE1', desc: '沿行车方向延伸的纵向线状裂缝' },
  { code: 'D10', name: '横向裂缝', color: '#7c3aed', desc: '垂直于行车方向的横向贯穿裂缝' },
  { code: 'D20', name: '龟裂',     color: '#d97706', desc: '网状交叉裂缝，常伴随路面松散' },
  { code: 'D40', name: '坑槽',     color: '#D93025', desc: '路面局部破碎凹陷，危险等级最高' },
];

const INNOVATIONS = [
  { tag: 'INV-01', title: '轻量化边缘检测',   desc: '基于深度可分离卷积架构，参数量较基线压缩约 40%，推理延迟 < 18 ms/帧，支持 SAHI 自适应切片提升小目标召回率。' },
  { tag: 'INV-02', title: '多模态态势感知',   desc: '检测结果与 GIS 坐标融合，AMap 支持散点 / 热力 / 健康评分三模式切换，0.001° 网格自动计算路段健康分值。' },
  { tag: 'INV-03', title: '生成式报告体系',   desc: '调用 DeepSeek-V3 对近 7 日巡检数据进行语义分析，自动生成结构化周报，支持工料估算与维修建议一键派单。' },
  { tag: 'INV-04', title: '视频流逐帧分析',   desc: '支持 GPS 里程触发 / OCR 桩号识别 / 固定时间间隔三种采样策略，从巡检视频中自动提取关键病害帧。' },
  { tag: 'INV-05', title: '工单全生命周期',   desc: '实现"发现病害 → 生成报告 → AI 派单 → 移动接单 → 修后存档"完整闭环，支持修复前后对比图库展示。' },
  { tag: 'INV-06', title: 'ReID 病害追踪',    desc: '基于特征向量相似度对同一物理病害的多次观测进行聚类，自动构建演化时间轴，支持趋势判断（恶化/稳定/好转）。' },
];

const DATASETS = [
  { tag: 'RDD2022-JP',  name: '日本道路病害数据集',   count: '~10,500 张', note: 'VOC XML 格式，摩托车视角采集', color: '#3E6AE1' },
  { tag: 'RDD2022-CN',  name: '中国摩托车视角数据集', count: '~1,977 张',  note: 'RDD2022 中国子集，国内路面场景', color: '#7c3aed' },
  { tag: 'SVRDD-v1',    name: '城市道路病害数据集',   count: '~8,000 张',  note: 'YOLO 格式，7类标注，国内来源', color: '#0891b2' },
  { tag: 'Merged',      name: '合并训练集',           count: '~20,500 张', note: '8:2 train/val split，统一映射至4类', color: '#1a8045' },
];

// ── 子组件 ───────────────────────────────────────────────────

function SectionHeader({ label, title }) {
  return (
    <div className={s.sectionHeader}>
      <span className={s.sectionLabel}>{label}</span>
      <div className={s.sectionTitle}>{title}</div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────

export default function AboutPanel() {
  return (
    <div className={s.page}>

      {/* ══ HERO ═════════════════════════════════════════════ */}
      <div className={s.hero}>
        <div className={s.heroLeft}>
          <div className={s.logoLine}>
            <span className={s.logoText}>LIGHTSCAN</span>
            <span className={s.versionBadge}>v2.0.4</span>
          </div>
          <div className={s.tagline}>一站式道路病害轻量化智能巡检平台</div>
          <div className={s.heroBadges}>
            <span className={s.badge}>ENTERPRISE EDITION</span>
            <span className={s.badge}>第19届中国大学生计算机设计大赛</span>
            <span className={s.badge}>人工智能应用赛道</span>
          </div>
        </div>
        <div className={s.heroRight}>
          <div className={s.sysProfile}>
            {[
              ['BUILD',   '2026.04.25-stable'],
              ['MODEL',   'LS-Det v1 · mAP@0.5 = 69.2%'],
              ['CLASSES', 'D00 / D10 / D20 / D40'],
              ['SPEED',   '18 ms/frame · 3.2M params'],
              ['RUNTIME', 'Python 3.11 + FastAPI + React 18'],
              ['LICENSE', 'Academic / Competition Use Only'],
            ].map(([k, v]) => (
              <div key={k} className={s.sysRow}>
                <span className={s.sysKey}>{k}</span>
                <span className={s.sysVal}>{v}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* ══ SECTION 01: TECH STACK ═══════════════════════════ */}
      <section className={s.section}>
        <SectionHeader label="SECTION 01" title="技术栈看板  Technology Stack" />
        <div className={s.stackGrid}>
          {TECH_STACK.map(g => (
            <div key={g.group} className={s.stackCard}>
              <div className={s.stackGroup}>{g.group}</div>
              {g.items.map(item => (
                <div key={item} className={s.stackItem}>
                  <span className={s.stackDot} />
                  {item}
                </div>
              ))}
            </div>
          ))}
        </div>
      </section>

      {/* ══ SECTION 02: PIPELINE ═════════════════════════════ */}
      <section className={s.section}>
        <SectionHeader label="SECTION 02" title="端到端处理管线  End-to-End Pipeline" />
        <div className={s.pipeline}>
          {PIPELINE.map((step, i) => (
            <div key={step.title} className={s.pipeGroup}>
              <div className={s.pipeNode} style={{ borderTopColor: step.color }}>
                <div className={s.pipeIcon}>{step.icon}</div>
                <div className={s.pipeTitle} style={{ color: step.color }}>{step.title}</div>
                <div className={s.pipeSub}>{step.sub}</div>
                <ul className={s.pipePoints}>
                  {step.points.map(p => (
                    <li key={p} className={s.pipePoint}>
                      <span className={s.pipeDot} style={{ background: step.color }} />
                      {p}
                    </li>
                  ))}
                </ul>
              </div>
              {i < PIPELINE.length - 1 && (
                <div className={s.pipeArrow}>
                  <svg width="28" height="14" viewBox="0 0 28 14" fill="none">
                    <path d="M0 7h24M18 1l6 6-6 6" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                  </svg>
                </div>
              )}
            </div>
          ))}
        </div>
      </section>

      {/* ══ SECTION 03: DETECTION TARGET + MODEL METRICS ════ */}
      <section className={s.section}>
        <SectionHeader label="SECTION 03" title="检测目标与模型性能  Detection Targets & Model Metrics" />
        <div className={s.twoCol}>

          {/* 左：病害类别 */}
          <div className={s.colCard}>
            <div className={s.colTitle}>识别病害类别</div>
            <div className={s.defectList}>
              {DEFECT_CLASSES.map(d => (
                <div key={d.code} className={s.defectRow}>
                  <span className={s.defectCode} style={{ color: d.color, borderColor: d.color + '55' }}>{d.code}</span>
                  <div className={s.defectInfo}>
                    <span className={s.defectName}>{d.name}</span>
                    <span className={s.defectDesc}>{d.desc}</span>
                  </div>
                </div>
              ))}
            </div>
            <div className={s.colFootnote}>
              训练集基于 RDD2022 国际道路病害数据集，
              结合国内路面场景增量微调，共约 22,000 张标注图像。
            </div>
          </div>

          {/* 右：模型性能 */}
          <div className={s.colCard}>
            <div className={s.colTitle}>模型性能指标</div>

            {/* 指标卡片行 */}
            <div className={s.metricsGrid}>
              {MODEL_METRICS.map(m => (
                <div key={m.key} className={s.metricCard}>
                  <div className={s.metricVal} style={{ color: m.accent }}>{m.val}</div>
                  <div className={s.metricKey}>{m.key}</div>
                </div>
              ))}
            </div>

            {/* 分类 AP 柱状条 */}
            <div className={s.apSection}>
              <div className={s.apTitle}>Per-Class AP@50</div>
              {CLASS_AP.map(c => (
                <div key={c.code} className={s.apRow}>
                  <span className={s.apCode} style={{ color: c.color }}>{c.code}</span>
                  <span className={s.apName}>{c.name}</span>
                  <div className={s.apTrack}>
                    <div
                      className={s.apFill}
                      style={{ width: `${c.ap}%`, background: c.color }}
                    />
                  </div>
                  <span className={s.apNum} style={{ color: c.color }}>{c.ap}%</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* ══ SECTION 04: CORE INNOVATIONS ════════════════════ */}
      <section className={s.section}>
        <SectionHeader label="SECTION 04" title="核心创新点  Core Innovations" />
        <div className={s.innovGrid}>
          {INNOVATIONS.map(v => (
            <div key={v.tag} className={s.innovCard}>
              <div className={s.innovTag}>{v.tag}</div>
              <div className={s.innovTitle}>{v.title}</div>
              <div className={s.innovDesc}>{v.desc}</div>
            </div>
          ))}
        </div>
      </section>

      {/* ══ SECTION 05: DATASETS ════════════════════════════ */}
      <section className={s.section}>
        <SectionHeader label="SECTION 05" title="训练数据集  Training Datasets" />
        <div className={s.teamGrid}>
          {DATASETS.map((d) => (
            <div key={d.tag} className={s.teamCard} style={{ '--team-accent': d.color }}>
              <div className={s.teamAvatar} style={{ background: `linear-gradient(135deg, ${d.color}, ${d.color}99)` }}>
                {d.tag.slice(0, 2)}
              </div>
              <div className={s.teamInfo}>
                <div className={s.teamName}>{d.name}</div>
                <div className={s.teamRole} style={{ color: d.color }}>{d.count}</div>
                <div className={s.teamNote}>{d.note}</div>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* ══ FOOTER ═══════════════════════════════════════════ */}
      <div className={s.footerBlock}>
        <div className={s.footerDisclaimer}>
          <span className={s.footerTag}>DISCLAIMER</span>
          本系统为第19届中国大学生计算机设计大赛参赛作品，仅供学术研究与竞赛评审使用。
          检测结果仅作为辅助参考，实际工程决策请结合专业人工复核，开发团队不承担因依赖本系统输出而产生的任何工程责任。
        </div>
        <div className={s.footerCopy}>
          © 2026 LightScan Team · CCDC2026 · All rights reserved.
          &nbsp;·&nbsp; Build <span className={s.mono}>2026.04.25</span>
          &nbsp;·&nbsp; Model <span className={s.mono}>lsdet_v1_best.pt</span>
        </div>
      </div>

    </div>
  );
}
