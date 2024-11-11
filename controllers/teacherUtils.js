import connection from "../api/dbConnection.js";

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
      secure: false,
      maxAge: -20,
      sameSite: "strict",
    });
    return res;
  }

  export {getTeacher, updateTeacher, logout};