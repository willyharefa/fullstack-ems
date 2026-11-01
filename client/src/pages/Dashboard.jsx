import { useEffect, useState } from "react"
import EmployeeDashboard from "../components/EmployeeDashboard"
import { dummyAdminDashboardData, dummyEmployeeDashboardData } from "../assets/assets"
import Loading from "../components/Loading"
import AdminDashboard from "../components/AdminDashboard"
import api from "../api/axios"
import toast from "react-hot-toast"

export default function Dashboard() {
    const [data, setData] = useState(null)
    const [loading, setLoading] = useState(true)

    useEffect(() => {
        api.get("/dashboard").then((res) => setData(res.data)).catch((err) => toast.error(err.response?.data?.error || err?.message)).finally(() => setLoading(false))
    },[]);


    if(loading) return <Loading />

    if(!data) return null;
    
    if(data?.role === "ADMIN") {
        return ( <AdminDashboard data={data} /> )
    } else {
        return (<EmployeeDashboard data={data} />)
    }
}