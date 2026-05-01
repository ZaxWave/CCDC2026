import { useState, useRef, useEffect } from 'react'
import { View, Text, TouchableOpacity, Alert, StyleSheet } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { CameraView, useCameraPermissions } from 'expo-camera'
import * as Location from 'expo-location'
import * as ScreenOrientation from 'expo-screen-orientation'
import { uploadImage } from '../../api/detect'
import { enqueue } from '../../utils/offlineQueue'
import { useNetwork } from '../../context/NetworkContext'
import { computeTotalDist, fmtTime } from '../../utils/geo'

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
  const [camPerm, requestCamPerm] = useCameraPermissions()
  const [hasLocPerm, setHasLocPerm] = useState(false)
  const [phase, setPhase] = useState('idle') // idle|sampling|done|uploading|queued
  const [duration, setDuration] = useState(0)
  const [currentSpeed, setCurrentSpeed] = useState(0)
  const [totalDist, setTotalDist] = useState(0)
  const [gpsCount, setGpsCount] = useState(0)
  const [captureCount, setCaptureCount] = useState(0)
  const [intervalMeters, setIntervalMeters] = useState(DEFAULT_INTERVAL_METERS)
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
  const phaseRef = useRef('idle')

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
    ScreenOrientation.lockAsync(ScreenOrientation.OrientationLock.LANDSCAPE).catch(() => {})
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
      phaseRef.current = 'idle'
      setPhase('idle')
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
    phaseRef.current = 'idle'
    setPhase('idle')
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

  const showCamera = phase === 'idle' || phase === 'sampling'
  const expectedCount = Math.max(captureCount, Math.floor(totalDist / intervalMeters) + (totalDist > 0 ? 1 : 0))

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

  return (
    <View style={s.page}>
      {showCamera && (
        <CameraView
          ref={cameraRef}
          style={[StyleSheet.absoluteFill, { zIndex: 1 }]}
          facing="back"
          active={true}
          onMountError={e => Alert.alert('摄像头错误', e.message)}
        />
      )}

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
        <View style={s.idleHint}>
          <Text style={s.idleTitle}>测速积分拍照</Text>
          <Text style={s.idleText}>横屏采样，按设定距离自动抓拍，不上传大体积视频。</Text>
          <View style={s.intervalPanel}>
            <Text style={s.intervalLabel}>采样距离</Text>
            <View style={s.intervalOptions}>
              {INTERVAL_OPTIONS.map(value => (
                <TouchableOpacity
                  key={value}
                  style={[s.intervalBtn, intervalMeters === value && s.intervalBtnOn]}
                  onPress={() => setIntervalMeters(value)}
                  activeOpacity={0.75}
                >
                  <Text style={[s.intervalBtnText, intervalMeters === value && s.intervalBtnTextOn]}>{value}m</Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>
        </View>
      )}

      {phase === 'sampling' && (
        <View style={s.statsOverlay}>
          {[
            { val: fmtTime(duration), lbl: '时长' },
            { val: currentSpeed.toFixed(1), lbl: 'km/h' },
            { val: totalDist.toFixed(0), lbl: 'm 里程' },
            { val: String(captureCount), lbl: '照片' },
          ].map((item, i, arr) => (
            <View key={item.lbl} style={{ flexDirection: 'row', flex: 1 }}>
              <View style={s.statCell}>
                <Text style={s.statVal}>{item.val}</Text>
                <Text style={s.statLbl}>{item.lbl}</Text>
              </View>
              {i < arr.length - 1 && <View style={s.statDivider} />}
            </View>
          ))}
        </View>
      )}

      {(phase === 'done' || phase === 'uploading' || phase === 'queued') && (
        <View style={s.summaryWrap}>
          <Text style={s.summaryTitle}>{phase === 'queued' ? '已离线保存' : '采样完成'}</Text>
          <View style={s.summaryGrid}>
            {[
              { val: fmtTime(duration), lbl: '时长' },
              { val: String(gpsCount), lbl: 'GPS 点' },
              { val: `${totalDist.toFixed(0)} m`, lbl: '里程' },
              { val: String(captureCount), lbl: '照片' },
            ].map(c => (
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
      )}

      <View style={s.controls}>
        {phase === 'idle' && (
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
    </View>
  )
}

const s = StyleSheet.create({
  page: { flex: 1, backgroundColor: '#111111' },
  header: {
    position: 'absolute', top: 0, left: 0, right: 0,
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 20, paddingBottom: 12,
    backgroundColor: 'rgba(0,0,0,0.6)', zIndex: 10,
  },
  backBtn: { width: 44 },
  backIcon: { fontSize: 32, color: 'rgba(255,255,255,0.7)', lineHeight: 36 },
  title: { fontSize: 17, fontWeight: '600', color: '#ffffff', letterSpacing: 0 },
  headerRight: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  netBadge: { flexDirection: 'row', alignItems: 'center', gap: 4, borderRadius: 6, paddingHorizontal: 8, paddingVertical: 3, borderWidth: 1 },
  netOnline: { backgroundColor: 'rgba(22,163,74,0.15)', borderColor: 'rgba(22,163,74,0.4)' },
  netOffline: { backgroundColor: 'rgba(239,68,68,0.15)', borderColor: 'rgba(239,68,68,0.4)' },
  netDot: { width: 6, height: 6, borderRadius: 3 },
  netDotOn: { backgroundColor: '#22c55e' },
  netDotOff: { backgroundColor: '#ef4444' },
  netText: { fontSize: 11, color: 'rgba(255,255,255,0.75)', fontWeight: '500' },
  recBadge: { flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: 'rgba(62,106,225,0.18)', borderWidth: 1, borderColor: 'rgba(62,106,225,0.5)', borderRadius: 6, paddingHorizontal: 10, paddingVertical: 4 },
  recDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: '#3e6ae1' },
  recText: { fontSize: 12, fontWeight: '600', color: '#8fb0ff', letterSpacing: 0 },
  queueBanner: { position: 'absolute', top: 80, left: 0, right: 0, backgroundColor: 'rgba(62,106,225,0.85)', paddingVertical: 6, alignItems: 'center', zIndex: 15 },
  queueBannerText: { fontSize: 12, color: '#ffffff', fontWeight: '500' },
  idleHint: { position: 'absolute', left: 26, right: 26, bottom: 130, zIndex: 20, backgroundColor: 'rgba(0,0,0,0.62)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.12)', borderRadius: 12, padding: 18, gap: 10 },
  idleTitle: { color: '#ffffff', fontSize: 22, fontWeight: '600' },
  idleText: { color: 'rgba(255,255,255,0.54)', fontSize: 13, lineHeight: 20 },
  intervalPanel: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 14, marginTop: 4 },
  intervalLabel: { color: 'rgba(255,255,255,0.58)', fontSize: 13, fontWeight: '500' },
  intervalOptions: { flexDirection: 'row', gap: 8 },
  intervalBtn: {
    minWidth: 48,
    height: 34,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.14)',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.06)',
  },
  intervalBtnOn: { backgroundColor: '#3e6ae1', borderColor: '#3e6ae1' },
  intervalBtnText: { color: 'rgba(255,255,255,0.62)', fontSize: 13, fontWeight: '600' },
  intervalBtnTextOn: { color: '#ffffff' },
  statsOverlay: { position: 'absolute', bottom: 120, left: 0, right: 0, flexDirection: 'row', backgroundColor: 'rgba(0,0,0,0.55)', paddingVertical: 16, zIndex: 20 },
  statCell: { flex: 1, alignItems: 'center', gap: 4 },
  statDivider: { width: 1, backgroundColor: 'rgba(255,255,255,0.12)' },
  statVal: { fontSize: 22, fontWeight: '700', color: '#ffffff' },
  statLbl: { fontSize: 11, color: 'rgba(255,255,255,0.45)' },
  summaryWrap: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 32, gap: 24 },
  summaryTitle: { fontSize: 24, fontWeight: '600', color: '#ffffff', letterSpacing: 0 },
  summaryGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 16, width: '100%' },
  summaryCell: { flex: 1, minWidth: '45%', backgroundColor: 'rgba(255,255,255,0.05)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.08)', borderRadius: 12, padding: 20, alignItems: 'center', gap: 6 },
  summaryVal: { fontSize: 28, fontWeight: '600', color: '#ffffff' },
  summaryLbl: { fontSize: 13, color: 'rgba(255,255,255,0.4)' },
  summaryNote: { fontSize: 13, color: 'rgba(255,255,255,0.3)', textAlign: 'center' },
  pollStatus: { fontSize: 13, color: 'rgba(255,255,255,0.5)', textAlign: 'center' },
  uploadStatus: { fontSize: 16, color: '#3e6ae1', fontWeight: '600', textAlign: 'center' },
  queuedStatus: { color: '#22c55e' },
  controls: { position: 'absolute', bottom: 0, left: 0, right: 0, padding: 20, paddingBottom: 40, backgroundColor: 'rgba(0,0,0,0.5)', zIndex: 20 },
  startBtn: { backgroundColor: '#3e6ae1', borderRadius: 8, height: 56, alignItems: 'center', justifyContent: 'center' },
  startBtnText: { fontSize: 18, fontWeight: '600', color: '#ffffff', letterSpacing: 0 },
  progressText: { color: 'rgba(255,255,255,0.58)', textAlign: 'center', fontSize: 12, marginBottom: 10 },
  stopBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 12, backgroundColor: 'rgba(255,255,255,0.1)', borderWidth: 2, borderColor: 'rgba(255,255,255,0.2)', borderRadius: 8, height: 56 },
  stopIcon: { width: 18, height: 18, borderRadius: 4, backgroundColor: '#ffffff' },
  stopBtnText: { fontSize: 17, fontWeight: '600', color: '#ffffff', letterSpacing: 0 },
  actionRow: { flexDirection: 'row', gap: 16 },
  resetBtn: { flex: 1, height: 56, borderRadius: 8, borderWidth: 1, borderColor: 'rgba(255,255,255,0.2)', alignItems: 'center', justifyContent: 'center' },
  resetBtnText: { fontSize: 16, color: 'rgba(255,255,255,0.6)', letterSpacing: 0 },
  uploadBtn: { flex: 2, height: 56, borderRadius: 8, backgroundColor: '#3e6ae1', alignItems: 'center', justifyContent: 'center' },
  uploadBtnDisabled: { backgroundColor: 'rgba(62,106,225,0.35)' },
  uploadBtnText: { fontSize: 18, fontWeight: '600', color: '#ffffff', letterSpacing: 0 },
  uploadingRow: { height: 56, alignItems: 'center', justifyContent: 'center' },
  uploadingText: { fontSize: 15, color: 'rgba(255,255,255,0.5)' },
  permText: { color: '#ffffff', textAlign: 'center', marginTop: 120, fontSize: 16, paddingHorizontal: 32 },
  permBtn: { margin: 32, backgroundColor: '#3e6ae1', borderRadius: 8, padding: 16, alignItems: 'center' },
  permBtnText: { color: '#ffffff', fontSize: 16, fontWeight: '600' },
})
