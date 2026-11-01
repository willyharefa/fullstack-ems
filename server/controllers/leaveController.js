import { sendEventWithRetry } from "../inngest/index.js";
import mongoose from "mongoose";
import Employee from "../models/Employee.js";
import LeaveApplication from "../models/LeaveApplication.js";
import { getTodayDateString } from "../utils/timezone.js";

const ALLOWED_LEAVE_TYPES = [
    "SICK",
    "CASUAL",
    "ANNUAL",
];

const BLOCKING_STATUSES = [ "PENDING", "APPROVED" ];

const isValidDateString = (value) => {
    if (typeof value !== "string") return false;

    if ( !/^\d{4}-\d{2}-\d{2}$/.test(value) ) return false;

    const date = new Date(`${value}T00:00:00.000Z`);

    return (
        !Number.isNaN(date.getTime()) &&
        date.toISOString().slice(0, 10) === value
    );
}

const toCalendarDate = (dateString) => {
    return new Date(`${dateString}T00:00:00.000Z`);
};

const countWorkingDays = (startDay, endDay) => {
    let count = 0;

    const current = toCalendarDate(startDay)
    const end     = toCalendarDate(endDay)
    
    while (current <= end) {
        const day = current.getUTCDay()

        if (day !== 0 && day !== 6) {
            count++
        }

        current.setUTCDate(current.getUTCDate() + 1);
    }
    return count;
} 

// Create leave
// POST /api/leaves
export const createLeave = async (req, res) => {
    try {
        const user = req.user;

        if (!user?.userId) {
            return res.status(401).json({
                error: "Authentication required"
            });
        }

        const employee = await Employee.findOne({
            userId: user.userId
        })

        if ( !employee ) return res.status(404).json({
            error: "Employee not found"
        });

        if ( employee.isDeleted ) {
            return res.status(403).json({
                error: "Your account is deactivated. You cannot apply for leave"
            })
        }

        const { type, startDate, endDate, reason } = req.body;

        if (
            typeof type !== "string" ||
            typeof reason !== "string" ||
            !startDate ||
            !endDate ||
            !reason.trim()
        ) {
            return res.status(400).json({
                error: "Missing fields"
            });
        }

        // Validation type leave
        if ( !ALLOWED_LEAVE_TYPES.includes(type) ) {
            return res.status(400).json({
                error: "Invalid leave type",
                allowedTypes: ALLOWED_LEAVE_TYPES
            });
        }

        // Validate DATE
        if (
            !isValidDateString(startDate) ||
            !isValidDateString(endDate)
        ) {
            return res.status(400).json({
                error: "Dates must be valid and use YYYY-MM-DD format"
            });
        }

        const today = getTodayDateString();

         if (startDate <= today) {
            return res.status(400).json({
                error: "Leave start date must be after today",
            });
        }

        if (endDate < startDate) {
            return res.status(400).json({
                error: "End date cannot be before start date",
            });
        }

        const workingDays = countWorkingDays(startDate, endDate);

        if (workingDays === 0) {
            return res.status(400).json({
                error: "Leave period must include at least one weekday",
            });
        }

        const overlappingLeave = await LeaveApplication.findOne({
            employeeId: employee._id,
            status: { $in: BLOCKING_STATUSES },
            startDate: {
                $lte: toCalendarDate(endDate),
            },
            endDate: {
                $gte: toCalendarDate(startDate),
            },
        });

        if (overlappingLeave) {
            return res.status(409).json({
                error: "You already have a pending or approved leave application for overlapping dates",
            });
        }

        const leave = await LeaveApplication.create({
            employeeId: employee._id,
            type,
            startDate: new Date(startDate),
            endDate: new Date(endDate),
            reason: reason.trim(),
            status: "PENDING"
        })

        // Event Inngest bersifat non-fatal: data sudah tersimpan,
        // jadi kegagalan mengirim event tidak boleh menggagalkan request.
        try {
            await sendEventWithRetry({
                name: "leave/pending",
                data: {
                    leaveApplicationId: leave._id
                }
            })
        } catch (eventError) {
            console.error("Failed to send leave/pending event:", eventError)
        }

        return res.status(201).json({
            success: true,
            message: "Leave application created successfully",
            data: leave,
            workingDays,
        });

    } catch (error) {
        console.error(error)
        return res.status(500).json({
            error: "Failed to create leave application"
        });
    }
}


// Get leaves
// GET /api/leaves
export const getLeaves = async (req, res) => {
    try {
        const user    = req.user;
        const isAdmin = user.role === "ADMIN";

        if ( isAdmin ) {
            const status = req.query.status;
            const where = status ? {status} : {};
            const leaves = await LeaveApplication.find(where).populate("employeeId").sort({ createdAt: -1 });

            const data = leaves.map((l) => {
                const obj = l.toObject();
                return {
                    ...obj,
                    id: obj._id.toString(),
                    employee: obj.employeeId,
                    employeeId: obj.employeeId?._id?.toString()
                }
            })
            return res.json({data})
        } else {
            const employee = await Employee.findOne({
                userId: user.userId,
            }).lean();

            if ( !employee ) return res.status(404).json({
                error: "Not found"
            });

            const leaves = await LeaveApplication.find({
                employeeId: employee._id
            }).sort({ createdAt: -1 });

            return res.json({
                data: leaves,
                employee: {
                    ...employee,
                    id: employee._id.toString()
                }
            })
        }
    } catch (error) {
        return res.status(500).json({
            error: "Failed"
        });
    }
}

const ACTIONABLE_STATUSES = [ "APPROVED", "REJECTED" ];

// PATCH /api/leaves/:id
export const updateLeaveStatus = async (req, res) => {
    try {
        const { id } = req.params;
        const { status } = req.body;

        if ( !mongoose.isValidObjectId(id) ) {
            return res.status(400).json({
                error: "Invalid leave application id"
            });
        }

        if ( !ACTIONABLE_STATUSES.includes(status) ) {
            return res.status(400).json({
                error: "Invalid status",
                allowedStatuses: ACTIONABLE_STATUSES
            });
        }

        // Hanya aplikasi berstatus PENDING yang boleh diubah.
        const leave = await LeaveApplication.findOneAndUpdate(
            {
                _id: id,
                status: "PENDING"
            },
            { status },
            { returnDocument: "after" }
        )

        if( !leave ) {
            const exists = await LeaveApplication.exists({ _id: id });

            if ( !exists ) {
                return res.status(404).json({
                    error: "Leave application not found"
                });
            }

            return res.status(409).json({
                error: "Only pending leave applications can be updated"
            });
        }

        return res.json({
            success: true,
            data: leave
        })
        
    } catch (error) {
        console.error("Update leave status error:", error);

        return res.status(500).json({
            error: "Failed"
        })
    }
}