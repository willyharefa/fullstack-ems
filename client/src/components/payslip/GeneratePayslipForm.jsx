import { Loader2, Plus, X } from "lucide-react"
import { useState } from "react"
import api from "../../api/axios"
import toast from "react-hot-toast"

export default function GeneratePayslipForm({ employees, onSuccess }) {

    const [isOpen, setIsOpen] = useState(false)
    const [loading, setLoading] = useState(false)

    if(!isOpen) return (
        <button 
            className="btn-primary flex items-center gap-2 cursor-pointer"
            onClick={ () => setIsOpen(true)}
        >
            <Plus className="w-4 h-4" /> Generate Payslip
        </button>
    )

    const handleSubmit = async (e) => {
        e.preventDefault();
        setLoading(true)
        const formData = new FormData(e.currentTarget)
        const data = Object.fromEntries(formData.entries())
        try {
            await api.post("/payslips", data)
            setIsOpen(false)
            onSuccess?.()
            setIsOpen(false)
        } catch (err) {
            toast.error(err?.response?.data?.error || err?.message)
        } finally {
            setLoading(false)
        }
    }

    return (
        <div
            className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center z-50 p-4"
        >
            <div
                className="card max-w-lg w-full p-6 animate-slide-up"
            >
                <div className="flex justify-between items-center mb-6">
                    <h3>Generate Monthly Payslip</h3>
                    <button
                        className="text-slate-400 hover:text-slate-600 p-1 cursor-pointer"
                        onClick={ () => setIsOpen(false) }
                    >
                        <X size={20} />
                    </button>
                </div>
                <form 
                    onSubmit={handleSubmit}
                    className="space-y-4"
                >
                    {/* Select Employee */}
                    <div>
                        <label htmlFor="employee-id" className="block text-sm font-medium text-slate-700 mb-2">
                            Employee
                        </label>
                        <select name="employeeId" id="employee-id" required>
                            {
                                employees.map((e) => (
                                    <option key={e.id} value={e.id}>
                                        {e.firstName} {e.lastName} - {e.position}
                                    </option>
                                ))
                            }
                        </select>
                    </div>
                    {/* Select Month & Year */}
                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <label htmlFor="month-select" className="block text-sm font-medium text-slate-700 mb-2">
                                Month
                            </label>
                            <select name="month" id="month-select">
                                {Array.from({length: 12}, (_, i) => i + 1).map((m) => (
                                    <option key={m} value={m}>
                                        {m}
                                    </option>
                                ))}
                            </select>
                        </div>
                        <div>
                            <label htmlFor="year" className="block text-sm font-medium text-slate-700 mb-2">
                                Year
                            </label>
                            <input type="number" min={new Date().getFullYear() - 5} name="year" id="year" defaultValue={new Date().getFullYear()} />
                        </div>
                    </div>

                    {/* Basic Salary */}
                    <div>
                        <label htmlFor="basic-salary" className="block text-sm font-medium text-slate-700 mb-2">
                            Basic Salary
                        </label>
                        <input type="number" min="0" name="basicSalary" id="basic-salary" required placeholder="5000"/>
                    </div>

                    {/* Allowance & Deductions */}
                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <label htmlFor="allowances" className="block text-sm font-medium text-slate-700 mb-2">Allowances</label>
                            <input type="number" min="0" name="allowances" id="allowances" required defaultValue="0" />
                        </div>
                        <div>
                            <label htmlFor="deductions" className="block text-sm font-medium text-slate-700 mb-2">Deduction</label>
                            <input type="number" min="0" name="deductions" id="deductions" required defaultValue="0" />
                        </div>
                    </div>
                    {/* Buttons */}
                    <div className="flex justify-end gap-3 pt-2">
                        <button 
                            type="button" 
                            className="btn-secondary cursor-pointer"
                            onClick={() => setIsOpen(false)}
                        >
                            Cancel
                        </button>
                        <button 
                            disabled={loading}
                            type="submit" 
                            className="btn-primary flex items-center cursor-pointer"
                        >
                            { loading && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                            Generate
                        </button>
                    </div>
                </form>
            </div>
        </div>
    )
}