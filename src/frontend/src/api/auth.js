const BASE_URL = '/api/v1/auth';

export async function loginUser(username, password) {
  // FastAPI 要求登录必须是 form-data (x-www-form-urlencoded) 格式
  const formData = new URLSearchParams();
  formData.append('username', username);
  formData.append('password', password);

  const res = await fetch(`${BASE_URL}/login`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: formData,
  });

  if (!res.ok) {
    const err = await res.json();
    throw new Error(err.detail || '登录失败');
  }
  return res.json();
}

export async function registerUser(username, password) {
  const res = await fetch(`${BASE_URL}/register`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      username,
      password,
      role: 'worker' 
    }),
  });

  if (!res.ok) {
    const err = await res.json();
    throw new Error(err.detail || '注册失败');
  }
  return res.json();
}