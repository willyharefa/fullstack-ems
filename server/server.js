import express from "express"
import cors from "cors"
import helmet from "helmet"
import "dotenv/config"
import multer from "multer"
import { connectToMongoDB } from "./config/db.js"
import authRouter from "./routes/authRoutes.js"
import employeesRouter from "./routes/employeeRoutes.js"
import profileRouter from "./routes/profileRoutes.js"
import attendanceRouter from "./routes/attendanceRoutes.js"
import leaveRouter from "./routes/leaveRoutes.js"
import payslipRouter from "./routes/payslipsRoutes.js"
import dashboardRouter from "./routes/dashboardRoutes.js"

import { serve } from "inngest/express";
import { inngest, functions } from "./inngest/index.js"

const app = express()
const PORT = process.env.PORT || 4000

// Di balik proxy Vercel, rate limiter butuh IP asli dari X-Forwarded-For.
app.set("trust proxy", 1)

// Middleware keamanan dasar (header CSP, HSTS, dll).
app.use(helmet())

// Batasi origin yang boleh memanggil API.
// CLIENT_URL bisa berisi beberapa origin dipisah koma.
const allowedOrigins = (process.env.CLIENT_URL || "")
    .split(",")
    .map((origin) => origin.trim())
    .filter(Boolean)

app.use(cors({
    origin: allowedOrigins.length > 0 ? allowedOrigins : true,
}))

// Inngest mengirim payload step hingga beberapa MB, bukan 100 KB default.
app.use(express.json({ limit: "4mb" }))
app.use(multer().none())

// Routes
app.get("/", (req, res) => res.send("Server is running"))
app.use("/api/auth", authRouter)
app.use("/api/employees", employeesRouter)
app.use("/api/profile", profileRouter)
app.use("/api/attendance", attendanceRouter)
app.use("/api/leave", leaveRouter)
app.use("/api/payslips", payslipRouter)
app.use("/api/dashboard", dashboardRouter)

app.use("/api/inngest", serve({ 
    client: inngest,
    functions
}));

// 404 untuk route yang tidak dikenal
app.use((req, res) => {
    res.status(404).json({
        error: "Not found"
    })
})

// Global error handler: jangan bocorkan stack trace ke client.
app.use((err, req, res, next) => {
    console.error("Unhandled error:", err)

    if (res.headersSent) return next(err)

    return res.status(500).json({
        error: "Internal server error"
    })
})

await connectToMongoDB()
if (!process.env.VERCEL) {
  app.listen(PORT, () => console.log(`Server running on port ${PORT}`))
}

export default app
