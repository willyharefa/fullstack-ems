import User from "../models/User.js";
import Employee from "../models/Employee.js";
import bcrypt from "bcrypt";
import jwt from "jsonwebtoken"

// Login for employee and admin
export const login = async (req, res) => {
    try {
        const { email, password, role_type } = req.body

        if(!email || !password) {
            return res.status(400).json({
                error: "Email and password are required"
            });
        }

        const user = await User.findOne({email})
        if (!user) {
            return res.status(401).json({
                error: "Invalid credentials"
            });
        }

        // Normalisasi: client mengirim "admin"/"employee" (kecil),
        // server membandingkan dengan "ADMIN"/"EMPLOYEE" (besar)
        const requestedRole = typeof role_type === "string" ? role_type.toUpperCase() : role_type;

        if(requestedRole === "EMPLOYEE" && user.role !== "EMPLOYEE") {
            return res.status(401).json({
                error: "Not authorized as employee"
            });
        }

        if(requestedRole === "ADMIN" && user.role !== "ADMIN") {
            return res.status(401).json({
                error: "Not authorized as admin"
            });
        }

        const isValid = await bcrypt.compare(password, user.password)
        if( !isValid ) {
            return res.status(401).json({
                error: "Invalid credentials"
            });
        }

        // Karyawan yang dihapus / dinonaktifkan tidak boleh login.
        if ( user.role === "EMPLOYEE" ) {
            const employee = await Employee.findOne({
                userId: user._id
            }).lean();

            if ( !employee ) {
                return res.status(401).json({
                    error: "Employee account not found"
                });
            }

            if ( employee.isDeleted || employee.employmentStatus === "INACTIVE" ) {
                return res.status(403).json({
                    error: "Your account is deactivated. Please contact your admin."
                });
            }
        }

        const payload = {
            userId: user._id.toString(),
            role: user.role,
            email: user.email,
            tokenVersion: user.tokenVersion ?? 0,
        }

        const token = jwt.sign(
            payload, 
            process.env.JWT_SECRET,
            {
                expiresIn: "7d"
            }
        )

        return res.json({
            user: payload,
            token
        })

    } catch (error) {
        console.error("Login error: ", error);
        return res.status(500).json({
            error: "Login failed"
        });
    }
}

// POST /api/auth/login

// Get session for employee and admin
// GET /api/auth/session
export const session = (req, res) => {
    // req.user diisi ulang dari database oleh middleware protect,
    // jadi role di sini selalu yang terbaru.
    return res.json({
        user: req.user
    })
}

// Change password for employee and admin
// POST /api/auth/change-password
export const changePassword = async (req, res) => {
    try {
        const session = req.user;
        const { currentPassword, newPassword } = req.body;

        if ( !currentPassword || !newPassword ) {
            return res.status(400).json({
                error: "Both passwords are required"
            });
        }

        if (newPassword.length < 6) {
            return res.status(400).json({
                error: "New password must be at least 6 characters"
            });
        }

        const user = await User.findById(session.userId)
        if ( !user ) return res.status(404).json({
            error: "User not found"
        });

        const isValid = await bcrypt.compare(currentPassword, user.password);

        if(!isValid) return res.status(400).json({
            error: "Current password is incorrect"
        });

        const hashed = await bcrypt.hash(newPassword, 10);

        // Naikkan tokenVersion agar semua token lama (termasuk yang dipakai
        // sekarang) langsung tidak berlaku. Client wajib login ulang.
        await User.findByIdAndUpdate(
            session.userId,
            {
                password: hashed,
                $inc: { tokenVersion: 1 }
            }
        )

        return res.json({
            success: true,
            reLoginRequired: true
        });
    } catch (error) {
        console.error("Change password error:", error);
        return res.status(500).json({
            error: "Failed to change password"
        });
    }
}

// Logout for employee and admin
// POST /api/auth/logout
export const logout = async (req, res) => {
    try {
        // Menaikkan tokenVersion mencabut semua token user ini.
        await User.findByIdAndUpdate(
            req.user.userId,
            { $inc: { tokenVersion: 1 } }
        )

        return res.json({
            success: true
        })
    } catch (error) {
        console.error("Logout error:", error);

        // Logout tetap dianggap berhasil dari sisi client.
        return res.json({
            success: true
        })
    }
}
