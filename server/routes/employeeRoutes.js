import { Router} from 'express';
import { createEmployees, deleteEmployees, getEmployees, updateEmployees } from '../controllers/employeeController.js';
import { protect, protectAdmin } from '../middleware/auth.js';


const employeesRouter = Router();


employeesRouter.get("/", protect, protectAdmin, getEmployees);
employeesRouter.post("/", protect, protectAdmin, createEmployees);
employeesRouter.put("/:id", protect, protectAdmin, updateEmployees);
employeesRouter.delete("/:id", protect, protectAdmin, deleteEmployees);

export default employeesRouter;