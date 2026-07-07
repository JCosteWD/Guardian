import axios from 'axios';

export const API = axios.create({ baseURL: 'http://localhost:3000/api' });
API.interceptors.request.use(cfg => {
  const token = localStorage.getItem('guardian_token');
  if (token) cfg.headers.Authorization = `Bearer ${token}`;
  return cfg;
});
