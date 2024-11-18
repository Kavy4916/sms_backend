import connection from "../api/dbConnection.js";
import bcrypt from "bcrypt";
import {
  getTeacher,
  logout,
  updateTeacher,
  markAttendance,
  addMarks,
  createToken
} from "./teacherUtils.js";
import { getStudent } from "./studentUtils.js";

//status 400, 401 bad request : logout -> show_Message -> redirect Login
//status 200 : send message if known error occurs
//status 200 : send success if want to show a message

//check
const check = (req, res) => {
  res.status(204).send();
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
        if (teacher.blocked) {
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
              sameSite: "none",
            });
            res.status(204).send();
          } else {
            if (teacher.wrong === 2) {
              await updateTeacher(
                ["blocked", "wrong"],
                [1, 0],
                teacherId
              );
              const query = `CREATE EVENT unblock_teacher_${teacher.teacherId} ON SCHEDULE AT CURRENT_TIMESTAMP + INTERVAL 1 DAY DO UPDATE teacher SET blocked = 0 WHERE teacherId = ${teacherId}`
              await connection.query(query);
              res.status(200).send({
                message: "You have reached max login limits, try after 24hours!",
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

//logout a teacher
function logoutTeacher(req, res) {
  res = logout(res);
  res.status(204).send();
}

//function to change password
async function changePassword(req, res) {
  const teacherId = req.teacherId;
  const { password, newPassword } = req.body;
  if (!password || !newPassword || newPassword.length < 8)
    res.status(200).send({ error: "All fields must be filled!" });
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
          res.status(200).send({ success: "Password changed successfully!" });
        } else {
          if (teacher.wrong === 2) {
            await updateTeacher(["wrong"], [0], teacherId);
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

//get all courses of a teacher
async function allCourse(req, res) {
  const teacherId = req.teacherId;
  try {
    const teacher = await getTeacher(teacherId);
    delete teacher.password;
    const [response] = await connection.execute(
      `select  a.teachesId as 'teachesId', c.subjectId as 'Subject Code', c.name as Subject, b.deptId as 'Dept.', b.degree as Degree , b.sem as Semester, a.section as Section, a.groupId as 'Group' from teaches as a join include as b on a.includeId = b.includeId join subject as c on b.subjectId = c.subjectId where a.teacherId = ?`,
      [teacherId]
    );
    const link = response.map(
      (element) => `/teacher/courseDetail/${element.teachesId}`
    );
    const data = response.map((element) => {
      delete element.teachesId;
      return { ...element, "See Detail": `See` };
    });
    res.status(200).send({ subjects: data, teacher, link });
  } catch (error) {
    console.log(error);
    res.status(400).send({ message: "Bad request!" });
  }
}

//get course Detail
async function courseDetail(req, res) {
  const teacherId = req.teacherId;
  const { teachesId } = req.query;
  try {
    let [response] = await connection.execute(
      `select a.teacherId, b.deptId as 'Dept.', b.degree as Degree, b.sem as Semester, a.section as 'Section', a.groupId as 'Group', b.subjectId as 'Subject Id', c.name as Title from teaches as a join include as b on a.includeId=b.includeId join subject as c on b.subjectId=c.subjectId where teachesId=?`,
      [teachesId]
    );
    let detail = response[0];
    if (detail.teacherId && detail.teacherId === teacherId) {
      delete detail.teacherId;
      [response] = await connection.execute(
        "select studentId from student where deptId=? and degree=? and sem=? and section=? and groupId=?",
        [
          detail["Dept."],
          detail["Degree"],
          detail["Semester"],
          detail["Section"],
          detail["Group"],
        ]
      );
      [response] = await connection.execute(
        "select count(classId) as count from class where teachesId=?",
        [teachesId]
      );
      const classCount = response[0].count || 0;
      [response] = await connection.execute(
        "select a.studentId as 'Student Id', COUNT(CASE WHEN a.status = 'P' THEN 1 END)  as Present from attendance as a join class as b on b.classId = a.classId where b.teachesId=? group by a.studentId",
        [teachesId]
      );
      const attendance = response.map((element) => ({
        ...element,
        Percent: Math.ceil((element.Present * 100) / classCount),
        "See Detail": "See",
      }));
      const attendanceLink = response.map(
        (element) =>
          `/teacher/student/attendance/${teachesId + "/" + element["Student Id"]}`
      );
      [response] = await connection.execute(
        "select sum(maxMarks) as totalMarks from exam where teachesId=?",
        [teachesId]
      );
      const totalMarks = response[0].totalMarks || 0;
      [response] = await connection.execute(
        "select a.studentId as 'Student Id', sum(a.mark) as Marks from mark as a join exam as b on b.examId = a.examId where b.teachesId = ? group by a.studentId",
        [teachesId]
      );
      const evaluation = response.map((element) => ({
        ...element,
        Percent: Math.ceil((element.Marks * 100) / totalMarks),
        "See Detail": "See",
      }));
      const evaluationLink = response.map(
        (element) =>
          `/teacher/student/evaluation/${teachesId + "_" + element["Student Id"]}`
      );
      res.status(200).send({
        classCount,
        attendance: { attendance, attendanceLink },
        evaluation: { evaluation, evaluationLink },
        totalMarks,
        detail,
      });
    } else res.send("bye");
  } catch (error) {
    console.log(error);
    res.send("error");
  }
}

//get evaluation detail of a student
async function studentEvaluation(req, res) {
  const teacherId = req.teacherId;
  const { studentId, teachesId } = req.query;
  try {
    let [response] = await connection.execute(
      `select a.teacherId, b.deptId as 'Dept.', b.degree as Degree, b.sem as Semester, a.section as 'Section', a.groupId as 'Group', b.subjectId as 'Subject Id', c.name as Title from teaches as a join include as b on a.includeId=b.includeId join subject as c on b.subjectId=c.subjectId where teachesId=?`,
      [teachesId]
    );
    let detail = response[0];
    if (detail.teacherId && detail.teacherId === teacherId) {
      delete detail.teacherId;
      const student = await getStudent(studentId);
      if (
        student &&
        student.deptId === detail["Dept."] &&
        student.degree === detail.Degree &&
        student.sem === detail.Semester &&
        student.section === detail.Section &&
        student.groupId === detail.Group
      ) {
        detail = { ...detail, "Student Id": studentId };
        [response] = await connection.execute(
          "select b.name as Exam,  b.date as Date, b.maxMarks as 'Max Marks', a.mark as Marks from mark as a join exam as b on b.examId = a.examId where b.teachesId = ? and a.studentId = ?",
          [teachesId, studentId]
        );
        res.send({ response, detail });
      } else res.send("Hiii");
    } else res.send(bye);
  } catch (error) {
    console.log(error);
    res.send("error");
  }
}

//get attendance detail of a student
async function studentAttendance(req, res) {
  const teacherId = req.teacherId;
  const { studentId, teachesId } = req.query;
  try {
    let [response] = await connection.execute(
      `select a.teacherId, b.deptId as 'Dept.', b.degree as Degree, b.sem as Semester, a.section as 'Section', a.groupId as 'Group', b.subjectId as 'Subject Id', c.name as Title from teaches as a join include as b on a.includeId=b.includeId join subject as c on b.subjectId=c.subjectId where teachesId=?`,
      [teachesId]
    );
    let detail = response[0];
    if (detail.teacherId && detail.teacherId === teacherId) {
      delete detail.teacherId;
      const student = await getStudent(studentId);
      if (
        student &&
        student.deptId === detail["Dept."] &&
        student.degree === detail.Degree &&
        student.sem === detail.Semester &&
        student.section === detail.Section &&
        student.groupId === detail.Group
      ) {
        detail = { ...detail, "Student Id": studentId };
        [response] = await connection.execute(
          "select b.date as Date,  b.time as Time, b.purpose as 'Topic', a.status as Status from attendance as a join class as b on b.classId = a.classId where b.teachesId = ? and a.studentId = ?",
          [teachesId, studentId]
        );
        res.send({ attendance: response, detail });
      } else res.send("Hiii");
    } else res.send(bye);
  } catch (error) {
    console.log(error);
    res.send("error");
  }
}


//create a class
const getCreateClass = async (req, res) => {
  const teacherId = req.teacherId;
  const { teachesId } = req.query;
  try {
    let [response] = await connection.execute(
      `select a.teacherId as teacherId, b.type as subjectType, b.deptId as 'Dept.', b.degree as Degree, b.sem as Semester, a.section as Section, a.groupId as 'Group', c.subjectId as 'Subject Id', c.name as Title from teaches as a join include as b on b.includeId=a.includeId join subject as c on c.subjectId = b.subjectId where a.teachesId=?`,
      [teachesId]
    );
    let detail = response[0];
    if (detail && detail.teacherId === teacherId) {
      const subjectType = detail.subjectType;
      delete detail.teacherId;
      delete detail.subjectType;
      let [response] = await connection.execute(
        `select studentId as 'Student Id' from student where deptId=? and degree=? and sem=? and section=? and groupId=?`,
        [
          detail["Dept."],
          detail["Degree"],
          detail["Semester"],
          detail["Section"],
          detail["Group"],
        ]
      );
      const attendance = response.map((element) => ({
        ...element,
        Status: "P",
      }));
      res.status(200).send({ subjectType, attendance, detail });
    } else res.send("hiii");
  } catch (error) {
    console.log(error);
    res.status(200).send(error);
  }
};

const postCreateClass = async (req, res) => {
  const teacherId = req.teacherId;
  const { teachesId, attendance, time, date, purpose, type } = req.body;
  try {
    let [response] = await connection.execute(
      `select teacherId from teaches where teachesId=?`,
      [teachesId]
    );
    let detail = response[0];
    if (detail && detail.teacherId === teacherId) {
      let [response] = await connection.execute(
        `insert into class(date, time, type, teachesId, purpose) value(?,?,?,?,?)`,
        [date, time, type, teachesId, purpose]
      );
      await markAttendance(response.insertId, attendance);
      res.status(200).send("created");
    } else res.send("hiii");
  } catch (error) {
    console.log(error);
    res.status(200).send("error");
  }
};

// get all classes
async function getAllClass(req, res) {
  const teacherId = req.teacherId;
  const { teachesId } = req.query;
  try {
    let [response] = await connection.execute(
      `select a.teacherId, b.deptId as 'Dept.', b.degree as Degree, b.sem as Semester, a.section as 'Section', a.groupId as 'Group', b.subjectId as 'Subject Id', c.name as Title from teaches as a join include as b on a.includeId=b.includeId join subject as c on b.subjectId=c.subjectId where teachesId=?`,
      [teachesId]
    );
    const detail = response[0];
    if (detail.teacherId === teacherId) {
      delete detail.teacherId;
      [response] = await connection.execute(
        `select classId, date as Date, time as Time, purpose as Topic, type as Type from class where teachesId = ? order by Date desc`,
        [teachesId]
      );
      const link = response.map(
        (element) =>
          `/teacher/class/update/${teachesId + "_" + element.classId}`
      );
      const classes = response.map((element) => {
        delete element.classId;
        return { ...element, "Update": "Update" };
      });
      res.status(200).send({ classes, link, detail });
    }
  } catch (error) {
    console.log(error);
  }
};

//get attendance and details of a class to update
const getUpdateClass = async (req, res) => {
  const teacherId = req.teacherId;
  const { teachesId, classId } = req.query;
  try {
    let [response] = await connection.execute(
      `select a.teacherId, b.type as subjectType, b.deptId as 'Dept.', b.degree as Degree, b.sem as Semester, a.section as 'Section', a.groupId as 'Group', b.subjectId as 'Subject Id', c.name as Title from teaches as a join include as b on a.includeId=b.includeId join subject as c on b.subjectId=c.subjectId where a.teachesId=?`,
      [teachesId]
    );
    let detail = response[0];
    if (detail.teacherId === teacherId) {
      const subjectType = detail.subjectType;
      delete detail.subjectType;
      delete detail.teacherId;
      [response] = await connection.execute(
        `select date as Date, time as Time, purpose as Topic, type as Type from class where classId = ?`,
        [classId]
      );
      detail = { ...detail, ...response[0] };
      [response] = await connection.execute(
        `select studentId as 'Student Id', status as Status from attendance where classId=?`,
        [classId]
      );
      res.send({ detail, data: response, subjectType });
    }
  } catch (error) {
    console.log(error);
  }
};

//post update a class detail
const postUpdateClass = async (req, res) => {
  const teacherId = req.teacherId;
  const { teachesId, time, date, purpose, type, classId } = req.body;
  try {
    let [response] = await connection.execute(
      `select teacherId from teaches where teachesId=?`,
      [teachesId]
    );
    let detail = response[0];
    if (detail && detail.teacherId === teacherId) {
      let [response] = await connection.execute(
        `update class set date=?, time=?, type=?, purpose=? where classId=?`,
        [date, time, type,  purpose, classId]
      );
      res.status(200).send("updated");
    } else res.send("hiii");
  } catch (error) {
    console.log(error);
    res.status(200).send("error");
  }
};

//update attendance of a student for a class
const updateAttendance = async (req, res) => {
  const teacherId = req.teacherId;
  const { teachesId, classId, studentId, status } = req.body;
  try {
    let [response] = await connection.execute(
      `select a.teacherId as teacherId from teaches as a join class as b on a.teachesId = b.teachesId join attendance as c on b.classId=c.classId where a.teachesId=? and b.classId=? and c.studentId = ?`,
      [teachesId, classId, studentId]
    );
    let attendance = response[0];
    if (attendance && attendance.teacherId === teacherId) {
      await connection.execute(
        `update attendance set status=? where classId=? and studentId=?`,
        [status, classId, studentId]
      );
      res.send("updated");
    } else res.send("hiii");
  } catch (error) {
    console.log(error);
  }
};

//delete a class
const deleteClass = async (req, res) => {
  const teacherId = req.teacherId;
  const { teachesId, classId } = req.body;
  try {
    let [response] = await connection.execute(
      `select a.teacherId as teacherId from teaches as a join class as b on a.teachesId = b.teachesId where a.teachesId=? and b.classId=?`,
      [teachesId, classId]
    );
    let detail = response[0];
    if (detail && detail.teacherId === teacherId) {
      await connection.execute(`delete from attendance where classId=? `, [
        classId,
      ]);
      await connection.execute(`delete from class where classId = ?`, [
        classId,
      ]);
      res.status(200).send("deleted");
    } else res.send("hiii");
  } catch (error) {
    console.log(error);
    res.status(200).send(error);
  }
};


//create a exam
const getCreateExam = async (req, res) => {
  const teacherId = req.teacherId;
  const { teachesId } = req.query;
  try {
    let [response] = await connection.execute(
      `select a.teacherId as teacherId, b.deptId as 'Dept.', b.degree as Degree, b.sem as Semester, a.section as Section, a.groupId as 'Group', c.subjectId as 'Subject Id', c.name as Title from teaches as a join include as b on b.includeId=a.includeId join subject as c on c.subjectId = b.subjectId where a.teachesId=?`,
      [teachesId]
    );
    let detail = response[0];
    if (detail && detail.teacherId === teacherId) {
      delete detail.teacherId;
      let [response] = await connection.execute(
        `select studentId as 'Student Id' from student where deptId=? and degree=? and sem=? and section=? and groupId=?`,
        [
          detail["Dept."],
          detail["Degree"],
          detail["Semester"],
          detail["Section"],
          detail["Group"],
        ]
      );
      const result = response.map((element) => ({
        ...element,
        Marks: null,
      }));
      res.status(200).send({ result, detail });
    } else res.send("hiii");
  } catch (error) {
    console.log(error);
    res.status(200).send(error);
  }
};

const postCreateExam = async (req, res) => {
  const teacherId = req.teacherId;
  const { teachesId, result, name, maxMarks, date,} = req.body;
  try {
    let [response] = await connection.execute(
      `select teacherId from teaches where teachesId=?`,
      [teachesId]
    );
    let detail = response[0];
    if (detail && detail.teacherId === teacherId) {
      let [response] = await connection.execute(
        `insert into exam(date, name, maxMarks, teachesId) value(?,?,?,?)`,
        [date, name, maxMarks, teachesId]
      );
      await addMarks(response.insertId, result);
      res.status(200).send("created");
    } else res.send("hiii");
  } catch (error) {
    console.log(error);
    res.status(200).send("error");
  }
};

//get all exam
async function getAllExam(req, res) {
  const teacherId = req.teacherId;
  const { teachesId } = req.query;
  try {
    let [response] = await connection.execute(
      `select a.teacherId, b.deptId as 'Dept.', b.degree as Degree, b.sem as Semester, a.section as 'Section', a.groupId as 'Group', b.subjectId as 'Subject Id', c.name as Title from teaches as a join include as b on a.includeId=b.includeId join subject as c on b.subjectId=c.subjectId where teachesId=?`,
      [teachesId]
    );
    const detail = response[0];
    if (detail.teacherId === teacherId) {
      delete detail.teacherId;
      [response] = await connection.execute(
        `select examId, name as Exam, date as Date, maxMarks as 'Max Marks' from exam where teachesId = ? order by Date desc`,
        [teachesId]
      );
      const link = response.map(
        (element) =>
          `/teacher/exam/update/${teachesId + "_" + element.examId}`
      );
      const exams = response.map((element) => {
        delete element.examId;
        return { ...element, "Update": "Update" };
      });
      res.status(200).send({ exams, link, detail });
    }
  } catch (error) {
    console.log(error);
  }
};

//get result and details of a exam to update
const getUpdateExam = async (req, res) => {
  const teacherId = req.teacherId;
  const { teachesId, examId } = req.query;
  try {
    let [response] = await connection.execute(
      `select a.teacherId, b.deptId as 'Dept.', b.degree as Degree, b.sem as Semester, a.section as 'Section', a.groupId as 'Group', b.subjectId as 'Subject Id', c.name as Title from teaches as a join include as b on a.includeId=b.includeId join subject as c on b.subjectId=c.subjectId where a.teachesId=?`,
      [teachesId]
    );
    let detail = response[0];
    if (detail.teacherId === teacherId) {
      delete detail.teacherId;
      [response] = await connection.execute(
        `select name as Exam, date as Date, maxMarks as 'Max Marks' from exam where examId = ?`,
        [examId]
      );
      detail = { ...detail, ...response[0] };
      [response] = await connection.execute(
        `select studentId as 'Student Id', mark as Marks from mark where examId=?`,
        [examId]
      );
      const result = response.map(element=>({...element, Update: "Update"}));
      res.send({ detail, result});
    }
  } catch (error) {
    console.log(error);
  }
};

//post update exam details
const postUpdateExam = async (req, res) => {
  const teacherId = req.teacherId;
  const { teachesId, maxMarks, date, name, examId } = req.body;
  try {
    let [response] = await connection.execute(
      `select teacherId from teaches where teachesId=?`,
      [teachesId]
    );
    let detail = response[0];
    if (detail && detail.teacherId === teacherId) {
      await connection.execute(
        `update exam set date=?, name=?, maxMarks=? where examId=?`,
        [date, name, maxMarks, examId]
      );
      res.status(200).send("updated");
    } else res.send("hiii");
  } catch (error) {
    console.log(error);
    res.status(200).send("error");
  }
};

//update mark as a student for a exam
async function updateMark(req, res) {
  const teacherId = req.teacherId;
  const { studentId, teachesId, mark, examId } = req.body;
  try {
    let [response] = await connection.execute(
      `select a.teacherId,  b.maxMarks from teaches as a join exam as b on b.teachesId = a.teachesId join mark as c on c.examId = b.examId where a.teachesId=? and b.examId=? and c.studentId=?`,
      [teachesId, examId, studentId]
    );
    let detail = response[0];
    if (detail && detail.teacherId === teacherId && detail.maxMarks >= mark && mark >= 0) {
      await connection.execute(
        "update mark set mark=? where studentId=? and examId=?",
        [mark, studentId, examId]
      );
      res.status(200).send("updated");
    } else res.send("Hiii");
  } catch (error) {
    console.log(error);
    res.send("error");
  }
}

//delete a exam
const deleteExam = async (req, res) => {
  const teacherId = req.teacherId;
  const { teachesId, examId } = req.body;
  try {
    let [response] = await connection.execute(
      `select a.teacherId as teacherId from teaches as a join exam as b on a.teachesId = b.teachesId where a.teachesId=? and b.examId=?`,
      [teachesId, examId]
    );
    let detail = response[0];
    if (detail && detail.teacherId === teacherId) {
      await connection.execute(`delete from mark where examId=? `, [
        examId,
      ]);
      await connection.execute(`delete from exam where examId = ?`, [
        examId,
      ]);
      res.status(200).send("deleted");
    } else res.send("hiii");
  } catch (error) {
    console.log(error);
    res.status(200).send(error);
  }
};



export {
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
  getUpdateExam,
  postUpdateExam,
  updateMark,
  deleteExam
};
