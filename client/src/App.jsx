import { Toaster } from "react-hot-toast"
import { Navigate, Route, Routes } from "react-router-dom"
import Login from "./pages/Login"
import Layout from "./pages/Layout"
import Dashboard from "./pages/Dashboard"
import Employees from "./pages/Employees"
import Attendance from "./pages/Attendance"
import Leave from "./pages/Leave"
import Payslip from "./pages/Payslips"
import Settings from "./pages/Settings"
import PrintPayslip from "./pages/PrintPayslip"
import LoginForm from "./components/LoginForm"
import RequireRole from "./components/RequireRole"

export default function App() {
    return (
        <>
            <Toaster />
            <Routes>
                <Route path="/login" element={ <Login /> } />

                <Route 
                    path="/login/admin" 
                    element={
                        <LoginForm 
                            role="admin"
                            title="Admin Portal"
                            subtitle="Sign in to manage the organization"
                        /> } 
                />
                <Route 
                    path="/login/employee"
                    element={ 
                        <LoginForm 
                            role="employee"
                            title="Employee Portal"
                            subtitle="Sign in to access your account"
                    /> }
                />

                <Route element={ <Layout /> }>
                    <Route path="/dashboard" element={ <Dashboard /> } />
                    <Route
                        path="/employees"
                        element={
                            <RequireRole allowedRoles={["ADMIN"]}>
                                <Employees />
                            </RequireRole>
                        }
                    />
                    <Route
                        path="/attendance"
                        element={
                            <RequireRole allowedRoles={["EMPLOYEE"]}>
                                <Attendance />
                            </RequireRole>
                        }
                    />
                    <Route path="/leave" element={ <Leave /> } />
                    <Route path="/payslips" element={ <Payslip /> } />
                    <Route path="/settings" element={ <Settings /> } />
                </Route>
                <Route path="/print/payslips/:id" element={ <PrintPayslip /> } />
                <Route path="*" element={ <Navigate to="/dashboard" replace /> } />
            </Routes>
        </>
    )
}