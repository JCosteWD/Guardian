import axios from 'axios';

const apiBaseUrl = process.env.REACT_APP_API_URL
  || 'http://localhost:3000/api';

export const API = axios.create({ baseURL: apiBaseUrl });
API.interceptors.request.use(cfg => {
  const token = localStorage.getItem('guardian_token');
  if (token && !cfg.headers.Authorization) cfg.headers.Authorization = `Bearer ${token}`;
  return cfg;
});
