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

async function getStudent(studentId) {
  const [result] = await connection.execute(
    `SELECT * FROM student WHERE studentId = "${studentId}"`
  );
  return result[0];
}

async function updateStudent(field, value, key) {
  const queryPart = stringForUpdate(field, value);
  const [result] = await connection.execute(
    `update student set ${queryPart} where studentId= "${key}"`
  );
  return result;
}

async function enrollStudent(studentId, enrolling) {
  let query = "";
  for (var i = 0; i < enrolling.length; i++) {
    if (i === enrolling.length - 1)
      query = query + " " + `("${studentId}", "${enrolling[i]["Subject ID"]}")`;
    else
      query =
        query + " " + `("${studentId}", "${enrolling[i]["Subject ID"]}"), `;
  }
  await connection.execute(
    `insert into enrollment values ${query}`
  );
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


export {
  getStudent,
  updateStudent,
  logout,
  enrollStudent,
};
