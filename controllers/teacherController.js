import jwt from "jsonwebtoken";
import connection from "../api/dbConnection.js";
import bcrypt from "bcrypt";
import { getTeacher, logout, updateTeacher } from "./teacherUtils.js";
import {getStudent} from "./studentUtils.js";

//status 400, 401 bad request : logout -> show_Message -> redirect Login
//status 200 : send message if known error occurs
//status 200 : send success if want to show a message

//check
const check = (req, res) => {
  res.status(204).send();
};

//to create a token
const createToken = (teacherId) => {
  return jwt.sign({ teacherId }, "5EeOrBTP7khfjGZap428zDP2Fp8xk6QV", {
    expiresIn: "1d",
  });
};

//to handel login
async function loginTeacher(req, res) {
  const { teacherId, password } = req.body;

  try {
    if (!teacherId || !password) {
      res
        .status(200)
        .send({ error: false, message: "All fields must be filled!" });
    } else {
      const teacher = await getTeacher(teacherId);
      if (!teacher) {
        res.status(200).send({ message: "teacher is not registered!" });
      } else {
        if (teacher.blockedDateTime) {
          res.status(200).send({
            error: false,
            message: "You have reached max login limits!",
          });
        } else {
          const match = await bcrypt.compare(password, teacher.password);

          if (match) {
            await updateTeacher(["wrong"], [0], teacherId);
            res.cookie("token", String(createToken(teacherId)), {
              path: "/",
              httpOnly: true,
              secure: true,
              maxAge: 1000 * 60 * 60 * 24,
              sameSite: "strict",
            });
            res.status(204).send();
          } else {
            if (teacher.wrong === 2) {
              const blockedDateTime = new Date().toISOString();
              await updateTeacher(
                ["blockedDateTime", "wrong"],
                [blockedDateTime, 0],
                teacherId
              );
              res.status(200).send({
                message: "You have reached max login limits!",
              });
            } else {
              await updateTeacher(["wrong"], [teacher.wrong + 1], teacherId);
              res.status(200).send({ message: "Wrong Password!" });
            }
          }
        }
      }
    }
  } catch (error) {
    console.log(error);
    res.status(400).send({ message: "Something went wrong try later!" });
  }
}

async function getSubject(req, res) {
  const teacherId = req.teacherId;
  try {
    const teacher = await getTeacher(teacherId);
    const [response] = await connection.execute(
      `select  a.teachesId as 'teachesId', c.subjectId as 'Subject Code', c.name as Subject, b.deptId as 'Dept.', b.degree as Degree , b.sem as Semester, a.section as Section, a.groupId as 'Group' from teaches as a join include as b on a.includeId = b.includeId join subject as c on b.subjectId = c.subjectId where a.teacherId = ?`,
      [teacherId]
    );
    const link = response.map((element)=>(`/teacher/courseDetail/${element.teachesId}`));
    const data = response.map((element)=>{delete element.teachesId; return { ...element, 'See Detail': `See`}});
    res.status(200).send({subjects: data, teacher, link });
  } catch (error) {
    console.log(error);
    res.status(400).send({ message: "Bad request!" });
  }
}

function logoutTeacher(req, res) {
  res = logout(res);
  res.status(204).send();
}

//course Detail
async function courseDetail(req, res){
  const teacherId = req.teacherId;
  const {teachesId} = req.query;
  try{
    let [response] = await connection.execute(`select a.teacherId, b.deptId as 'Dept.', b.degree as Degree, b.sem as Semester, a.section as 'Section', a.groupId as 'Group', b.subjectId as 'Subject Id', c.name as Title from teaches as a join include as b on a.includeId=b.includeId join subject as c on b.subjectId=c.subjectId where teachesId=?`,[teachesId]);
    let detail = response[0];
    if(detail.teacherId && detail.teacherId === teacherId){
      delete detail.teacherId;
      [response] = await connection.execute("select studentId from student where deptId=? and degree=? and sem=? and section=? and groupId=?",[detail["Dept."], detail["Degree"], detail["Semester"], detail["Section"], detail["Group"]]);
      [response] = await connection.execute("select count(classId) as count from class where teachesId=?",[teachesId]);
      const classCount = response[0].count;
      [response] = await connection.execute("select a.studentId as 'Student Id', count(a.classId) as Present from attendance as a join class as b on b.classId = a.classId where b.teachesId=? and a.status=? group by a.studentId",[teachesId,"P"]);
      const attendance = response.map((element)=>({...element, Percent: Math.ceil((element.Present*100)/classCount), "See Detail": "See"}));
      const attendanceLink = response.map((element)=>(`/teacher/attendanceDetail/${teachesId + "_" + element["Student Id"]}`));
      [response] = await connection.execute("select sum(maxMarks) as totalMarks from exam where teachesId=?",[teachesId]);
      const totalMarks = response[0].totalMarks;
      [response] = await connection.execute("select a.studentId as 'Student Id', sum(a.mark) as Marks from mark as a join exam as b on b.examId = a.examId where b.teachesId = ? group by a.studentId",[teachesId]);
      const evaluation = response.map((element)=>({...element, Percent: Math.ceil((element.Marks*100)/totalMarks), "See Detail": "See"}));
      const evaluationLink = response.map((element)=>(`/teacher/evaluationDetail/${teachesId + "_" + element["Student Id"]}`));
      res.status(200).send({classCount, attendance: {attendance, attendanceLink}, evaluation: {evaluation, evaluationLink}, totalMarks, detail});
    }
    else res.send("bye");
  }catch(error){
    console.log(error);
    res.send("error");
  }
}


//evaluation detail of a student
async function evaluationDetail(req, res){
  const teacherId = req.teacherId;
  const {studentId, teachesId} = req.query;
  try{
    let [response] = await connection.execute(`select a.teacherId, b.deptId as 'Dept.', b.degree as Degree, b.sem as Semester, a.section as 'Section', a.groupId as 'Group', b.subjectId as 'Subject Id', c.name as Title from teaches as a join include as b on a.includeId=b.includeId join subject as c on b.subjectId=c.subjectId where teachesId=?`,[teachesId]);
    let detail = response[0];
    if(detail.teacherId && detail.teacherId === teacherId){
      delete detail.teacherId;
      const student = await getStudent(studentId);
      if(student && student.deptId === detail["Dept."] && student.degree === detail.Degree && student.sem === detail.Semester && student.section === detail.Section && student.groupId === detail.Group ){
        detail = {...detail, "Student Id": studentId};
        [response] = await connection.execute("select b.name as Exam, b.maxMarks as maxMarks, b.date as Date, a.mark as Marks from mark as a join exam as b on b.examId = a.examId where b.teachesId = ? and a.studentId = ?", [teachesId, studentId]);
        res.send({response,detail});
      }
      else res.send("Hiii");
    }
    else res.send(bye);
  }catch(error){
    console.log(error);
    res.send("error");
  }
}



//function to change password
async function changePassword(req, res) {
  const teacherId = req.teacherId;
  const { password, newPassword } = req.body;
  if (!password || !newPassword || newPassword.length < 8)
    res
      .status(200)
      .send({error: "All fields must be filled!" });
  else {
    try {
      const teacher = await getTeacher(teacherId);
      if (!teacher) {
        res.status(200).send({ error: "Bad Request" });
      } else {
        const match = await bcrypt.compare(password, teacher.password);
        if (match) {
          const hash = bcrypt.hashSync(newPassword, 10);
          await updateTeacher(["password", "wrong"], [hash, 0], teacherId);
          res.status(200).send({success: "Password changed successFully!"});
        } else {
          if (teacher.wrong === 2) {
            await updateTeacher(
              ["wrong"],
              [0],
              teacherId
            );
            res = logout(res);
            res.status(400).send({
              error: "Maximum try limit reached!",
            });
          } else {
            await updateTeacher(["wrong"], [teacher.wrong + 1], teacherId);
            res.status(200).send({ error: "Wrong Password!" });
          }
        }
      }
    } catch (error) {
      console.log(error);
      res = logout(res);
      res.status(400).send({ error: "Something went wrong" });
    }
  }
}

export { loginTeacher, check, getSubject, logoutTeacher, changePassword, courseDetail, evaluationDetail};
