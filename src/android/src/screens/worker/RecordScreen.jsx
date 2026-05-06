import { useState, useRef, useEffect } from 'react'
import { View, Text, TouchableOpacity, Alert, StyleSheet, useWindowDimensions, TextInput } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { StatusBar as ExpoStatusBar } from 'expo-status-bar'
import { CameraView, useCameraPermissions } from 'expo-camera'
import * as Location from 'expo-location'
import * as ScreenOrientation from 'expo-screen-orientation'
import { uploadImage } from '../../api/detect'
import { enqueue } from '../../utils/offlineQueue'
import { useNetwork } from '../../context/NetworkContext'
import { computeTotalDist, fmtTime } from '../../utils/geo'
import { useThemedStyles } from '../../theme'

const DEFAULT_INTERVAL_METERS = 5
const INTERVAL_OPTIONS = [3, 5, 8, 10]
const GPS_OPTS = { accuracy: Location.Accuracy.High, timeInterval: 2000, distanceInterval: 1 }
const PHOTO_OPTS = { quality: 0.72, exif: true, skipProcessing: false }
const MAX_GPS_ACCURACY_M = 30

function toIso(ts) {
  return new Date(ts || Date.now()).toISOString()
}

function countDetections(results) {
  return (Array.isArray(results) ? results : [results]).reduce(
    (sum, item) => sum + (item?.detections?.length ?? 0),
    0
  )
}

export default function RecordScreen({ navigation }) {
  const s = useThemedStyles(createStyles)
  const { width, height } = useWindowDimensions()
  const isLandscape = width > height
  const [camPerm, requestCamPerm] = useCameraPermissions()
  const [hasLocPerm, setHasLocPerm] = useState(false)
  const [phase, setPhase] = useState('setup') // setup|ready|sampling|done|uploading|queued
  const [duration, setDuration] = useState(0)
  const [currentSpeed, setCurrentSpeed] = useState(0)
  const [totalDist, setTotalDist] = useState(0)
  const [gpsCount, setGpsCount] = useState(0)
  const [captureCount, setCaptureCount] = useState(0)
  const [intervalMeters, setIntervalMeters] = useState(DEFAULT_INTERVAL_METERS)
  const [customInterval, setCustomInterval] = useState('')
  const [uploadMsg, setUploadMsg] = useState('')
  const [progressMsg, setProgressMsg] = useState('')

  const { isOnline, queueCount, refreshQueueCount } = useNetwork()

  const cameraRef = useRef(null)
  const timerRef = useRef(null)
  const startTimeRef = useRef(0)
  const locationSubRef = useRef(null)
  const gpsPointsRef = useRef([])
  const capturesRef = useRef([])
  const lastCaptureDistRef = useRef(0)
  const captureBusyRef = useRef(false)
  const phaseRef = useRef('setup')

  useEffect(() => {
    phaseRef.current = phase
  }, [phase])

  useEffect(() => {
    async function requestAllPermissions() {
      if (!camPerm?.granted) await requestCamPerm()
      const { status } = await Location.requestForegroundPermissionsAsync()
      setHasLocPerm(status === 'granted')
    }
    requestAllPermissions()
    return () => {
      clearInterval(timerRef.current)
      locationSubRef.current?.remove()
      ScreenOrientation.lockAsync(ScreenOrientation.OrientationLock.PORTRAIT_UP).catch(() => {})
    }
  }, [])

  const saveCapture = async (point, reason = 'auto') => {
    if (!cameraRef.current || captureBusyRef.current || phaseRef.current !== 'sampling') return
    captureBusyRef.current = true
    try {
      const photo = await cameraRef.current.takePictureAsync(PHOTO_OPTS)
      const item = {
        uri: photo.uri,
        lat: point.lat,
        lng: point.lng,
        capturedAt: toIso(point.timestamp_ms),
        distanceM: point.distance_m,
        speedKmh: point.speed_kmh,
        reason,
      }
      capturesRef.current = [...capturesRef.current, item]
      setCaptureCount(capturesRef.current.length)
      lastCaptureDistRef.current = point.distance_m
    } catch (e) {
      setProgressMsg(`抓拍失败：${e.message || '摄像头错误'}`)
    } finally {
      captureBusyRef.current = false
    }
  }

  const onLocation = (loc) => {
    if (loc.coords.accuracy && loc.coords.accuracy > MAX_GPS_ACCURACY_M) {
      setProgressMsg(`GPS 精度 ${Math.round(loc.coords.accuracy)}m，等待更稳定定位`)
      return
    }

    const speedKmh = Math.max(0, (loc.coords.speed ?? 0) * 3.6)
    const basePoint = {
      lat: loc.coords.latitude,
      lng: loc.coords.longitude,
      speed_kmh: speedKmh,
      timestamp_ms: loc.timestamp,
    }
    const next = [...gpsPointsRef.current, basePoint]
    const distance = computeTotalDist(next)
    const point = { ...basePoint, distance_m: distance }

    gpsPointsRef.current = [...gpsPointsRef.current, point]
    setGpsCount(gpsPointsRef.current.length)
    setTotalDist(distance)
    setCurrentSpeed(speedKmh)

    const shouldCaptureFirst = capturesRef.current.length === 0
    const shouldCaptureByDistance = distance - lastCaptureDistRef.current >= intervalMeters
    if (shouldCaptureFirst || shouldCaptureByDistance) {
      saveCapture(point, shouldCaptureFirst ? 'first' : 'distance')
    }
  }

  const enterCamera = async () => {
    applyCustomInterval()
    await ScreenOrientation.lockAsync(ScreenOrientation.OrientationLock.LANDSCAPE).catch(() => {})
    phaseRef.current = 'ready'
    setPhase('ready')
  }

  const leaveCamera = async () => {
    clearInterval(timerRef.current)
    locationSubRef.current?.remove()
    locationSubRef.current = null
    await ScreenOrientation.lockAsync(ScreenOrientation.OrientationLock.PORTRAIT_UP).catch(() => {})
    phaseRef.current = 'setup'
    setPhase('setup')
    setProgressMsg('')
  }

  const startSampling = async () => {
    if (!cameraRef.current) {
      Alert.alert('摄像头未就绪', '请稍后再试。')
      return
    }
    if (!camPerm?.granted) {
      Alert.alert('权限不足', '请授予摄像头权限。')
      return
    }
    if (!hasLocPerm) {
      const { status } = await Location.requestForegroundPermissionsAsync()
      const granted = status === 'granted'
      setHasLocPerm(granted)
      if (!granted) {
        Alert.alert('定位权限不足', '距离积分拍照需要 GPS 定位权限。')
        return
      }
    }

    try {
      gpsPointsRef.current = []
      capturesRef.current = []
      lastCaptureDistRef.current = 0
      setDuration(0)
      setCurrentSpeed(0)
      setTotalDist(0)
      setGpsCount(0)
      setCaptureCount(0)
      setUploadMsg('')
      setProgressMsg('等待 GPS 定位...')
      phaseRef.current = 'sampling'
      setPhase('sampling')

      startTimeRef.current = Date.now()
      timerRef.current = setInterval(() => {
        setDuration(Math.floor((Date.now() - startTimeRef.current) / 1000))
      }, 1000)
      locationSubRef.current = await Location.watchPositionAsync(GPS_OPTS, onLocation)
    } catch (e) {
      clearInterval(timerRef.current)
      locationSubRef.current?.remove()
      phaseRef.current = 'ready'
      setPhase('ready')
      Alert.alert('启动失败', e.message || '无法开始巡检采样')
    }
  }

  const stopSampling = () => {
    clearInterval(timerRef.current)
    locationSubRef.current?.remove()
    locationSubRef.current = null
    setProgressMsg('')
    phaseRef.current = 'done'
    setPhase('done')
  }

  const resetSampling = () => {
    gpsPointsRef.current = []
    capturesRef.current = []
    lastCaptureDistRef.current = 0
    clearInterval(timerRef.current)
    locationSubRef.current?.remove()
    locationSubRef.current = null
    phaseRef.current = 'ready'
    setPhase('ready')
    setDuration(0)
    setCurrentSpeed(0)
    setTotalDist(0)
    setGpsCount(0)
    setCaptureCount(0)
    setUploadMsg('')
    setProgressMsg('')
  }

  const doUpload = async () => {
    const captures = capturesRef.current
    if (captures.length === 0) {
      Alert.alert('没有抓拍照片', '本次巡检没有生成照片，请重新采样。')
      return
    }
    if (!isOnline) {
      await enqueue({ captureItems: captures, intervalMeters })
      refreshQueueCount()
      setUploadMsg('已离线保存，联网后自动上传')
      phaseRef.current = 'queued'
      setPhase('queued')
      return
    }
    runUpload(captures)
  }

  const runUpload = async (captures) => {
    phaseRef.current = 'uploading'
    setPhase('uploading')
    setUploadMsg('')
    setProgressMsg('上传 0/' + captures.length)
    try {
      let defects = 0
      for (let i = 0; i < captures.length; i++) {
        const item = captures[i]
        setProgressMsg(`上传 ${i + 1}/${captures.length}`)
        const result = await uploadImage(item.uri, item.lat, item.lng, item.capturedAt)
        defects += countDetections(result)
      }
      setUploadMsg(`检测完成：${captures.length} 张照片，发现 ${defects} 处病害`)
      setProgressMsg('')
      setTimeout(() => navigation.goBack(), 2500)
    } catch (e) {
      if (e.message?.includes('fetch') || e.message?.includes('Network')) {
        await enqueue({ captureItems: captures, intervalMeters })
        refreshQueueCount()
        setUploadMsg('网络中断，已存入离线队列')
        setProgressMsg('')
        phaseRef.current = 'queued'
        setPhase('queued')
      } else {
        Alert.alert('上传失败', e.message || '请稍后重试')
        setProgressMsg('')
        phaseRef.current = 'done'
        setPhase('done')
      }
    }
  }

  const showCamera = phase === 'ready' || phase === 'sampling'
  const expectedCount = Math.max(captureCount, Math.floor(totalDist / intervalMeters) + (totalDist > 0 ? 1 : 0))
  const statItems = [
    { val: fmtTime(duration), lbl: '时长' },
    { val: currentSpeed.toFixed(1), lbl: 'km/h' },
    { val: totalDist.toFixed(0), lbl: 'm 里程' },
    { val: String(captureCount), lbl: '照片' },
  ]
  const summaryItems = [
    { val: fmtTime(duration), lbl: '时长' },
    { val: String(gpsCount), lbl: 'GPS 点' },
    { val: `${totalDist.toFixed(0)} m`, lbl: '里程' },
    { val: String(captureCount), lbl: '照片' },
  ]

  const renderCamera = (style) => showCamera && (
    <CameraView
      ref={cameraRef}
      style={style}
      facing="back"
      active={true}
      mode="picture"
      onMountError={e => Alert.alert('摄像头错误', e.message)}
    />
  )

  const applyCustomInterval = () => {
    const n = parseInt(customInterval, 10)
    if (!isNaN(n) && n >= 1 && n <= 500) {
      setIntervalMeters(n)
    } else {
      setCustomInterval('')
    }
  }

  const renderIntervalPanel = () => (
    <View style={s.intervalPanel}>
      <Text style={s.intervalLabel}>采样距离</Text>
      <View style={s.intervalOptions}>
        {INTERVAL_OPTIONS.map(value => (
          <TouchableOpacity
            key={value}
            style={[s.intervalBtn, intervalMeters === value && !customInterval && s.intervalBtnOn]}
            onPress={() => { setIntervalMeters(value); setCustomInterval('') }}
            activeOpacity={0.75}
          >
            <Text style={[s.intervalBtnText, intervalMeters === value && !customInterval && s.intervalBtnTextOn]}>{value}m</Text>
          </TouchableOpacity>
        ))}
      </View>
      <View style={s.customIntervalRow}>
        <TextInput
          style={[s.customIntervalInput, !!customInterval && s.customIntervalInputActive]}
          placeholder="自定义"
          placeholderTextColor="#9ea3b0"
          keyboardType="number-pad"
          returnKeyType="done"
          maxLength={3}
          value={customInterval}
          onChangeText={setCustomInterval}
          onBlur={applyCustomInterval}
          onSubmitEditing={applyCustomInterval}
        />
        <Text style={s.customIntervalUnit}>m</Text>
      </View>
    </View>
  )

  const renderStats = (compact = false) => (
    <View style={[s.statsOverlay, compact ? s.statsPanel : s.statsPortrait]}>
      {statItems.map((item, i, arr) => (
        <View key={item.lbl} style={{ flexDirection: 'row', flex: 1 }}>
          <View style={s.statCell}>
            <Text style={s.statVal}>{item.val}</Text>
            <Text style={s.statLbl}>{item.lbl}</Text>
          </View>
          {i < arr.length - 1 && <View style={s.statDivider} />}
        </View>
      ))}
    </View>
  )

  const renderSummary = (compact = false) => (
    <View style={[s.summaryWrap, compact && s.summaryPanel]}>
      <Text style={s.summaryTitle}>{phase === 'queued' ? '已离线保存' : '采样完成'}</Text>
      <View style={s.summaryGrid}>
        {summaryItems.map(c => (
          <View key={c.lbl} style={s.summaryCell}>
            <Text style={s.summaryVal}>{c.val}</Text>
            <Text style={s.summaryLbl}>{c.lbl}</Text>
          </View>
        ))}
      </View>
      <Text style={s.summaryNote}>间隔 {intervalMeters}m 自动抓拍 · 逐张携带坐标上传</Text>
      {progressMsg ? <Text style={s.pollStatus}>{progressMsg}</Text> : null}
      {uploadMsg ? <Text style={[s.uploadStatus, phase === 'queued' && s.queuedStatus]}>{uploadMsg}</Text> : null}
    </View>
  )

  const renderControls = (compact = false) => (
    <View style={[s.controls, compact ? s.controlsPanel : s.controlsPortrait]}>
      {phase === 'ready' && (
        <TouchableOpacity style={s.startBtn} onPress={startSampling} activeOpacity={0.8}>
          <Text style={s.startBtnText}>开始采样</Text>
        </TouchableOpacity>
      )}
      {phase === 'sampling' && (
        <>
          <Text style={s.progressText}>
            GPS {gpsCount} 点 · 预计 {expectedCount} 张 · {progressMsg || '自动抓拍中'}
          </Text>
          <TouchableOpacity style={s.stopBtn} onPress={stopSampling} activeOpacity={0.7}>
            <View style={s.stopIcon} />
            <Text style={s.stopBtnText}>停止采样</Text>
          </TouchableOpacity>
        </>
      )}
      {phase === 'done' && (
        <View style={s.actionRow}>
          <TouchableOpacity style={s.resetBtn} onPress={resetSampling} activeOpacity={0.7}>
            <Text style={s.resetBtnText}>重新采样</Text>
          </TouchableOpacity>
          <TouchableOpacity style={s.uploadBtn} onPress={doUpload} activeOpacity={0.75}>
            <Text style={s.uploadBtnText}>{isOnline ? '上传检测' : '离线保存'}</Text>
          </TouchableOpacity>
        </View>
      )}
      {phase === 'uploading' && (
        <View style={s.uploadingRow}>
          <Text style={s.uploadingText}>正在逐张上传检测，请勿关闭...</Text>
        </View>
      )}
      {phase === 'queued' && (
        <View style={s.actionRow}>
          <TouchableOpacity style={s.resetBtn} onPress={resetSampling} activeOpacity={0.7}>
            <Text style={s.resetBtnText}>继续采样</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[s.uploadBtn, !isOnline && s.uploadBtnDisabled]}
            onPress={isOnline ? () => runUpload(capturesRef.current) : undefined}
            activeOpacity={isOnline ? 0.75 : 1}
          >
            <Text style={s.uploadBtnText}>{isOnline ? '立即上传' : '等待联网…'}</Text>
          </TouchableOpacity>
        </View>
      )}
    </View>
  )

  if (!camPerm) return <View style={s.page}><Text style={s.permText}>请求权限中...</Text></View>
  if (!camPerm.granted) {
    return (
      <SafeAreaView style={s.page}>
        <Text style={s.permText}>需要摄像头权限才能使用距离采样巡检</Text>
        <TouchableOpacity style={s.permBtn} onPress={requestCamPerm} activeOpacity={0.8}>
          <Text style={s.permBtnText}>授权摄像头</Text>
        </TouchableOpacity>
      </SafeAreaView>
    )
  }

  if (phase === 'setup') {
    return (
      <SafeAreaView style={s.setupPage}>
        <ExpoStatusBar hidden={false} style="light" backgroundColor="#05080e" />
        <View style={s.setupHeader}>
          <TouchableOpacity style={s.setupBackBtn} onPress={() => navigation.goBack()} activeOpacity={0.7}>
            <Text style={s.setupBackIcon}>‹</Text>
          </TouchableOpacity>
          <View>
            <Text style={s.setupTitle}>距离采样</Text>
            <Text style={s.setupSub}>先设置采样参数，再进入横屏相机。</Text>
          </View>
        </View>

        <View style={s.setupCard}>
          <Text style={s.setupCardTitle}>采样方式</Text>
          <Text style={s.setupText}>系统按 GPS 里程积分自动抓拍照片，每张照片携带坐标和时间上传，不保存大体积视频。</Text>
          {renderIntervalPanel()}
        </View>

        <View style={s.setupMetaGrid}>
          <View style={s.setupMetaCell}>
            <Text style={s.setupMetaVal}>{intervalMeters}m</Text>
            <Text style={s.setupMetaLbl}>当前间隔</Text>
          </View>
          <View style={s.setupMetaCell}>
            <Text style={s.setupMetaVal}>{isOnline ? '在线' : '离线'}</Text>
            <Text style={s.setupMetaLbl}>网络状态</Text>
          </View>
        </View>

        {queueCount > 0 && (
          <View style={s.setupQueue}>
            <Text style={s.setupQueueText}>
              {isOnline ? `正在处理离线队列：${queueCount}` : `离线队列：${queueCount} 个任务`}
            </Text>
          </View>
        )}

        <TouchableOpacity style={s.setupPrimaryBtn} onPress={enterCamera} activeOpacity={0.8}>
          <Text style={s.setupPrimaryText}>进入横屏采集</Text>
        </TouchableOpacity>
      </SafeAreaView>
    )
  }

  if (isLandscape || phase === 'ready' || phase === 'sampling' || phase === 'done' || phase === 'uploading' || phase === 'queued') {
    return (
      <View style={s.capturePage}>
        <ExpoStatusBar hidden />
        <View style={s.previewPane}>
          {renderCamera(StyleSheet.absoluteFill)}
          {!showCamera && <View style={s.previewBlank} />}
          <View style={s.previewTopBar}>
            <TouchableOpacity style={s.previewBackBtn} onPress={leaveCamera} activeOpacity={0.7}>
              <Text style={s.backIcon}>‹</Text>
            </TouchableOpacity>
            <View style={s.previewTitleWrap}>
              <Text style={s.previewTitle}>距离采样</Text>
              <Text style={s.previewSubTitle}>{intervalMeters}m 间隔</Text>
            </View>
            <View style={[s.netBadge, isOnline ? s.netOnline : s.netOffline]}>
              <View style={[s.netDot, isOnline ? s.netDotOn : s.netDotOff]} />
              <Text style={s.netText}>{isOnline ? '在线' : '离线'}</Text>
            </View>
            {phase === 'sampling' && (
              <View style={s.recBadge}><View style={s.recDot} /><Text style={s.recText}>RUN</Text></View>
            )}
          </View>
          {queueCount > 0 && (
            <View style={s.previewQueue}>
              <Text style={s.queueBannerText}>
                {isOnline ? `正在处理离线队列：${queueCount}` : `离线队列：${queueCount} 个任务`}
              </Text>
            </View>
          )}

          <View style={s.liveHud}>
            {statItems.map(item => (
              <View key={item.lbl} style={s.liveStat}>
                <Text style={s.liveVal}>{item.val}</Text>
                <Text style={s.liveLbl}>{item.lbl}</Text>
              </View>
            ))}
          </View>

          {phase === 'ready' && (
            <View style={s.readyPanel}>
              <View style={s.readyCopy}>
                <Text style={s.readyTitle}>准备采集</Text>
                <Text style={s.readyText}>按 {intervalMeters}m 自动抓拍</Text>
              </View>
              {renderControls(true)}
            </View>
          )}
          {phase === 'sampling' && (
            <View style={s.captureControls}>
              <Text style={s.progressText}>GPS {gpsCount} 点 · 预计 {expectedCount} 张 · {progressMsg || '自动抓拍中'}</Text>
              <TouchableOpacity style={s.stopBtn} onPress={stopSampling} activeOpacity={0.7}>
                <View style={s.stopIcon} />
                <Text style={s.stopBtnText}>停止采样</Text>
              </TouchableOpacity>
            </View>
          )}
          {(phase === 'done' || phase === 'uploading' || phase === 'queued') && (
            <View style={s.resultOverlay}>
              {renderSummary(true)}
              {renderControls(true)}
            </View>
          )}
        </View>
      </View>
    )
  }

  return (
    <View style={s.page}>
      {renderCamera([StyleSheet.absoluteFill, { zIndex: 1 }])}

      <SafeAreaView style={s.header}>
        <TouchableOpacity style={s.backBtn} onPress={() => navigation.goBack()} activeOpacity={0.7}>
          <Text style={s.backIcon}>‹</Text>
        </TouchableOpacity>
        <Text style={s.title}>距离采样</Text>
        <View style={s.headerRight}>
          <View style={[s.netBadge, isOnline ? s.netOnline : s.netOffline]}>
            <View style={[s.netDot, isOnline ? s.netDotOn : s.netDotOff]} />
            <Text style={s.netText}>{isOnline ? '联网' : '离线'}</Text>
          </View>
          {phase === 'sampling' && (
            <View style={s.recBadge}><View style={s.recDot} /><Text style={s.recText}>RUN</Text></View>
          )}
        </View>
      </SafeAreaView>

      {queueCount > 0 && (
        <View style={s.queueBanner}>
          <Text style={s.queueBannerText}>
            {isOnline ? `正在处理离线队列：${queueCount}` : `离线队列：${queueCount} 个任务`}
          </Text>
        </View>
      )}

      {phase === 'idle' && (
        <View style={[s.idleHint, s.idleHintPortrait]}>
          <Text style={s.idleTitle}>测速积分拍照</Text>
          <Text style={s.idleText}>横屏采样，按设定距离自动抓拍，不上传大体积视频。</Text>
          {renderIntervalPanel()}
        </View>
      )}

      {phase === 'sampling' && (
        renderStats(false)
      )}

      {(phase === 'done' || phase === 'uploading' || phase === 'queued') && (
        renderSummary(false)
      )}

      {renderControls(false)}
    </View>
  )
}

const createStyles = (t) => StyleSheet.create({
  page: { flex: 1, backgroundColor: t.bg },
  setupPage: { flex: 1, backgroundColor: '#05080e', padding: 22, gap: 18 },
  setupHeader: { flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 6 },
  setupBackBtn: { width: 38, height: 38, alignItems: 'center', justifyContent: 'center' },
  setupBackIcon: { fontSize: 32, color: 'rgba(255,255,255,0.82)', lineHeight: 36 },
  setupTitle: { color: '#ffffff', fontSize: 24, fontWeight: '500' },
  setupSub: { color: 'rgba(255,255,255,0.56)', fontSize: 13, marginTop: 4 },
  setupCard: {
    backgroundColor: 'rgba(255,255,255,0.07)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.12)',
    borderRadius: 12,
    padding: 18,
    gap: 14,
  },
  setupCardTitle: { color: '#ffffff', fontSize: 18, fontWeight: '500' },
  setupText: { color: 'rgba(255,255,255,0.62)', fontSize: 13, lineHeight: 20 },
  setupMetaGrid: { flexDirection: 'row', gap: 12 },
  setupMetaCell: {
    flex: 1,
    backgroundColor: 'rgba(255,255,255,0.055)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.11)',
    borderRadius: 12,
    padding: 16,
    gap: 5,
  },
  setupMetaVal: { color: '#ffffff', fontSize: 24, fontWeight: '500' },
  setupMetaLbl: { color: 'rgba(255,255,255,0.52)', fontSize: 12 },
  setupQueue: {
    borderRadius: 4,
    backgroundColor: 'rgba(62,106,225,0.18)',
    borderWidth: 1,
    borderColor: 'rgba(62,106,225,0.34)',
    padding: 12,
  },
  setupQueueText: { color: '#b8c9ff', fontSize: 13, lineHeight: 18 },
  setupPrimaryBtn: {
    marginTop: 'auto',
    height: 56,
    borderRadius: 10,
    backgroundColor: t.blue,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
  },
  setupPrimaryText: { color: '#ffffff', fontSize: 17, fontWeight: '500' },
  capturePage: {
    flex: 1,
    backgroundColor: '#050505',
  },
  previewPane: {
    flex: 1,
    margin: 0,
    borderRadius: 0,
    overflow: 'hidden',
    backgroundColor: '#050505',
  },
  previewBlank: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: t.bg,
  },
  previewTopBar: {
    position: 'absolute',
    left: 12,
    right: undefined,
    top: 12,
    height: 42,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    borderRadius: 21,
    paddingLeft: 8,
    paddingRight: 12,
    backgroundColor: 'rgba(5,8,14,0.48)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.12)',
  },
  previewBackBtn: { width: 30, height: 30, borderRadius: 15, alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(255,255,255,0.12)' },
  previewTitleWrap: { minWidth: 88 },
  previewTitle: { color: '#ffffff', fontSize: 14, fontWeight: '500' },
  previewSubTitle: { color: 'rgba(255,255,255,0.58)', fontSize: 10, marginTop: 1 },
  previewQueue: {
    position: 'absolute',
    left: 14,
    bottom: 14,
    borderRadius: 4,
    backgroundColor: 'rgba(62,106,225,0.78)',
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  liveHud: {
    position: 'absolute',
    top: 66,
    left: 14,
    width: 118,
    zIndex: 20,
    gap: 7,
  },
  liveStat: {
    minHeight: 46,
    borderRadius: 10,
    backgroundColor: 'rgba(5,8,14,0.42)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.10)',
    paddingHorizontal: 12,
    justifyContent: 'center',
  },
  liveVal: { color: '#ffffff', fontSize: 18, fontWeight: '500' },
  liveLbl: { color: 'rgba(255,255,255,0.58)', fontSize: 10, marginTop: 1 },
  readyPanel: {
    position: 'absolute',
    left: undefined,
    right: 18,
    bottom: 18,
    width: 330,
    zIndex: 25,
    borderRadius: 14,
    padding: 14,
    gap: 12,
    backgroundColor: 'rgba(5,8,14,0.48)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.12)',
  },
  readyCopy: { gap: 3 },
  readyTitle: { color: '#ffffff', fontSize: 17, fontWeight: '500' },
  readyText: { color: 'rgba(255,255,255,0.58)', fontSize: 12, lineHeight: 17 },
  captureControls: {
    position: 'absolute',
    left: undefined,
    right: 18,
    bottom: 18,
    width: 330,
    zIndex: 25,
    borderRadius: 14,
    padding: 12,
    backgroundColor: 'rgba(5,8,14,0.48)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.12)',
  },
  resultOverlay: {
    position: 'absolute',
    left: 18,
    right: 18,
    bottom: 18,
    zIndex: 25,
    borderRadius: 12,
    padding: 16,
    gap: 14,
    backgroundColor: t.isDark ? 'rgba(23,26,32,0.88)' : 'rgba(255,255,255,0.88)',
    borderWidth: 1,
    borderColor: t.borderStrong,
  },
  sidePanel: {
    width: 330,
    margin: 12,
    padding: 18,
    backgroundColor: t.panel,
    borderWidth: 1,
    borderColor: t.borderStrong,
    borderRadius: 12,
  },
  sideHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: 14,
    paddingBottom: 16,
    borderBottomWidth: 1,
    borderBottomColor: t.border,
  },
  sideHeaderRight: { alignItems: 'flex-end', gap: 8 },
  sideExitBtn: {
    borderWidth: 1,
    borderColor: t.borderStrong,
    borderRadius: 4,
    paddingHorizontal: 12,
    paddingVertical: 5,
  },
  sideExitText: { color: t.textMuted, fontSize: 12, fontWeight: '500' },
  sideTitle: { color: t.text, fontSize: 20, fontWeight: '500' },
  sideSub: { color: t.textFaint, fontSize: 12, marginTop: 4 },
  sideBody: { flex: 1, justifyContent: 'center', paddingVertical: 16 },
  sideSection: { gap: 12 },
  header: {
    position: 'absolute', top: 0, left: 0, right: 0,
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 20, paddingBottom: 12,
    backgroundColor: 'rgba(0,0,0,0.6)', zIndex: 10,
  },
  backBtn: { width: 44 },
  backIcon: { fontSize: 26, color: 'rgba(255,255,255,0.78)', lineHeight: 28 },
  title: { fontSize: 17, fontWeight: '500', color: '#ffffff', letterSpacing: 0 },
  headerRight: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  netBadge: { flexDirection: 'row', alignItems: 'center', gap: 4, borderRadius: 12, paddingHorizontal: 8, paddingVertical: 4, borderWidth: 1 },
  netOnline: { backgroundColor: 'rgba(22,163,74,0.15)', borderColor: 'rgba(22,163,74,0.4)' },
  netOffline: { backgroundColor: 'rgba(239,68,68,0.15)', borderColor: 'rgba(239,68,68,0.4)' },
  netDot: { width: 6, height: 6, borderRadius: 3 },
  netDotOn: { backgroundColor: '#22c55e' },
  netDotOff: { backgroundColor: '#ef4444' },
  netText: { fontSize: 11, color: '#ffffff', fontWeight: '500' },
  recBadge: { flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: 'rgba(62,106,225,0.22)', borderWidth: 1, borderColor: 'rgba(62,106,225,0.55)', borderRadius: 12, paddingHorizontal: 9, paddingVertical: 4 },
  recDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: t.blue },
  recText: { fontSize: 12, fontWeight: '500', color: t.blueText, letterSpacing: 0 },
  queueBanner: { position: 'absolute', top: 80, left: 0, right: 0, backgroundColor: 'rgba(62,106,225,0.85)', paddingVertical: 6, alignItems: 'center', zIndex: 15 },
  queueBannerText: { fontSize: 12, color: '#ffffff', fontWeight: '500' },
  idleHint: {
    position: 'absolute',
    zIndex: 20,
    backgroundColor: t.isDark ? 'rgba(0,0,0,0.62)' : 'rgba(255,255,255,0.92)',
    borderWidth: 1,
    borderColor: t.borderStrong,
    borderRadius: 12,
    padding: 18,
    gap: 10,
  },
  idleHintPortrait: { left: 26, right: 26, bottom: 130 },
  idleTitle: { color: t.text, fontSize: 22, fontWeight: '500' },
  idleText: { color: t.textMuted, fontSize: 13, lineHeight: 20 },
  intervalPanel: { gap: 10, marginTop: 4 },
  intervalLabel: { color: t.textMuted, fontSize: 13, fontWeight: '500' },
  intervalOptions: { flexDirection: 'row', gap: 8, flexWrap: 'wrap' },
  customIntervalRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 2 },
  customIntervalInput: {
    flex: 1,
    height: 34,
    borderRadius: 4,
    borderWidth: 1,
    borderColor: t.borderStrong,
    backgroundColor: t.surface,
    paddingHorizontal: 10,
    color: t.text,
    fontSize: 13,
  },
  customIntervalInputActive: { borderColor: t.blue },
  customIntervalUnit: { color: t.textMuted, fontSize: 13, fontWeight: '500' },
  intervalBtn: {
    minWidth: 48,
    height: 34,
    borderRadius: 4,
    borderWidth: 1,
    borderColor: t.borderStrong,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: t.surface,
  },
  intervalBtnOn: { backgroundColor: t.blue, borderColor: t.blue },
  intervalBtnText: { color: t.textMuted, fontSize: 13, fontWeight: '500' },
  intervalBtnTextOn: { color: '#ffffff' },
  statsOverlay: {
    position: 'absolute',
    flexDirection: 'row',
    backgroundColor: t.isDark ? 'rgba(0,0,0,0.56)' : 'rgba(255,255,255,0.88)',
    zIndex: 20,
    borderWidth: 1,
    borderColor: t.borderStrong,
  },
  statsPortrait: { bottom: 120, left: 0, right: 0, paddingVertical: 16, borderLeftWidth: 0, borderRightWidth: 0 },
  statsPanel: {
    position: 'relative',
    width: '100%',
    borderRadius: 12,
    paddingVertical: 12,
    paddingHorizontal: 4,
  },
  statCell: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 4, minHeight: 58 },
  statDivider: { width: 1, backgroundColor: t.borderStrong, marginVertical: 6 },
  statVal: { fontSize: 22, fontWeight: '500', color: t.text },
  statLbl: { fontSize: 11, color: t.textMuted },
  summaryWrap: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 32, gap: 24 },
  summaryPanel: { flex: 0, padding: 0, gap: 18 },
  summaryTitle: { fontSize: 24, fontWeight: '500', color: t.text, letterSpacing: 0 },
  summaryGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 16, width: '100%' },
  summaryCell: { flex: 1, minWidth: '45%', backgroundColor: t.surface, borderWidth: 1, borderColor: t.border, borderRadius: 12, padding: 20, alignItems: 'center', gap: 6 },
  summaryVal: { fontSize: 28, fontWeight: '500', color: t.text },
  summaryLbl: { fontSize: 13, color: t.textMuted },
  summaryNote: { fontSize: 13, color: t.textFaint, textAlign: 'center' },
  pollStatus: { fontSize: 13, color: t.textMuted, textAlign: 'center' },
  uploadStatus: { fontSize: 16, color: t.blue, fontWeight: '500', textAlign: 'center' },
  queuedStatus: { color: '#22c55e' },
  controls: {
    position: 'absolute',
    padding: 20,
    backgroundColor: t.isDark ? 'rgba(0,0,0,0.55)' : 'rgba(255,255,255,0.92)',
    zIndex: 20,
    borderWidth: 1,
    borderColor: t.borderStrong,
  },
  controlsPortrait: { bottom: 0, left: 0, right: 0, paddingBottom: 40, borderLeftWidth: 0, borderRightWidth: 0, borderBottomWidth: 0 },
  controlsPanel: {
    position: 'relative',
    left: undefined,
    right: undefined,
    bottom: undefined,
    width: '100%',
    padding: 0,
    borderWidth: 0,
    backgroundColor: 'transparent',
  },
  startBtn: { backgroundColor: t.blue, borderRadius: 8, height: 48, alignItems: 'center', justifyContent: 'center' },
  startBtnText: { fontSize: 16, fontWeight: '500', color: '#ffffff', letterSpacing: 0 },
  progressText: { color: 'rgba(255,255,255,0.64)', textAlign: 'center', fontSize: 12, marginBottom: 9 },
  stopBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10, backgroundColor: 'rgba(239,68,68,0.78)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.16)', borderRadius: 8, height: 48 },
  stopIcon: { width: 14, height: 14, borderRadius: 3, backgroundColor: '#ffffff' },
  stopBtnText: { fontSize: 15, fontWeight: '500', color: '#ffffff', letterSpacing: 0 },
  actionRow: { flexDirection: 'row', gap: 16 },
  resetBtn: { flex: 1, height: 56, borderRadius: 4, borderWidth: 1, borderColor: t.borderStrong, alignItems: 'center', justifyContent: 'center' },
  resetBtnText: { fontSize: 16, color: t.textMuted, letterSpacing: 0 },
  uploadBtn: { flex: 2, height: 56, borderRadius: 4, backgroundColor: t.blue, alignItems: 'center', justifyContent: 'center' },
  uploadBtnDisabled: { backgroundColor: 'rgba(62,106,225,0.35)' },
  uploadBtnText: { fontSize: 18, fontWeight: '500', color: '#ffffff', letterSpacing: 0 },
  uploadingRow: { height: 56, alignItems: 'center', justifyContent: 'center' },
  uploadingText: { fontSize: 15, color: t.textMuted },
  permText: { color: t.text, textAlign: 'center', marginTop: 120, fontSize: 16, paddingHorizontal: 32 },
  permBtn: { margin: 32, backgroundColor: t.blue, borderRadius: 4, padding: 16, alignItems: 'center' },
  permBtnText: { color: '#ffffff', fontSize: 16, fontWeight: '500' },
})
