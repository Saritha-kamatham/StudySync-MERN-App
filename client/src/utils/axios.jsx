import axios from "axios";

// Determine the base URL based on environment
const getBaseURL = () => {
  // In production, use the environment variable or fallback to current domain
  if (import.meta.env.PROD) {
    return import.meta.env.VITE_API_URL || window.location.origin;
  }
  // In development, use empty string to work with Vite proxy
  return "";
};

const api = axios.create({
  baseURL: getBaseURL(),
  withCredentials: true,
  timeout: 10000, // 10 second timeout
});

// Add request interceptor for debugging
api.interceptors.request.use(
  (config) => {
    console.log('API Request:', config.method?.toUpperCase(), config.url);
    return config;
  },
  (error) => {
    console.error('API Request Error:', error);
    return Promise.reject(error);
  }
);

// Add response interceptor for debugging
api.interceptors.response.use(
  (response) => {
    console.log('API Response:', response.status, response.config.url);
    return response;
  },
  (error) => {
    console.error('API Response Error:', error.response?.status, error.config?.url, error.message);
    return Promise.reject(error);
  }
);

export default api;
