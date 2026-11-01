import mongoose from "mongoose";

const userSchema = new mongoose.Schema({
    email: {
        type: String,
        required: true,
        unique: true
    },
    password: {
        type: String,
        required: true
    },
    role: {
        type: String,
        enum: ["ADMIN", "EMPLOYEE"],
        default: "EMPLOYEE"
    },
    // Dinaikkan setiap password diganti / logout, agar token lama langsung tidak berlaku.
    tokenVersion: {
        type: Number,
        default: 0
    },
}, {
    timestamps: true
})

const User = mongoose.models.User || mongoose.model("User", userSchema);

export default User;