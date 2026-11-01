import jwt from "jsonwebtoken";
import User from "../models/User.js";
import Employee from "../models/Employee.js";

export const protect = async (req, res, next) => {
    const authHeader = req.headers.authorization;

    if ( !authHeader || !authHeader.startsWith("Bearer ") ) {
        return res.status(401).json({
            error: "Unauthorized token required"
        });
    }

    const token = authHeader.split(" ")[1];

    let decoded;

    try {
        decoded = jwt.verify(
            token,
            process.env.JWT_SECRET
        );
    } catch (error) {
        return res.status(401).json({
            error: "Invalid or expired token"
        });
    }

    try {
        // Ambil user dari DB supaya role dan status akun selalu terbaru,
        // bukan dari isi token yang bisa basi sampai 7 hari.
        const user = await User.findById(decoded.userId).lean();

        if ( !user ) {
            return res.status(401).json({
                error: "User no longer exists"
            });
        }

        const tokenVersion = decoded.tokenVersion ?? 0;

        if ( (user.tokenVersion ?? 0) !== tokenVersion ) {
            return res.status(401).json({
                error: "Session expired. Please log in again."
            });
        }

        // Karyawan yang di-soft-delete atau dinonaktifkan tidak boleh memakai API.
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
                return res.status(401).json({
                    error: "Your account is deactivated. Please contact your admin."
                });
            }
        }

        req.user = {
            userId: user._id.toString(),
            role: user.role,
            email: user.email,
            tokenVersion: user.tokenVersion ?? 0,
        };

        return next();
    } catch (error) {
        console.error("Auth middleware error:", error);

        return res.status(401).json({
            error: "Invalid or expired token"
        });
    }
}

export const protectAdmin = (req, res, next) => {
    if ( req?.user?.role !== "ADMIN" ) {
        return res.status(403).json({
            error: "Admin access required"
        });
    }
    return next();
}
