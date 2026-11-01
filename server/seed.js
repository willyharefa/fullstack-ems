import "dotenv/config";
import { connectToMongoDB } from "./config/db.js";
import User from "./models/User.js";
import bcrypt from "bcrypt";

const TemporaryPassword = "admin123";


async function registerAdmin() {
    try {
        const ADMIN_EMAIL = process.env.ADMIN_EMAIL;

        if ( !ADMIN_EMAIL ) {
            console.error("Missing ADMIN_EMAIL env variable")
            process.exit(1)
        }

        await connectToMongoDB()

        const existingAdmin = await User.findOne({
            email: process.env.ADMIN_EMAIL
        });

        if ( existingAdmin ) {
            console.log("User already exists as role", existingAdmin.role);
            process.exit(0)
        }

        const hashedPassword = await bcrypt.hash(TemporaryPassword, 10)

        const admin = await User.create({
            email: process.env.ADMIN_EMAIL,
            password: hashedPassword,
            role: "ADMIN"
        })

        console.log("Admin user created")
        console.log("\nEmail:", admin.email)
        console.log("Password:", TemporaryPassword)
        console.log("\nChange the password after login.")

        process.exit(0)

    } catch (error) {
        console.log("Seed failed:", error);
    }
}


registerAdmin();