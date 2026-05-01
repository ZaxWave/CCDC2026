import { request, uploadFile } from './request'

/**
 * 上传单张图片进行病害检测，附带可选 GPS 坐标
 * @param {string}      filePath  - 图片临时路径（Taro.chooseMedia 返回的 tempFilePath）
 * @param {number|null} lat       - 纬度（gcj02），无则传 null
 * @param {number|null} lng       - 经度（gcj02），无则传 null
 * @returns {Promise<object>}     - 单条检测结果 {filename, detections, image_b64, location, ...}
 */
export async function checkImageExif(filePath) {
  return uploadFile({
    url: '/api/v1/check-exif',
    filePath,
    name: 'file',
  })
}

export async function uploadImage(filePath, lat = null, lng = null, capturedAt = '') {
  const formData = {}
  if (lat != null) formData.lat = String(lat)
  if (lng != null) formData.lng = String(lng)
  if (capturedAt) formData.captured_at = capturedAt
  formData.source_type = 'mobile'

  const results = await uploadFile({
    url: '/api/v1/detect',
    filePath,
    name: 'files',
    formData,
  })
  // 后端返回 list，取第一项
  return Array.isArray(results) ? results[0] : results
}

/**
 * 上传巡检视频 + GPS 轨迹，使用 gps 模式按真实距离抽帧
 * @param {string} filePath        - 视频临时路径
 * @param {Array}  gpsTrack        - [{lat, lng, timestamp_ms, speed_kmh}, ...]
 * @param {number} intervalMeters  - 抽帧间隔（米），默认 5m
 * @returns {Promise<object>}      - {task_id, status}
 */
export async function submitVideo(filePath, gpsTrack, intervalMeters = 5) {
  return uploadFile({
    url: '/api/v1/detect-video',
    filePath,
    name: 'file',
    formData: {
      mode: 'gps',
      gps_track: JSON.stringify(gpsTrack),
      interval_meters: String(intervalMeters),
    },
  })
}

export function getVideoTaskStatus(taskId) {
  return request({
    method: 'GET',
    url: `/api/v1/detect-video/status/${taskId}`,
  })
}

function wait(ms) {
  return new Promise(resolve => setTimeout(resolve, ms))
}

export async function uploadVideo(filePath, gpsTrack, intervalMeters = 5, onProgress) {
  const task = await submitVideo(filePath, gpsTrack, intervalMeters)
  const taskId = task?.task_id
  if (!taskId) return task

  for (let i = 0; i < 180; i += 1) {
    await wait(1500)
    const status = await getVideoTaskStatus(taskId)
    onProgress?.(status)
    if (status.status === 'done') return status.result
    if (status.status === 'failed') throw new Error(status.error || '视频检测失败')
  }
  throw new Error('视频检测超时，请稍后查看结果')
}
