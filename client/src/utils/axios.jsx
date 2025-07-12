import axios from "axios";

// Using baseURL as empty string to work with the Vite proxy
const api = axios.create({
  baseURL: "",
  withCredentials: true,
});

export default api;
