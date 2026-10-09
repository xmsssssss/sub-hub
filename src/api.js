import axios from 'axios';

const api = axios.create({
  baseURL: '/api',
  timeout: 30000
});

api.interceptors.request.use(config => {
  const token = localStorage.getItem('sub_token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

api.interceptors.response.use(
  res => res.data,
  err => {
    if (err.response && err.response.status === 401) {
      localStorage.removeItem('sub_token');
      window.dispatchEvent(new CustomEvent('auth-expired'));
    }
    const message = err.response?.data?.error || err.message || '请求失败';
    return Promise.reject(new Error(message));
  }
);

export default api;
