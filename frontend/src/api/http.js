import axios from "axios";

const fallbackApiBase = `${window.location.protocol}//${window.location.hostname}:5000/api`;

const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL || fallbackApiBase,
  headers: {
    "Content-Type": "application/json",
  },
});

export default api;
