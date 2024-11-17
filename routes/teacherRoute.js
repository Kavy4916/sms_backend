import express from "express";
import {
  check,
  loginTeacher,
  logoutTeacher,
  changePassword,
  allCourse,
  courseDetail,
  studentEvaluation,
  studentAttendance,
  getCreateClass,
  postCreateClass,
  getAllClass,
  getUpdateClass,
  postUpdateClass,
  updateAttendance,
  deleteClass,
  getCreateExam,
  postCreateExam,
  getAllExam,
  updateMark,
  getUpdateExam,
  postUpdateExam,
  deleteExam,
} from "../controllers/teacherController.js";
import authTeacher from "../middleware/authTeacher.js";

const teacherRouter = express.Router();

teacherRouter.post("/login", loginTeacher);

teacherRouter.get("/logout", logoutTeacher);

teacherRouter.use(authTeacher);

teacherRouter.get("/check", check);

teacherRouter.post("/changePassword", changePassword);

teacherRouter.get("/course/all", allCourse);

teacherRouter.get("/course/detail", courseDetail);

teacherRouter.get("/student/evaluation", studentEvaluation);

teacherRouter.get("/student/attendance",studentAttendance);

teacherRouter.get("/class/create",getCreateClass);

teacherRouter.post("/class/create",postCreateClass);

teacherRouter.get("/class/all", getAllClass);

teacherRouter.get("/class/update", getUpdateClass);

teacherRouter.post("/class/attendance/update", updateAttendance);

teacherRouter.post("/class/update",postUpdateClass);

teacherRouter.post("/class/delete",deleteClass);

teacherRouter.get("/exam/create",getCreateExam);

teacherRouter.post("/exam/create",postCreateExam);

teacherRouter.get("/exam/all",getAllExam);

teacherRouter.get("/exam/update",getUpdateExam);

teacherRouter.post("/exam/update",postUpdateExam);

teacherRouter.post("/exam/mark/update", updateMark);

teacherRouter.post("/exam/delete",deleteExam);

export default teacherRouter;
