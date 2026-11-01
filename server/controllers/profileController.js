import Employee from "../models/Employee.js";

export const getProfile = async (req, res) => {
    try {
        const user = req.user;
        const employee = await Employee.findOne({
            userId: user.userId
        })

        if ( !employee ) {
            return res.json({
                firstName: "Admin",
                lastName: "",
                email: user.email,
            })
        }
        return res.json(employee)
    } catch (error) {
        return res.status(500).json({
            error: "Failed to fetch profile"
        })
    }
}

export const updateProfile = async (req, res) => {
    try {
        const user = req.user;
        const employee = await Employee.findOne({
            userId: user.userId
        })

        if ( !employee ) return res.status(404).json({
            error: "Employee not found"
        })

        if ( employee.isDeleted ) {
            return res.status(403).json({
                error: "Your account is deactivated. You cannot update your profile"
            })
        }
        await Employee.findByIdAndUpdate(employee._id, {
            bio: req.body.bio
        })
        return res.json({ success: true })
    } catch (error) {
        return res.status(500).json({
            error: "Failed to update profile"
        });
    }
}