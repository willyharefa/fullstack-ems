import axios from "axios";

const api = axios.create({
    baseURL: (import.meta.env.VITE_BASE_URL || "http://localhost:4000") + "/api"
})

// Attach Auth token to all network requests
api.interceptors.request.use((config) => {
    const token = localStorage.getItem("token")
    if( token ) config.headers.Authorization = `Bearer ${token}`
    return config;
})

// Kalau token sudah tidak valid (expired, password diganti, logout di device lain,
// atau akun dinonaktifkan), bersihkan sesi dan minta login ulang.
api.interceptors.response.use(
    (response) => response,
    (error) => {
        const status = error.response?.status
        const url = error.config?.url || ""

        // Jangan tangkap 401 dari percobaan login itu sendiri.
        if (status === 401 && !url.includes("/auth/login")) {
            localStorage.removeItem("token")
            window.dispatchEvent(new Event("auth:unauthorized"))
        }

        return Promise.reject(error)
    }
)

export default api
