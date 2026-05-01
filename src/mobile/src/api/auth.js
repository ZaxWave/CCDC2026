import Taro from '@tarojs/taro'
import { BASE_URL } from './request'

export async function login(username, password) {
  const body = `username=${encodeURIComponent(username)}&password=${encodeURIComponent(password)}`
  const res = await Taro.request({
    method: 'POST',
    url: `${BASE_URL}/api/v1/auth/login`,
    data: body,
    header: {
      'Content-Type': 'application/x-www-form-urlencoded',
    },
  })
  if (res.statusCode >= 200 && res.statusCode < 300) {
    return res.data
  }
  throw new Error(res.data?.detail || `HTTP ${res.statusCode}`)
}
