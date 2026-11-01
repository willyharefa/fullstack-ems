import { Inngest } from "inngest";
import Attendance from "../models/Attendance.js";
import Employee from "../models/Employee.js";
import LeaveApplication from "../models/LeaveApplication.js";
import sendEmail from "../config/nodemailer.js";
import { getTodayDayRange, TIME_ZONE } from "../utils/timezone.js";

// Create a client to send and receive events
export const inngest = new Inngest({ id: "fullstack-ems" });

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

// Helper untuk mengirim event dengan retry singkat.
// Dipakai controller supaya kegagalan sementara tidak langsung "menelan" event.
export const sendEventWithRetry = async (
    event,
    { attempts = 3, baseDelayMs = 500 } = {}
) => {
    let lastError;

    for (let attempt = 1; attempt <= attempts; attempt++) {
        try {
            return await inngest.send(event);
        } catch (error) {
            lastError = error;

            if (attempt < attempts) {
                await sleep(baseDelayMs * attempt);
            }
        }
    }

    throw lastError;
};

// Auto Check-Out: ingatkan setelah 9 jam sejak CHECK-IN,
// lalu paksa check-out pada jam ke-10.
// Status check-in (PRESENT/LATE) dipertahankan; yang dicatat adalah waktu nyata.
const AUTO_CHECKOUT_HOURS = 10;
const autoCheckOut = inngest.createFunction(
    {
        id: "auto-check-out",
        triggers: [ { event: "employee/check-out" } ]
    },

    async ({ event, step }) => {
        const { employeeId, attendanceId } = event.data;

        // Operasi DB dibungkus step.run agar aman saat retry
        const attendance = await step.run("get-attendance", async () => {
            const found = await Attendance.findById(attendanceId).lean();
            if( !found ) return null;
            return {
                checkIn: found.checkIn ? found.checkIn.toISOString() : null,
                checkOut: found.checkOut ? found.checkOut.toISOString() : null,
            };
        })

        if ( !attendance?.checkIn || attendance.checkOut ) {
            return { skipped: "Already checked out or not found" }
        }

        await step.sleepUntil(
            "wait-9-hours-after-check-in",
            new Date( new Date(attendance.checkIn).getTime() + 9 * 60 * 60 * 1000 )
        );

        const stillOpen = await step.run("recheck-after-9-hours", async () => {
            const found = await Attendance.findById(attendanceId).lean();
            return Boolean(found && !found.checkOut);
        });

        if ( !stillOpen ) return { skipped: "employee already checked out" }

        const employee = await step.run("get-employee", async () => {
            const emp = await Employee.findById(employeeId).lean();
            if ( !emp ) return null;
            return {
                firstName: emp.firstName,
                email: emp.email,
                department: emp.department
            };
        });

        if( employee ) {
            const checkInTime = new Date(attendance.checkIn).toLocaleTimeString("id-ID", {
                timeZone: TIME_ZONE
            });

            await step.run("send-checkout-reminder", async () => {
                await sendEmail({
                    to: employee.email,
                    subject: "Attendance Check-Out Reminder",
                    body:
                        `
                            <div style="max-width:600px;">
                                <h2> Hi ${employee.firstName}!</h2>
                                <p style="font-size: 16px;">
                                    You have a check-in of ${employee.department} today:
                                </p>
                                <p style="font-size: 18px; font-weight: bold; color: #007bff; margin: 8px 0;">
                                    ${checkInTime} WIB
                                </p>
                                <p style="font-size: 16px;">
                                    Please make sure to check-out in one hour.
                                </p>
                                <p style="font-size: 16px;">
                                    If you have any questions, please contact your admin.
                                </p>
                                <br />
                                <p style="font-size: 16px;">Best Regards,</p>
                                <p style="font-size: 16px;">Willy Harefa</p>
                            </div>
                        `
                });
            });
        }

        await step.sleepUntil(
            "wait-1-more-hour",
            new Date(new Date(attendance.checkIn).getTime() + 10 * 60 * 60 * 1000)
        );

        await step.run(
            "force-checkout", 
            async () => {
                const latest = await Attendance.findById(attendanceId);
                if( latest && !latest.checkOut ) {
                    latest.checkOut = new Date(
                        new Date(latest.checkIn).getTime() +
                        AUTO_CHECKOUT_HOURS * 60 * 60 * 1000
                    );

                    latest.workingHours = AUTO_CHECKOUT_HOURS;
                    latest.dayType = "Full Day";

                    // status sengaja tidak diubah: tetap mengikuti status check-in.

                    await latest.save();
                }
            }
        );

        return { done: true };
    }
);

// Send Email to admin, if admin doesn't take action on leave application within 24 hours
const leaveApplicationReminder = inngest.createFunction(
    {
        id: "leave-application-reminder",
        triggers: [
            { event: "leave/pending" }
        ]
    },
    async ({ event, step }) => {
        const { leaveApplicationId } = event.data;

        // wait for 24 hours
        await step.sleepUntil(
            "wait-for-the-24-hours",
            new Date(Date.now() + 24 * 60 * 60 * 1000)
        );

        // Check status & get data in step.run
        const pending = await step.run(
            "check-leave-status",
            async () => {
                const leave = await LeaveApplication.findById(leaveApplicationId).lean();
                if( !leave || leave.status !== "PENDING" ) return null;
                return {
                    employeeId: leave.employeeId.toString(),
                    startDate: leave.startDate.toISOString()
                };
            }
        );

        if( !pending ) return { skipped: "Already processed" };

        const employee = await step.run(
            "get-employee",
            async () => {
                const emp = await Employee.findById(pending.employeeId).lean();
                if( !emp ) return null;
                return {
                    firstName: emp.firstName,
                    lastName: emp.lastName,
                    department: emp.department
                };
            }
        );

        if( !employee ) return { skipped: "employee not found" };

        // Tanggal cuti disimpan sebagai tanggal kalender UTC -> tampilkan apa adanya
        const startDate = new Date(pending.startDate).toLocaleDateString("id-ID", {
            timeZone: "UTC",
            dateStyle: "full",
        });

        await step.run(
            "send-admin-reminder",
            async () => {
                await sendEmail({
                    to: process.env.ADMIN_EMAIL,
                    subject: "Leave Application Reminder",
                    body:
                        `
                            <div style="max-width:600px;">
                                <h2> Hi Admin!</h2>
                                <p style="font-size: 16px;">
                                    ${employee.firstName} ${employee.lastName} (${employee.department})
                                    has a PENDING leave application starting on:
                                </p>
                                <p style="font-size: 18px; font-weight: bold; color: #007bff; margin: 8px 0;">
                                    ${startDate}
                                </p>
                                <p style="font-size: 16px;">
                                    Please make sure to take action on this leave application.
                                </p>
                                <p style="font-size: 16px;">
                                    If you have any questions, please contact your admin.
                                </p>
                                <br />
                                <p style="font-size: 16px;">Best Regards,</p>
                                <p style="font-size: 16px;">Willy Harefa</p>
                            </div>
                        `
                });
            }
        );

        return { sent: true };

        /* OLD Code
        const leaveApplication = await LeaveApplication.findById(leaveApplicationId)

        if (leaveApplication?.status === "PENDING") {
            const employee = await Employee.findById(leaveApplication.employeeId)

            // Send reminder email to admin to take action on leave application
            await sendEmail({
                to: process.env.ADMIN_EMAIL,
                subject: "Leave Application Reminder",
                body:
                    `
                        <div style="max-width:600px;">
                            <h2> Hi Admin!</h2>
                            <p style="font-size: 16px;">
                               You have a leave application in ${employee.department} today:
                            </p>
                            <p style="font-size: 18px; font-weight: bold; color: #007bff; margin: 8px 0;">
                                ${leaveApplication?.startDate?.toLocaleDateString()}
                            </p>
                            <p style="font-size: 16px;">
                                Please make sure to take action on this leave application.
                            </p>
                            <p style="font-size: 16px;">
                                If you have any questions, please contact your admin.
                            </p>
                            <br />
                            <p style="font-size: 16px;">Best Regards,</p>
                            <p style="font-size: 16px;">Willy Harefa</p>
                        </div>
                    `
            })
        } */
    }
);

// CRON: cek absensi tiap hari pukul 11:30 sesuai TIME_ZONE.
// Inngest hanya mendukung 5 field cron (menit jam tanggal bulan hari).
const attendanceReminderCron = inngest.createFunction(
    {
        id: "attendance-reminder-cron",
        triggers: [{ cron: `TZ=${TIME_ZONE} 30 11 * * *` }]
    },
    async ({ step }) => {

        // STEP 1: Get today's date range (WIB) - reuse util timezone
        const today = await step.run(
            "get-today-date",
            () => {
                const { start, end } = getTodayDayRange();
                return {
                    startUTC: start.toISOString(),
                    endUTC: end.toISOString()
                };
            }
        )

        // STEP 2: Get all active, non-deleted employees
        const activeEmployees = await step.run(
            "get-active-employees",
            async () => {
                const employees = await Employee.find({
                    isDeleted: false,
                    employmentStatus: "ACTIVE"
                }).lean();
                
                return employees.map((e) => ({
                    _id: e._id.toString(),
                    firstName: e.firstName,
                    lastName: e.lastName,
                    email: e.email,
                    department: e.department
                }))
            }
        )

        // STEP 3: Get employee IDs on approved leave today
        const onLeaveIds = await step.run(
            "get-on-leave-ids",
            async () => {
                const leaves = await LeaveApplication.find({
                    status: "APPROVED",
                    startDate: {
                        $lt: new Date(today.endUTC)
                    },
                    endDate: {
                        $gte: new Date(today.startUTC)
                    },
                }).lean();

                return leaves.map((leave) => leave.employeeId.toString());
            }
        )

        // STEP 4: Get employee IDs that already checked in today
        const checkedInIds = await step.run(
            "get-checked-in-ids",
            async () => {
                const attendances = await Attendance.find({
                    date: {
                        $gte: new Date(today.startUTC),
                        $lt: new Date(today.endUTC)
                    },
                }).lean();

                return attendances.map((a) => a.employeeId.toString())
            }
        )

        // STEP 5: Filter absent employees (not on leave & not checked in)
        const absentEmployees = activeEmployees.filter(
            (emp) => !onLeaveIds.includes(emp._id) && !checkedInIds.includes(emp._id)
        )

        // STEP 6: Fan-out — kirim satu event per karyawan.
        // Fungsi terpisah yang mengirim email, sehingga kalau satu email gagal
        // hanya karyawan itu yang di-retry, bukan semua email.
        if( absentEmployees.length > 0 ) {
            await step.sendEvent(
                "send-attendance-reminder-events",
                absentEmployees.map((emp) => ({
                    name: "attendance/reminder",
                    data: {
                        employeeId: emp._id
                    }
                }))
            );
        }

        return {
            totalActive: activeEmployees.length,
            onLeave: onLeaveIds,
            checkedIn: checkedInIds.length,
            absent: absentEmployees.length
        }
    }
);

// Kirim email reminder untuk satu karyawan.
// Dipisah dari cron supaya retry tidak mengirim ulang email ke semua orang.
const attendanceReminderEmail = inngest.createFunction(
    {
        id: "attendance-reminder-email",
        retries: 3,
        triggers: [{ event: "attendance/reminder" }]
    },
    async ({ event, step }) => {
        const { employeeId } = event.data;

        const employee = await step.run(
            "get-employee",
            async () => {
                const emp = await Employee.findById(employeeId).lean();
                if( !emp ) return null;

                return {
                    firstName: emp.firstName,
                    email: emp.email,
                    department: emp.department
                };
            }
        );

        if( !employee ) return { skipped: "employee not found" };

        await step.run(
            "send-reminder-email",
            async () => {
                await sendEmail({
                    to: employee.email,
                    subject: "Attendance Reminder - Please Mark Your Attendance",
                    body: `
                        <div style="max-width: 600px; font-family: Arial, sans-serif;">
                            <h2>Hi ${employee.firstName},</h2>
                            <p>We noticed you haven't marked your attendance yet today.</p>
                            <p>The deadline was <strong>11:30 AM WIB</strong>.</p>
                            <p>Please check in as soon as possible or contact your admin.</p>
                            <p>Department: ${employee.department}</p>
                            <p>Best Regards,<br/>QuickEMS</p>
                        </div>
                    `
                });
            }
        );

        return { sent: true };
    }
);

// Create an empty array where we'll export future Inngest functions
export const functions = [
    autoCheckOut,
    leaveApplicationReminder,
    attendanceReminderCron,
    attendanceReminderEmail
];