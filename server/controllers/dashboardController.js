import { DEPARTMENTS } from "../constants/departments.js";
import Attendance from "../models/Attendance.js";
import Employee from "../models/Employee.js";
import LeaveApplication from "../models/LeaveApplication.js";
import Payslip from "../models/Payslip.js";
import { getMonthRange, getTodayDayRange } from "../utils/timezone.js";

export const getDashboard = async (req, res) => {
    try {
        const user = req.user;

        if ( user.role === "ADMIN" ) {
            const todayRange = getTodayDayRange();
            const [ totalEmployees, todayAttendance, pendingLeaves ] = await Promise.all([
                Employee.countDocuments({
                    isDeleted: {
                        $ne: true
                    }
                }),
                Attendance.countDocuments({
                    date: {
                        $gte: todayRange.start,
                        $lt: todayRange.end
                    }
                }),
                LeaveApplication.countDocuments({
                    status: "PENDING"
                })
            ])
            return res.json({
                role: "ADMIN",
                totalEmployees,
                totalDepartments: DEPARTMENTS.length,
                todayAttendance,
                pendingLeaves
            })
        } else {
            const employee = await Employee.findOne({
                userId: user.userId
            }).lean();

            if ( !employee ) return res.status(404).json({
                error: "Employee not found"
            });

            const monthRange = getMonthRange();
            const [currentMonthAttendance, pendingLeaves, latestPayslip] = await Promise.all([
                Attendance.countDocuments({
                    employeeId: employee._id,
                    date: {
                        $gte: monthRange.start,
                        $lt: monthRange.end
                    }
                }),

                LeaveApplication.countDocuments({
                    employeeId: employee._id,
                    status: "PENDING",
                }),

                Payslip.findOne({
                    employeeId: employee._id
                }).sort({ createdAt: -1 }).lean(),
            ])
            return res.json({
                role: "EMPLOYEE",
                employee: {
                    ...employee,
                    id: employee._id.toString()
                },
                currentMonthAttendance,
                pendingLeaves,
                latestPayslip: latestPayslip ? {
                    ...latestPayslip,
                    id: latestPayslip._id.toString()
                } : null
            })
        }
    } catch (error) {
        console.error("Dashboard error:", error);
        return res.status(500).json({
            error: "Failed"
        });
    }
}