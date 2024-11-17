import connection from "../api/dbConnection.js";
import jwt from "jsonwebtoken";
import "dotenv/config";

const SECRET = process.env.SECRET;

function stringForUpdate(field, value) {
    let query = "";
    for (var i = 0; i < field.length; i++) {
      if (i == field.length - 1)
        query = query + " " + `${field[i]} = "${value[i]}" `;
      else query = query + " " + `${field[i]} = "${value[i]}", `;
    }
    return query;
  }

  async function getTeacher(teacherId) {
    const [result] = await connection.execute(
      `SELECT * FROM teacher WHERE teacherId = "${teacherId}"`
    );
    return result[0];
  }
  
  async function updateTeacher(field, value, key) {
    const queryPart = stringForUpdate(field, value);
    const [result] = await connection.execute(
      `update teacher set ${queryPart} where teacherId= "${key}"`
    );
    return result;
  }
  
  function logout(res) {
    res.cookie("token", null, {
      path: "/",
      httpOnly: true,
      secure: true,
      maxAge: -20,
      sameSite: "none",
    });
    return res;
  }

  async function markAttendance(classId, attendance) {
    let query = "";
    for (var i = 0; i < attendance.length; i++) {
      if (i === attendance.length - 1)
        query = query + " " + `("${classId}", "${attendance[i]["Student Id"]}", "${attendance[i].Status}")`;
      else
        query =
          query + " " + `("${classId}", "${attendance[i]["Student Id"]}", "${attendance[i].Status}"), `;
    }
    await connection.execute(
      `insert into attendance values ${query}`
    );
  }

  async function addMarks(examId, result) {
    let query = "";
    for (var i = 0; i < result.length; i++) {
      if (i === result.length - 1)
        query = query + " " + `("${examId}", "${result[i]["Student Id"]}", "${result[i].Marks || 0}")`;
      else
        query =
          query + " " + `("${examId}", "${result[i]["Student Id"]}", "${result[i].Marks || 0}"), ` ;
    }
    await connection.execute(
      `insert into mark values ${query}`
    );
  }

//to create a token
const createToken = (teacherId) => {
  return jwt.sign({ teacherId }, SECRET, {
    expiresIn: "1d",
  });
}; 

  export {getTeacher, updateTeacher, logout, markAttendance, addMarks, createToken};