import { sendEventWithRetry } from "../inngest/index.js";
import Attendance from "../models/Attendance.js";
import Employee from "../models/Employee.js";
import { getLocalHourMinute, getTodayDayRange } from "../utils/timezone.js";

export const clockInOut = async (req, res) => {
    try {
        const user = req.user;
        const employee = await Employee.findOne({
            userId: user.userId
        })
        if ( !employee ) return res.status(404).json({
            error: "Employee not found"
        });

        if ( employee.isDeleted ) return res.status(403).json({
            error: "Your account is deactivated. You cannot clock in/out."
        });

        // const today = new Date();
        // today.setHours(0, 0, 0, 0);

        const { start, end } = getTodayDayRange();
        
        const existing = await Attendance.findOne({
            employeeId: employee._id,
            date: {
                $gte: start,
                $lt: end,
            },
        })

        const now = new Date();

        if ( !existing ) {
            const { hour, minute } = getLocalHourMinute();
            const isLate = hour > 9 || (hour === 9 && minute > 0)

            const attendance = await Attendance.create({
                employeeId: employee._id,
                date: start,
                checkIn: now,
                status: isLate ? "LATE": "PRESENT"
            })

            try {
                await sendEventWithRetry({
                    name: "employee/check-out",
                    data: {
                        employeeId: employee._id,
                        attendanceId: attendance._id
                    }
                })
            } catch (eventError) {
                console.error("Failed to send employee/check-out event", eventError)
            }

            return res.json({
                success: true,
                type: "CHECK_IN",
                data: attendance
            })
        } else if ( !existing.checkOut ) {
            const checkInTime = new Date(existing.checkIn).getTime()
            const diffMs = now.getTime() - checkInTime;
            const diffHours = diffMs / (1000 * 60 * 60)

            existing.checkOut = now;

            // Compute working hours and day type
            const workingHours = parseFloat(diffHours.toFixed(2))
            let dayType = "Half Day"
            if (workingHours >= 8) dayType = "Full Day";
            else if (workingHours >= 6) dayType = "Three Quarter Day";
            else if (workingHours >= 4) dayType = "Half Day";
            else dayType = "Short Day";

            existing.workingHours = workingHours;
            existing.dayType = dayType;

            await existing.save();
            return res.json({
                success: true,
                type: "CHECK_OUT",
                data: existing
            })
        } else {
            return res.json({
                success: true,
                type: "CHECK_OUT",
                data: existing
            })
        }
    } catch (error) {
        console.error("Attendance Error:", error);
        return res.status(500).json({ error: "Operation failed" });
    }
}

export const getAttendance = async (req, res) => {
    try {
        const user = req.user;
        const employee = await Employee.findOne({
            userId: user.userId
        })

        if ( !employee ) return res.status(404).json({
            error: "Employee not found"
        });

        const limit = parseInt(req.query.limit || 30);
        const history = await Attendance.find({
            employeeId: employee._id
        }).sort({
            date: -1
        }).limit(limit)

        return res.json({
            data: history,
            employee: {
                isDeleted: employee.isDeleted
            }
        })
    } catch (error) {
        return res.status(500).json({
            error: "Failed to fetch attendance"
        });
    }
}