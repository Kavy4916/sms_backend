import express from "express";
import { loginTeacher, check, getSubject, logoutTeacher, changePassword, courseDetail, evaluationDetail } from "../controllers/teacherController.js";
import authTeacher from "../middleware/authTeacher.js";


const teacherRouter = express.Router();

teacherRouter.post("/login",loginTeacher);

teacherRouter.get("/logout",logoutTeacher);

teacherRouter.use(authTeacher);

teacherRouter.get("/check", check);

teacherRouter.get("/getSubject", getSubject);

teacherRouter.post("/changePassword", changePassword);

teacherRouter.get("/courseDetail",courseDetail);

teacherRouter.get("/evaluationDetail", evaluationDetail);

export default teacherRouter;