import Employee from "../models/Employee.js";
import Payslip from "../models/Payslip.js";

export const createPayslip = async (req, res) => {
    try {
        const { employeeId, month, year, basicSalary, allowances, deductions } = req.body

        if (
            !employeeId ||
            !month ||
            !year ||
            !basicSalary
        ) {
            return res.status(400).json({
                error: "Missing fields"
            });
        }

        const monthNum = Number(month);
        const yearNum = Number(year);

        if ( !Number.isInteger(monthNum) || monthNum < 1 || monthNum > 12 ) {
            return res.status(400).json({
                error: "month must be an integer between 1 and 12"
            });
        }

        if ( !Number.isInteger(yearNum) || yearNum < 2000 || yearNum > 2100 ) {
            return res.status(400).json({
                error: "year is not valid"
            });
        }

        if ( Number(basicSalary) < 0 ) {
            return res.status(400).json({
                error: "basic salary cannot be negative"
            });
        }

        const employee = await Employee.findById(employeeId).lean();

        if( !employee ) {
            return res.status(404).json({
                error: "Employee not found"
            });
        }

        const existingPayslip = await Payslip.findOne({
            employeeId,
            month: monthNum,
            year: yearNum,
        });

        if( existingPayslip ) {
            return res.status(409).json({
                error: "Payslip for this employee and period already exists"
            });
        }

        const netSalary = Number(basicSalary) + Number(allowances || 0) - Number(deductions || 0)

        const payslip = await Payslip.create({
            employeeId,
            month: monthNum,
            year: yearNum,
            basicSalary: Number(basicSalary),
            allowances: Number(allowances) || 0,
            deductions: Number(deductions) || 0,
            netSalary,
        })

        return res.json({
            success: true,
            data: payslip
        })
    } catch (error) {
        // Unique index (employeeId, month, year) menangkap race condition
        // yang lolos dari pengecekan existingPayslip di atas.
        if ( error?.code === 11000 ) {
            return res.status(409).json({
                error: "Payslip for this employee and period already exists"
            })
        }

        console.error("Create payslip error:", error);

        return res.status(500).json({
            error: "Failed"
        })
    }
}

export const getPayslips = async (req, res) => {
    try {
        const user = req.user
        const isAdmin = user.role === "ADMIN"

        if (isAdmin) {
            const payslips = await Payslip.find().populate("employeeId").sort({ createdAt: -1 })
            const data = payslips.map((p) => {
                const obj = p.toObject()
                return {
                    ...obj,
                    id: obj._id.toString(),
                    employee: obj.employeeId,
                    employeeId: obj.employeeId?._id?.toString(),
                }
            })
            return res.json({ data })
        } else {
            const employee = await Employee.findOne({
                userId: user.userId
            })

            if (!employee) return res.status(404).json({ error: "Not found" });
            
            const payslips = await Payslip.find({
                employeeId: employee._id
            }).sort({ createdAt: -1 });

            return res.json({ data: payslips })
        }

    } catch (error) {
        return res.status(500).json({
            error: "Failed"
        })
    }
}

export const getPayslipById = async (req, res) => {
    try {
        const payslip = await Payslip.findById(req.params.id).populate("employeeId").lean();
        if ( !payslip ) return res.status(404).json({ error: "Not found" });

        if( req.user.role !== "ADMIN" ) {
            const employee = await Employee.findOne({
                userId: req.user.userId
            }).lean();

            const isOwner = employee && payslip.employeeId?._id.toString() === employee._id.toString();

            if ( !isOwner ) return res.status(403).json({
                error: "Forbidden"
            });
        }
        const result = {
            ...payslip,
            id: payslip._id.toString(),
            employee: payslip.employeeId,
        }
        return res.json(result)

    } catch (error) {
        return res.status(500).json({
            error: "Failed"
        })
    }
}