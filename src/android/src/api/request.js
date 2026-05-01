import AsyncStorage from '@react-native-async-storage/async-storage'

export const BASE_URL = process.env.EXPO_PUBLIC_API_URL || 'http://39.105.106.58'

async function getToken() {
  return (await AsyncStorage.getItem('token')) || ''
}

export async function uploadFile({ url, filePath, name = 'file', formData = {} }) {
  const token = await getToken()
  const files = Array.isArray(filePath) ? filePath : [filePath]

  const data = new FormData()
  for (const path of files) {
    const ext = path.split('.').pop().toLowerCase()
    const isVideo = ['mp4', 'mov', 'avi'].includes(ext)
    const mimeType = isVideo ? 'video/mp4' : 'image/jpeg'
    const filename = path.split('/').pop() || `upload.${ext}`
    data.append(name, { uri: path, name: filename, type: mimeType })
  }
  for (const [key, value] of Object.entries(formData)) {
    data.append(key, String(value))
  }

  const res = await fetch(`${BASE_URL}${url}`, {
    method: 'POST',
    headers: token ? { Authorization: `Bearer ${token}` } : {},
    body: data,
  })

  if (!res.ok) {
    if (res.status === 401) {
      await AsyncStorage.multiRemove(['token', 'token_type', 'user'])
    }
    let detail = ''
    try {
      detail = (await res.json())?.detail || ''
    } catch {}
    throw new Error(detail || `HTTP ${res.status}`)
  }
  return res.json()
}

export async function request({ method = 'GET', url, data } = {}) {
  const token = await getToken()
  const res = await fetch(`${BASE_URL}${url}`, {
    method,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: data ? JSON.stringify(data) : undefined,
  })
  if (!res.ok) {
    if (res.status === 401) {
      await AsyncStorage.multiRemove(['token', 'token_type', 'user'])
    }
    let detail = ''
    try {
      detail = (await res.json())?.detail || ''
    } catch {}
    throw new Error(detail || `HTTP ${res.status}`)
  }
  return res.json()
}
