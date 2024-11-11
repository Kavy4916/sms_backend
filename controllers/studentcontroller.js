import jwt from "jsonwebtoken";
import connection from "../api/dbConnection.js";
import bcrypt from "bcrypt";
import { getStudent, updateStudent, enrollStudent, logout } from "./studentUtils.js";

const curSessionId = "jul24-dec24";


//check
const check = (req, res) => {
  res.status(204).send();
};

//to create a token
const createToken = (studentId) => {
  return jwt.sign({ studentId }, "5EeOrBTP7khfjGZap428zDP2Fp8xk6QV", {
    expiresIn: "1d",
  });
};

//to handel login
async function loginStudent(req, res) {
  const { studentId, password } = req.body;

  try {
    if (!studentId || !password) {
      res
        .status(200)
        .send({ error: false, message: "All fields must be filled!" });
    } else {
      const student = await getStudent(studentId);

      if (!student) {
        res.status(200).send({ message: "Student is not registered!" });
      } else {
        if (student.blockedDateTime) {
          res.status(200).send({
            message: "You have reached max login limits!",
          });
        } else {
          const match = await bcrypt.compare(password, student.password);

          if (match) {
            await updateStudent(["wrong"], [0], studentId);
            res.cookie("token", String(createToken(student.studentId)), {
              path: "/",
              httpOnly: true,
              secure: true,
              maxAge: 1000 * 60 * 60 * 24,
              sameSite: "strict",
            });
            res.status(204).send();
          } else {
            if (student.wrong === 2) {
              const blockedDateTime = new Date().toISOString();
              await updateStudent(
                ["blockedDateTime", "wrong"],
                [blockedDateTime, 0],
                studentId
              );
              res.status(200).send({
                message: "You have reached max login limits!",
              });
            } else {
              await updateStudent(["wrong"], [student.wrong + 1], studentId);
              res.status(200).send({ message: "Wrong Password!" });
            }
          }
        }
      }
    }
  } catch (error) {
    console.log(error);
    res.status(200).send({ message: "Something went wrong try later!" });
  }
}

//function to handel logout
function logoutStudent(req, res) {
  res = logout(res);
  res.status(204).send();
}

//function to change password
async function changePassword(req, res) {
  const studentId = req.studentId;
  const { password, newPassword } = req.body;
  if (!password || !newPassword || newPassword.length < 8)
    res
      .status(200)
      .send({message: "All fields must be filled!" });
  else {
    try {
      const student = await getStudent(studentId);
      if (!student) {
        res.status(200).send({ message: "Bad Request" });
      } else {
        const match = await bcrypt.compare(password, student.password);
        if (match) {
          const hash = bcrypt.hashSync(newPassword, 10);
          await updateStudent(["password", "wrong"], [hash, 0], studentId);
          res.status(204).send();
        } else {
          if (student.wrong === 2) {
            const blockedDateTime = new Date().toISOString();
            await updateStudent(
              ["wrong"],
              [0],
              studentId
            );
            res = logout(res);
            res.status(400).send({
              message: "Maximum try limit reached!",
            });
          } else {
            await updateStudent(["wrong"], [student.wrong + 1], studentId);
            res.status(200).send({ message: "Wrong Password!" });
          }
        }
      }
    } catch (error) {
      console.log(error);
      res = logout(res);
      res.status(400).send({ message: "Something went wrong" });
    }
  }
}

//detail
async function detail(req, res) {
  const studentId = req.studentId;
  try {
    let student = await getStudent(studentId);
    res.status(200).send(student);
  } catch (error) {
    console.log(error);
    res = logout(res);
    res.status(400).send({ message: "Something went Wrong" });
  }
}

//register
async function register(req, res) {
  const studentId = req.studentId;
  try {
    const student = await getStudent(studentId);
    if (student.disContinue)
      res.status(200).send({
        message: "You have discontinued the course!",
      });
    else if (student.yearBack)
      res.status(200).send({
        message: "You have not passed the previous course!",
      });
    else {
      let [result] = await connection.execute(
        `select a.subjectId as 'Subject ID', b.name as Titel, b.credit as Credits from enrollment as a join subject as b on a.subjectId = b.subjectId  where a.studentId = ? `,
        [student.studentId]
      );
      const enrollment = result;

      if (!enrollment.length) {
        [result] = await connection.execute(
          `select * from session where sessionId = "${curSessionId}"`
        );
        const session = result[0];
        const date = new Date().toISOString().split("T")[0];
        session.enrollmentEnd = session.enrollmentEnd
          .toISOString()
          .split("T")[0];

        if (date > session.enrollmentEnd) {
          updateStudent("discontinue", 1, studentId);
          res.status(200).send({
            message: "You have discontinued the course!",
          });
        } else {
          [result] = await connection.execute(
            `select b.subjectId as 'Subject ID', b.name as Title, b.credit as Credits from include as a join subject as b on a.subjectId = b.subjectId  where a.deptId = ? and a.degree = ? and sem = ?`,
            [student.deptId, student.degree, student.sem]
          );
          const enrolling = result;
          res.status(200).send({
            message: "Not enrolled yet! Enroll using the form given below",
            student,
            enrolling,
          });
        }
      } else
        res.status(200).send({
          enrollment,
          message: "You are already registered in the courses listed below!",
          student,
        });
    }
  } catch (error) {
    console.log(error);
    res = logout(res);
    res.status(400).send({ message: "Something went wrong!" });
  }
}


const acceptRegister = async (req, res) => {
  const studentId = req.studentId;
  const { paymentId, amount, date, mode, status, enrolling } = req.body;
  if (status !== "successful") {
    res.status(200).send({ message: "Payment Failed!" });
  } else {
    if (!(paymentId && date && amount && mode && enrolling)) {
      res = logout(res);
      res.status(400).send({ message: "Bad Request!" });
    } else {
      try {
        const student = await getStudent(studentId);
        if (student.disContinue || student.yearBack) {
          res = logout(res);
          res.status(400).send({ message: "Bad Request!" });
        } else {
          let [result] = await connection.execute(
            `select * from session where sessionId = "${curSessionId}"`
          );
          const session = result[0];
          session.date = date;
          session.enrollmentEnd = session.enrollmentEnd.toISOString();
          session.startDate = session.startDate.toISOString();
          const curDate = new Date().toISOString();
          console.log(session, curDate);
          if (
            (session.enrollmentEnd >= session.date) &&
            (session.startDate <= session.date) &&
            (session.enrollmentEnd >= curDate) &&
            (session.startDate <= curDate)
          ) {
            [result] = await connection.execute(
              `select b.subjectId as 'Subject ID', b.name as Title, b.credit as Credits from include as a join subject as b on a.subjectId = b.subjectId  where a.deptId = ? and a.degree = ? and sem = ?`,
              [student.deptId, student.degree, student.sem]
            );
            const enrollingFound = result;
            if (JSON.stringify(enrolling) === JSON.stringify(enrollingFound)) {
              const purposeId = student.degree + "_" + student.sem;

              [result] = await connection.execute(
                `insert into payment(paymentId, date, mode, amount, studentId, purposeId) value(?,?,?,?,?,?)`,
                [
                  paymentId,
                  date.split("T")[0]+" "+date.split("T")[1].split(".")[0],
                  mode,
                  amount,
                  studentId,
                  purposeId,
                ]
              );
              try {
                await enrollStudent(studentId, enrolling);
                res.status(204).send({});
              } catch (error) {
                console.log(error);
                [result] = await connection.execute(
                  `delete from payment where paymentId="${paymentId}"`
                );
                res = logout(res);
                res.status(400).send({ message: "Bad Request!" });
              }
            } else {res = logout(res); res.status(400).send({ message: "Bad Request!" });}
          } else {res = logout(res); res.status(400).send({ message: "Bad Request!" });}
        }
      } catch (error) {
        console.log(error);
        res = logout(res);
        res.status(400).send({ message: "Something went wrong!" });
      }
    }
  }
};

//notice
const notice = async (req, res) => {
  try {
    const [response] = await connection.execute(`Select * from notice`);
    res.status(200).send(response);
  } catch {
    res.status(403).send({ message: "Failed to load!" });
  }
};

//evaluation
const evaluation = async (req, res) => {
  const studentId = req.studentId;
  try {
    const student = await getStudent(studentId);
    if(!student) {
      res = logout(res);
      res.status(400).send({message: "Bad Request"});
    }
    else{
    const [response] = await connection.execute(
      "select e.subjectId as 'Subject ID', e.name as Title from mark as a join exam as b on a.examId = b.examId join teaches as c on c.teachesId = b.teachesId join include as  d on d.includeId = c.includeId join subject as e on e.subjectId = d.subjectId where a.studentId=? group by d.subjectId",
      [studentId]
    );
    const detail = {
      Name: student.fName + " " + student.lName,
      "Student Id": student.studentId,
      Branch: student.deptId,
      Degree: student.degree,
      Semester: student.sem,
    };
    const data = response.map((element)=>({...element, 'See Detail': `See`}));
    const link = response.map((element)=>(`/evaluation/${element["Subject ID"]}`))
    res.status(200).send({ payload: data, detail, link});
  }
  } catch {
    (error) => {
      console.log(error);
      res = logout(res);
      res.status(400).send({ message: "Something went wrong!" });
    };
  }
};

//course result
const courseResult = async (req, res) => {
  const studentId = req.studentId;
  const { sessionId, courseId } = req.body;
  try {
    const student = await getStudent(studentId);
    const [response] = await connection.execute(
      `select subjectId as 'Subject ID', sum(mark) as Marks from mark where sessionId = ? and courseId = ? and studentId = ? group by subjectId`,
      [sessionId, courseId, studentId]
    );
    const detail = {
      Name: student.fName + " " + student.lName,
      Roll: student.studentId,
      Department: student.deptId,
      Degree: student.degree,
      Session: sessionId,
      Course: courseId,
    };
    const data = response.map((element) => ({
      ...element,
      Result: "See",
    }));
    const link = response.map(
      (element) =>
        `/subjectResult/${sessionId}_${courseId}_${element["Subject ID"]}`
    );
    res.status(200).send({ payload: data, link, detail });
  } catch {
    (error) => {
      res.status(403).send({ message: "Something went wrong try later!" });
    };
  }
};

//subjectEvaluation
const subjectEvaluation = async (req, res) => {
  const studentId = req.studentId;
  const {subjectId } = req.body;
  try {
    const student = await getStudent(studentId);
    if(!student) {res = logout(res); res.status(400).send({message: "Bad Request!"});}
    else{
    const [response] = await connection.execute(
      "select b.name as 'Exam', b.date as 'Exam-Date', a.mark as Marks from mark as a join exam as b on a.examId = b.examId join teaches as c on c.teachesId = b.teachesId join include as d on d.includeId = c.includeId where a.studentId=? and d.subjectId = ?",
      [studentId, subjectId]
    );
    const [subject] = await connection.execute("select * from subject where subjectId=?",[subjectId]);
    const detail = {
      Name: student.fName + " " + student.lName,
      Roll: student.studentId,
      Branch: student.deptId,
      Degree: student.degree,
      Semester: student.sem,
      "Subject-ID": subjectId,
      "Title": subject[0].name
    };
    res.status(200).send({ payload: response, detail });
  }
  } catch {
    (error) => {
      console.log(error);
      res = logout(res);
      res.status(400).send({ message: "Something went wrong try later!" });
    };
  }
};

//function to handel requestUpdate
async function requestUpdate(req, res) {
  const studentId = req.studentId;
  const { password, field, value } = req.body;
  if (!password || !field || !value)
    res
      .status(200)
      .send({message: "All fields must be filled!" });
  else {
    try {
      const student = await getStudent(studentId);
      if (!student) {
        res.status(200).send({ message: "Bad Request" });
      } else {
        const match = await bcrypt.compare(password, student.password);
        if (match) {
          const [response] = await connection.execute(`insert into updateRequest(studentId, field, value) value(?, ?, ?)`,[studentId, field, value]);
          res.status(201).send({message: "Request submitted successfully!"});
        } else {
          if (student.wrong === 2) {
            const blockedDateTime = new Date().toISOString();
            await updateStudent(
              ["wrong"],
              [0],
              studentId
            );
            res = logout(res);
            res.status(400).send({
              message: "Maximum try limit reached!",
            });
          } else {
            await updateStudent(["wrong"], [student.wrong + 1], studentId);
            res.status(200).send({ message: "Wrong Password!" });
          }
        }
      }
    } catch (error) {
      console.log(error);
      res = logout(res);
      res.status(400).send({ message: "Something went wrong" });
    }
  }
}

export {
  loginStudent,
  logoutStudent,
  changePassword,
  detail,
  register,
  acceptRegister,
  notice,
  check,
  evaluation,
  courseResult,
  subjectEvaluation,
  requestUpdate,
};
