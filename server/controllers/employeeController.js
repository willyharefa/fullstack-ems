import Employee from "../models/Employee.js";
import bcrypt from "bcrypt";
import User from "../models/User.js";

// GET /api/employees
export const getEmployees = async (req, res) => {
    try {
        const { department } = req.query;
        const where = {};
        
        if ( department ) where.department = department;
        // const employees = ( await Employee.find(where)).sort({createdAt: -1}).populate("userId", "email role").lean();
        const employees = await Employee.find(where)
            .sort({ createdAt: -1 })
            .populate("userId", "email role")
            .lean();

        const result = employees.map((emp) => ({
            ...emp,
            id: emp._id.toString(),
            user: emp.userId ? {
                email: emp.userId.email,
                role: emp.userId.role
            } : null
        }))

        return res.json(result)
    } catch (error) {
        console.error("Get employee error:", error);
        return res.status(500).json({
            error: "Failed to fetch employees"
        })
    }
}

// POST /api/employees
export const createEmployees = async (req, res) => {
    try {
        const {firstName, lastName, email, phone, position, department, basicSalary, allowances, deductions, joinDate, password, role, bio} = req.body;
        
        if(!email || !password || !firstName || !lastName) {
            return res.status(400).json({
                error: "Missing required fields"
            });
        }

        if ( typeof password !== "string" || password.length < 6 ) {
            return res.status(400).json({
                error: "Password must be at least 6 characters"
            });
        }

        const joinDateObj = new Date(joinDate);
        if ( Number.isNaN(joinDateObj.getTime()) ) {
            return res.status(400).json({
                error: "Join date must be valid date"
            });
        }

        const hashed = await bcrypt.hash(password, 10)

        // Simpan user supaya bisa dihapus lagi kalau pembuatan Employee gagal.
        let user = null;

        try {
            user = await User.create({
                email,
                password: hashed,
                role: role || "EMPLOYEE"
            })

            const employee = await Employee.create({
                userId: user._id,
                firstName,
                lastName,
                email,
                phone,
                position,
                department: department || "Engineering",
                basicSalary: Number(basicSalary) || 0,
                allowances: Number(allowances) || 0,
                deductions: Number(deductions) || 0,
                joinDate: joinDateObj,
                bio: bio || "",
            })

            return res.status(201).json({
                success: true,
                employee
            })
        } catch (error) {
            // Cegah akun yatim: kalau Employee gagal dibuat, hapus User-nya.
            if ( user?._id ) {
                await User.findByIdAndDelete(user._id).catch((cleanupError) => {
                    console.error("Failed to clean up orphan user:", cleanupError)
                })
            }

            throw error
        }

    } catch (error) {
        if(error.code === 11000) {
            return res.status(400).json({
                error: "Email already exists"
            })
        }

        console.error("Create employee error:", error)

        return res.status(500).json({
            error: "Failed to create employee"
        });
    }
}

// PUT /api/employees/:id
export const updateEmployees = async (req, res) => {
    try {
        const {id} = req.params;

        const {firstName, lastName, email, phone, position, department, basicSalary, allowances, deductions, password, role, bio, employmentStatus} = req.body;

        const employee = await Employee.findById(id);

        if (!employee) return res.status(404).json({
            error: "Employee not found"
        })

        if ( password && ( typeof password !== "string" || password.length < 6 ) ) {
            return res.status(400).json({
                error: "Password must be at least 6 characters"
            })
        }

        await Employee.findByIdAndUpdate(id, {
            firstName,
            lastName,
            email,
            phone,
            position,
            department: department || "Engineering",
            basicSalary: Number(basicSalary) || 0,
            allowances: Number(allowances) || 0,
            deductions: Number(deductions) || 0,
            employmentStatus: employmentStatus || "ACTIVE",
            bio: bio || "",
        })

        const userUpdate = { $set: { email } }

        if(role) userUpdate.$set.role = role;

        if(password) {
            userUpdate.$set.password = await bcrypt.hash(password, 10);

            // Password direset admin -> cabut semua token lama milik karyawan.
            userUpdate.$inc = { tokenVersion: 1 };
        }

        await User.findByIdAndUpdate(employee.userId, userUpdate);

        return res.json({success: true})

    } catch (error) {
        if(error.code === 11000) {
            return res.status(400).json({
                error: "Email already exists"
            })
        }

        console.error("Create employee error:", error)
        return res.status(500).json({ error: "Failed to update employee" });
    }
}

// DELTE /api/employees/:id
export const deleteEmployees = async (req, res) => {
    try {
        const { id } = req.params;
        const employee = await Employee.findById(id)

        if(!employee) return res.status(404).json({
            error: "Employee not found"
        });

        employee.isDeleted = true;
        employee.employmentStatus = "INACTIVE"
        await employee.save()

        // Cabut token yang masih aktif saat akun dinonaktifkan.
        await User.findByIdAndUpdate(employee.userId, {
            $inc: { tokenVersion: 1 }
        })

        return res.json({ success: true })
    } catch (error) {
        console.error("Delete employee error:", error)
        return res.status(500).json({
            error: "Failed to delete employee"
        });
    }
}