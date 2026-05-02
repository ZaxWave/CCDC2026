import { useState } from 'react'
import {
  View, Text, Image, TouchableOpacity, ScrollView,
  TextInput, Alert, ActivityIndicator, StyleSheet,
} from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import * as ImagePicker from 'expo-image-picker'
import * as Location from 'expo-location'
import { checkImageExif, uploadImages } from '../../api/detect'
import { useThemedStyles } from '../../theme'

const LABEL_CN_TO_TYPE = { '纵向裂缝': '裂缝', '横向裂缝': '裂缝', '龟裂': '裂缝', '坑槽': '坑槽' }
const MAX_PHOTOS = 9

function getLocalDateTimeValue(date = new Date()) {
  return new Date(date.getTime() - date.getTimezoneOffset() * 60000).toISOString().slice(0, 16)
}

function normalizeExifTime(value) {
  if (!value) return ''
  if (typeof value === 'number') return getLocalDateTimeValue(new Date(value * 1000))
  const text = String(value).trim()
  const match = text.match(/^(\d{4}):(\d{2}):(\d{2})\s+(\d{2}):(\d{2})/)
  if (match) return `${match[1]}-${match[2]}-${match[3]}T${match[4]}:${match[5]}`
  if (/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}/.test(text)) return text.slice(0, 16)
  return ''
}

function getAssetCaptureTime(asset) {
  const exif = asset?.exif || {}
  return normalizeExifTime(
    exif.DateTimeOriginal ||
    exif.DateTimeDigitized ||
    exif.DateTime ||
    exif['{Exif}']?.DateTimeOriginal ||
    exif['{TIFF}']?.DateTime
  )
}

function isValidCaptureTime(value) {
  return /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(value || '')
}

function summarizeResults(results) {
  const list = Array.isArray(results) ? results : [results]
  const detections = list.flatMap(item => item?.detections ?? [])
  const top = detections.reduce((best, item) => {
    if (!best) return item
    return (item.conf || 0) > (best.conf || 0) ? item : best
  }, null)

  return {
    images: list.length,
    detections: detections.length,
    topLabel: top?.label_cn ? (LABEL_CN_TO_TYPE[top.label_cn] || top.label_cn) : '未发现明显病害',
    topConfidence: top?.conf,
  }
}

export default function ReportScreen({ navigation, route }) {
  const s = useThemedStyles(createStyles)
  const isWorkerUpload = route?.params?.source === 'worker'
  const [photos, setPhotos] = useState([])
  const [phase, setPhase] = useState('idle')
  const [captureAt, setCaptureAt] = useState(getLocalDateTimeValue())
  const [captureRequired, setCaptureRequired] = useState(false)
  const [captureSource, setCaptureSource] = useState('待检查')
  const [gpsStatus, setGpsStatus] = useState('idle')
  const [gpsCoords, setGpsCoords] = useState(null)
  const [summary, setSummary] = useState(null)
  const [errorMsg, setErrorMsg] = useState('')

  const busy = phase === 'checking' || phase === 'locating' || phase === 'uploading'
  const remaining = MAX_PHOTOS - photos.length

  const resetResultState = () => {
    setSummary(null)
    setErrorMsg('')
    if (phase === 'done') setPhase('idle')
  }

  const addPhotos = (assets) => {
    const nextAssets = assets.slice(0, remaining).map(asset => ({ uri: asset.uri, exif: asset.exif || {} }))
    if (!nextAssets.length) return

    setPhotos(prev => [...prev, ...nextAssets])
    resetResultState()

    const exifTime = nextAssets.map(getAssetCaptureTime).find(Boolean)
    if (exifTime) {
      setCaptureAt(exifTime)
      setCaptureRequired(false)
      setCaptureSource('EXIF')
    } else if (captureSource === '待检查') {
      setCaptureSource('待检查')
    }
  }

  const takePhoto = async () => {
    if (remaining <= 0 || busy) return
    const { status } = await ImagePicker.requestCameraPermissionsAsync()
    if (status !== 'granted') {
      Alert.alert('需要摄像头权限', '请允许 LightScan 使用摄像头拍摄巡检照片。')
      return
    }
    const result = await ImagePicker.launchCameraAsync({ quality: 0.86, exif: true })
    if (!result.canceled) addPhotos(result.assets)
  }

  const pickPhotos = async () => {
    if (remaining <= 0 || busy) return
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync()
    if (status !== 'granted') {
      Alert.alert('需要相册权限', '请允许 LightScan 读取相册以选择巡检照片。')
      return
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsMultipleSelection: true,
      quality: 0.86,
      exif: true,
      selectionLimit: remaining,
    })
    if (!result.canceled) addPhotos(result.assets)
  }

  const removePhoto = (index) => {
    setPhotos(prev => prev.filter((_, i) => i !== index))
    resetResultState()
  }

  const resolveCaptureTime = async () => {
    if (captureRequired) {
      if (!isValidCaptureTime(captureAt)) {
        Alert.alert('时间格式不正确', '请按 YYYY-MM-DDTHH:mm 格式填写，例如 2026-04-30T14:30。')
        return ''
      }
      setCaptureSource('手动')
      return captureAt
    }

    const fromAssets = photos.map(getAssetCaptureTime).find(Boolean)
    if (fromAssets) {
      setCaptureAt(fromAssets)
      setCaptureSource('EXIF')
      return fromAssets
    }

    setPhase('checking')
    const checks = await Promise.allSettled(photos.slice(0, 3).map(photo => checkImageExif(photo.uri)))
    const found = checks.find(r => r.status === 'fulfilled' && r.value?.has_capture_time)
    if (found) {
      const backendTime = String(found.value.capture_time).slice(0, 16)
      setCaptureAt(backendTime)
      setCaptureSource('EXIF')
      return backendTime
    }

    setCaptureRequired(true)
    setCaptureSource('手动')
    if (!captureAt) setCaptureAt(getLocalDateTimeValue())
    Alert.alert('需要确认拍摄时间', '这些图片没有可读取的 EXIF 拍摄时间，请确认下方时间后再次提交。')
    return ''
  }

  const resolveLocation = async () => {
    setPhase('locating')
    try {
      const { status } = await Location.requestForegroundPermissionsAsync()
      if (status !== 'granted') {
        setGpsStatus('failed')
        return { lat: null, lng: null }
      }
      const loc = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.High })
      const coords = { lat: loc.coords.latitude, lng: loc.coords.longitude }
      setGpsCoords(coords)
      setGpsStatus('ok')
      return coords
    } catch {
      setGpsStatus('failed')
      return { lat: null, lng: null }
    }
  }

  const handleSubmit = async () => {
    if (busy) return
    if (photos.length === 0) {
      Alert.alert('请先添加照片', isWorkerUpload ? '拍摄或选择巡检照片后再提交检测。' : '请至少添加一张现场照片。')
      return
    }

    setSummary(null)
    setErrorMsg('')

    try {
      const capturedAt = await resolveCaptureTime()
      if (!capturedAt) {
        setPhase('idle')
        return
      }

      const { lat, lng } = await resolveLocation()
      setPhase('uploading')
      const results = await uploadImages(photos.map(photo => photo.uri), lat, lng, capturedAt)
      setSummary(summarizeResults(results))
      setPhase('done')
    } catch (e) {
      setErrorMsg(e.message || '上传失败，请稍后重试')
      setPhase('idle')
    }
  }

  const title = isWorkerUpload ? '拍照巡检' : '问题上报'
  const subtitle = isWorkerUpload ? '专业版' : '随手拍'
  const stepPhotoDone = photos.length > 0
  const stepInfoDone = captureSource === 'EXIF' || captureSource === '手动'
  const stepUploadDone = phase === 'done'
  const submitText = phase === 'checking'
    ? '检查照片信息'
    : phase === 'locating'
    ? '获取定位'
    : phase === 'uploading'
    ? '上传检测中'
    : phase === 'done'
    ? '重新提交检测'
    : isWorkerUpload
    ? '提交检测'
    : '提交上报'

  return (
    <SafeAreaView style={s.page}>
      <View style={s.header}>
        <View style={s.headerLeft}>
          <TouchableOpacity onPress={() => navigation.goBack()} activeOpacity={0.7}>
            <Text style={s.backIcon}>‹</Text>
          </TouchableOpacity>
          <View>
            <Text style={s.headerTitle}>{title}</Text>
            <Text style={s.headerHint}>{isWorkerUpload ? '上传后写入病害记录' : '识别并生成平台记录'}</Text>
          </View>
        </View>
        <Text style={s.headerSub}>{subtitle}</Text>
      </View>

      <View style={s.progressBar}>
        {[
          { key: 'photo', label: '取证', done: stepPhotoDone, active: !stepPhotoDone },
          { key: 'info', label: '信息', done: stepInfoDone, active: stepPhotoDone && !stepInfoDone },
          { key: 'upload', label: '检测', done: stepUploadDone, active: busy || (stepInfoDone && !stepUploadDone) },
        ].map((step, index) => (
          <View key={step.key} style={s.stepWrap}>
            <View style={[s.stepDot, step.done && s.stepDotDone, step.active && s.stepDotActive]}>
              <Text style={[s.stepNum, (step.done || step.active) && s.stepNumOn]}>{index + 1}</Text>
            </View>
            <Text style={[s.stepText, (step.done || step.active) && s.stepTextOn]}>{step.label}</Text>
            {index < 2 && <View style={[s.stepLine, step.done && s.stepLineDone]} />}
          </View>
        ))}
      </View>

      <ScrollView style={s.scroll} contentContainerStyle={s.body} showsVerticalScrollIndicator={false}>
        <View style={s.panel}>
          <View style={s.panelTop}>
            <Text style={s.panelTitle}>{isWorkerUpload ? '现场取证' : '道路问题取证'}</Text>
            <Text style={s.panelCount}>{photos.length}/{MAX_PHOTOS}</Text>
          </View>
          <Text style={s.panelText}>
            {isWorkerUpload
              ? '建议同一病害拍 2-4 张不同角度照片。位置和拍摄时间会随记录一并保存。'
              : '拍摄清晰的路面照片，系统会识别病害类型并记录位置。'}
          </Text>
          <View style={s.actionRow}>
            <TouchableOpacity
              style={[s.primaryAction, (busy || remaining <= 0) && s.actionDisabled]}
              onPress={takePhoto}
              activeOpacity={0.75}
              disabled={busy || remaining <= 0}
            >
              <Text style={s.primaryActionText}>拍照</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[s.secondaryAction, (busy || remaining <= 0) && s.actionDisabled]}
              onPress={pickPhotos}
              activeOpacity={0.75}
              disabled={busy || remaining <= 0}
            >
              <Text style={s.secondaryActionText}>从相册选择</Text>
            </TouchableOpacity>
          </View>
        </View>

        <View style={s.photoGrid}>
          {photos.map((p, i) => (
            <View key={`${p.uri}-${i}`} style={s.photoCell}>
              <Image source={{ uri: p.uri }} style={s.photoImg} resizeMode="cover" />
              <Text style={s.photoIndex}>{String(i + 1).padStart(2, '0')}</Text>
              <TouchableOpacity style={s.photoRemove} onPress={() => removePhoto(i)} disabled={busy}>
                <Text style={s.removeX}>×</Text>
              </TouchableOpacity>
            </View>
          ))}
          {photos.length === 0 && (
            <View style={s.emptyPhotos}>
              <Text style={s.emptyTitle}>还没有照片</Text>
              <Text style={s.emptyText}>先拍摄或选择现场图片</Text>
            </View>
          )}
        </View>

        <View style={s.infoPanel}>
          <Text style={s.secLabel}>提交信息</Text>
          <View style={s.infoRow}>
            <Text style={s.infoName}>拍摄时间</Text>
            <Text style={[s.infoValue, captureSource === '手动' && s.warnText]}>{captureSource}</Text>
          </View>
          {captureRequired && (
            <>
              <TextInput
                style={s.timeInput}
                placeholder="YYYY-MM-DDTHH:mm"
                placeholderTextColor={s.placeholder.color}
                value={captureAt}
                onChangeText={setCaptureAt}
                autoCapitalize="none"
              />
              <Text style={s.timeHint}>图片缺少 EXIF 时间时，将使用这里的时间写入巡检记录。</Text>
            </>
          )}
          <View style={s.infoRow}>
            <Text style={s.infoName}>定位</Text>
            <Text style={[s.infoValue, gpsStatus === 'failed' && s.warnText]}>
              {gpsStatus === 'ok' && gpsCoords
                ? `${gpsCoords.lat.toFixed(5)}, ${gpsCoords.lng.toFixed(5)}`
                : gpsStatus === 'failed'
                ? '未获取，将使用后端兜底'
                : '提交时获取'}
            </Text>
          </View>
        </View>

        {summary && (
          <View style={s.resultPanel}>
            <Text style={s.resultTitle}>检测完成</Text>
            <View style={s.resultGrid}>
              <View style={s.resultCell}>
                <Text style={s.resultValue}>{summary.images}</Text>
                <Text style={s.resultLabel}>图片</Text>
              </View>
              <View style={s.resultCell}>
                <Text style={s.resultValue}>{summary.detections}</Text>
                <Text style={s.resultLabel}>病害</Text>
              </View>
            </View>
            <Text style={s.resultText}>
              {summary.detections > 0
                ? `主要识别：${summary.topLabel}${summary.topConfidence ? ` · ${(summary.topConfidence * 100).toFixed(0)}%` : ''}`
                : '未发现明显病害，照片仍可作为巡检证据补充。'}
            </Text>
          </View>
        )}

        {!!errorMsg && (
          <View style={s.errorBox}>
            <Text style={s.errorText}>{errorMsg}</Text>
          </View>
        )}

        <TouchableOpacity
          style={[s.submitBtn, (busy || photos.length === 0) && s.submitBtnDisabled]}
          onPress={handleSubmit}
          activeOpacity={0.75}
          disabled={busy || photos.length === 0}
        >
          {busy ? <ActivityIndicator color="#fff" /> : <Text style={s.submitText}>{submitText}</Text>}
        </TouchableOpacity>

        {phase === 'done' && (
          <TouchableOpacity style={s.closeBtn} onPress={() => navigation.goBack()} activeOpacity={0.7}>
            <Text style={s.closeBtnText}>{isWorkerUpload ? '返回工作台' : '返回首页'}</Text>
          </TouchableOpacity>
        )}
      </ScrollView>
    </SafeAreaView>
  )
}

const createStyles = (t) => StyleSheet.create({
  page: { flex: 1, backgroundColor: t.bg },
  header: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    paddingHorizontal: 20, paddingVertical: 14,
    borderBottomWidth: 1, borderBottomColor: t.border,
  },
  headerLeft: { flexDirection: 'row', alignItems: 'center', gap: 10, flex: 1 },
  backIcon: { fontSize: 30, color: t.textSoft, lineHeight: 34 },
  headerTitle: { fontSize: 18, fontWeight: '500', color: t.text },
  headerHint: { fontSize: 11, color: t.textFaint, marginTop: 3 },
  headerSub: { fontSize: 12, color: t.blue, fontWeight: '500' },
  progressBar: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: t.border,
  },
  stepWrap: { flexDirection: 'row', alignItems: 'center', flex: 1 },
  stepDot: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: t.surface,
    borderWidth: 1,
    borderColor: t.borderStrong,
    alignItems: 'center',
    justifyContent: 'center',
  },
  stepDotActive: { borderColor: t.blue, backgroundColor: t.blueSoft },
  stepDotDone: { borderColor: t.blue, backgroundColor: t.blue },
  stepNum: { color: t.textFaint, fontSize: 11, fontWeight: '500' },
  stepNumOn: { color: '#ffffff' },
  stepText: { color: t.textFaint, fontSize: 12, fontWeight: '500', marginLeft: 7 },
  stepTextOn: { color: t.textSoft },
  stepLine: { height: 1, backgroundColor: t.border, flex: 1, marginHorizontal: 10 },
  stepLineDone: { backgroundColor: 'rgba(62,106,225,0.7)' },
  scroll: { flex: 1 },
  body: { padding: 18, gap: 14, paddingBottom: 48 },
  panel: {
    backgroundColor: t.panel,
    borderWidth: 1,
    borderColor: t.border,
    borderRadius: 12,
    padding: 16,
    gap: 14,
  },
  panelTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  panelTitle: { fontSize: 18, color: t.text, fontWeight: '500' },
  panelCount: { fontSize: 13, color: t.textMuted },
  panelText: { color: t.textMuted, fontSize: 13, lineHeight: 20 },
  actionRow: { flexDirection: 'row', gap: 10 },
  primaryAction: {
    flex: 1, height: 46, borderRadius: 4, backgroundColor: t.blue,
    alignItems: 'center', justifyContent: 'center',
  },
  primaryActionText: { color: '#ffffff', fontWeight: '500', fontSize: 15 },
  secondaryAction: {
    flex: 1, height: 46, borderRadius: 4, borderWidth: 1, borderColor: t.borderStrong,
    alignItems: 'center', justifyContent: 'center',
  },
  secondaryActionText: { color: t.textSoft, fontWeight: '500', fontSize: 15 },
  actionDisabled: { opacity: 0.45 },
  photoGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  photoCell: {
    width: '31.8%', aspectRatio: 1, borderRadius: 4, overflow: 'hidden',
    backgroundColor: t.surface,
  },
  photoImg: { width: '100%', height: '100%' },
  photoIndex: {
    position: 'absolute', left: 6, bottom: 5, color: '#ffffff',
    fontSize: 11, fontWeight: '500', backgroundColor: 'rgba(0,0,0,0.45)',
    paddingHorizontal: 5, paddingVertical: 2, borderRadius: 4,
  },
  photoRemove: {
    position: 'absolute', top: 5, right: 5,
    width: 23, height: 23, borderRadius: 12,
    backgroundColor: 'rgba(0,0,0,0.62)', alignItems: 'center', justifyContent: 'center',
  },
  removeX: { color: '#ffffff', fontSize: 16, lineHeight: 19 },
  emptyPhotos: {
    flex: 1, minHeight: 118, borderRadius: 12, borderWidth: 1, borderColor: t.borderStrong,
    borderStyle: 'dashed', alignItems: 'center', justifyContent: 'center', gap: 5,
  },
  emptyTitle: { color: t.textMuted, fontSize: 15, fontWeight: '500' },
  emptyText: { color: t.textFaint, fontSize: 12 },
  infoPanel: {
    backgroundColor: t.panel,
    borderRadius: 12, padding: 14, gap: 12,
    borderWidth: 1, borderColor: t.border,
  },
  secLabel: { fontSize: 13, fontWeight: '500', color: t.textSoft, letterSpacing: 0 },
  infoRow: { flexDirection: 'row', justifyContent: 'space-between', gap: 16, alignItems: 'center' },
  infoName: { color: t.textMuted, fontSize: 13 },
  infoValue: { color: t.textSoft, fontSize: 13, flexShrink: 1, textAlign: 'right' },
  warnText: { color: '#f59e0b' },
  timeInput: {
    backgroundColor: t.input,
    borderWidth: 1, borderColor: 'rgba(245,158,11,0.45)',
    borderRadius: 4, paddingHorizontal: 12, height: 44, fontSize: 14, color: t.text,
  },
  placeholder: { color: t.textFaint },
  timeHint: { fontSize: 12, color: t.textFaint, lineHeight: 18 },
  resultPanel: {
    borderRadius: 12, padding: 16, gap: 12,
    backgroundColor: 'rgba(34,197,94,0.08)',
    borderWidth: 1, borderColor: 'rgba(34,197,94,0.28)',
  },
  resultTitle: { color: '#22c55e', fontSize: 16, fontWeight: '500' },
  resultGrid: { flexDirection: 'row', gap: 10 },
  resultCell: {
    flex: 1, borderRadius: 4, backgroundColor: t.isDark ? 'rgba(0,0,0,0.2)' : 'rgba(255,255,255,0.68)',
    alignItems: 'center', paddingVertical: 14,
  },
  resultValue: { color: t.text, fontSize: 25, fontWeight: '500' },
  resultLabel: { color: t.textMuted, fontSize: 12, marginTop: 2 },
  resultText: { color: t.textSoft, fontSize: 13, lineHeight: 20 },
  errorBox: {
    backgroundColor: 'rgba(239,68,68,0.1)',
    borderWidth: 1, borderColor: 'rgba(239,68,68,0.32)',
    borderRadius: 4, padding: 12,
  },
  errorText: { color: '#ef4444', fontSize: 13, lineHeight: 19 },
  submitBtn: {
    backgroundColor: t.blue, borderRadius: 4,
    height: 54, alignItems: 'center', justifyContent: 'center', marginTop: 4,
  },
  submitBtnDisabled: { backgroundColor: 'rgba(62,106,225,0.38)' },
  submitText: { fontSize: 17, fontWeight: '500', color: '#ffffff', letterSpacing: 0 },
  closeBtn: { height: 46, alignItems: 'center', justifyContent: 'center' },
  closeBtnText: { color: t.textMuted, fontSize: 14, fontWeight: '500' },
})
