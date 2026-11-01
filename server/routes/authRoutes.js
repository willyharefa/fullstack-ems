import { Router} from 'express';
import rateLimit from 'express-rate-limit';
import { changePassword, login, logout, session } from '../controllers/authController.js';
import { protect } from '../middleware/auth.js';

const authRouter = Router();

// Batasi percobaan login yang gagal untuk mencegah brute force.
// Catatan: di serverless, store in-memory berlaku per instance function.
const loginLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    limit: 10,
    standardHeaders: "draft-8",
    legacyHeaders: false,
    skipSuccessfulRequests: true,
    message: {
        error: "Too many login attempts. Please try again later."
    }
});

authRouter.post("/login", loginLimiter, login);
authRouter.get("/session", protect, session);
authRouter.post("/change-password", protect, changePassword);
authRouter.post("/logout", protect, logout);


export default authRouter;
