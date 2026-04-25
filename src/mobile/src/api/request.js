import Taro from '@tarojs/taro'

// 真机测试时改为电脑的局域网 IP，例如 http://192.168.1.100:8000
// 可通过 src/mobile/.env 文件中 TARO_APP_API_URL=http://192.168.x.x:8000 配置
export const BASE_URL = process.env.TARO_APP_API_URL || 'http://localhost:8000'

function getToken() {
  return Taro.getStorageSync('token') || ''
}

/**
 * 上传单个文件（multipart/form-data）
 * 返回解析后的 JSON；失败时 throw Error
 */
export function uploadFile({ url, filePath, name = 'file', formData = {} }) {
  const token = getToken()
  return new Promise((resolve, reject) => {
    Taro.uploadFile({
      url: `${BASE_URL}${url}`,
      filePath,
      name,
      formData,
      header: token ? { Authorization: `Bearer ${token}` } : {},
      success(res) {
        if (res.statusCode >= 200 && res.statusCode < 300) {
          try {
            resolve(JSON.parse(res.data))
          } catch {
            resolve(res.data)
          }
        } else {
          reject(new Error(`HTTP ${res.statusCode}`))
        }
      },
      fail(err) {
        reject(new Error(err.errMsg || '网络请求失败'))
      },
    })
  })
}

/**
 * 通用 JSON 请求
 */
export async function request({ method = 'GET', url, data } = {}) {
  const token = getToken()
  const res = await Taro.request({
    method,
    url: `${BASE_URL}${url}`,
    data,
    header: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
  })
  if (res.statusCode >= 200 && res.statusCode < 300) {
    return res.data
  }
  throw new Error(`HTTP ${res.statusCode}`)
}
