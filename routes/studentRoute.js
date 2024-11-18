import express from "express";
import {
  loginStudent,
  logoutStudent,
  changePassword,
  detail,
  register,
  acceptRegister,
  notice,
  check,
  evaluation,
  attendance,
  result,
  subjectEvaluation,
  requestUpdate,
  subjectAttendance,
} from "../controllers/studentController.js";

import authStudent from "../middleware/authStudent.js";

const studentRouter = express.Router();

//login
studentRouter.post("/login", loginStudent);

//logout
studentRouter.get("/logout", logoutStudent);

//notice
studentRouter.get("/notice", notice);

//verifing student
studentRouter.use(authStudent);

//check
studentRouter.get("/check", check);

//changepassword
studentRouter.post("/changePassword", changePassword);

//detail
studentRouter.get("/detail", detail);

//register
studentRouter.get("/register", register);

studentRouter.post("/register", acceptRegister);

//result
studentRouter.get("/evaluation", evaluation);

//courseResult
studentRouter.post("/result", result);

//subjectEvaluation
studentRouter.get("/evaluation/subject", subjectEvaluation);

//requestUpdate
studentRouter.post("/requestUpdate", requestUpdate);

//attendance
studentRouter.get("/attendance",attendance);

//subjectAttendance
studentRouter.get("/attendance/subject", subjectAttendance);

export default studentRouter;