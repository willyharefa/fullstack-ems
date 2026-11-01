import { useState } from "react";
import { useContext, createContext } from "react";
import api from "../api/axios";
import { useEffect } from "react";

const AuthContext = createContext(null)

export function AuthProvider({children}) {
    const [user, setUser] = useState(null)
    const [loading, setLoading] = useState(true)

    const refreshSession = async () => {
        const storedToken = localStorage.getItem("token")
        if(!storedToken) {
            setUser(null);
            setLoading(false);
            return;
        }
        try {
            const { data } = await api.get("/auth/session")
            setUser(data.user)
        } catch {
            localStorage.removeItem("token")
            setUser(null)
        } finally {
            setLoading(false)
        }
    }

    useEffect(() => {
        refreshSession()
    }, [])

    useEffect(() => {
         const onStorage = (e) => {
            if (e.key !== "token" && e.key !== null) return
            if (!e.newValue) {
                setUser(null)
            } else {
                refreshSession()
            }
        }
        window.addEventListener("storage", onStorage)
        return () => window.removeEventListener("storage", onStorage)
    }, [])

    // Dipicu oleh axios interceptor saat server menolak token (401).
    useEffect(() => {
        const onUnauthorized = () => {
            setUser(null)
        }

        window.addEventListener("auth:unauthorized", onUnauthorized)
        return () => window.removeEventListener("auth:unauthorized", onUnauthorized)
    }, [])

    const login = async (email, password, role_type) => {
        const { data } = await api.post("/auth/login", { email, password, role_type })
        localStorage.setItem("token", data.token)
        setUser(data.user);
        return data.user;
    }

    const logout = async () => {
        try {
            // Cabut token di server (tokenVersion naik). Kalau gagal,
            // sesi lokal tetap dibersihkan.
            await api.post("/auth/logout")
        } catch {
            // abaikan: logout lokal tetap harus berhasil
        } finally {
            localStorage.removeItem("token")
            setUser(null);
        }
    }

    const value = {user, loading, login, logout, refreshSession}

    return <AuthContext.Provider value={value}>
        {children}
    </AuthContext.Provider>
}

export function useAuth() {
    const ctx = useContext(AuthContext)
    if( !ctx ) throw new Error("useAuth must be used within AuthProvider");
    return ctx;
}
