import jwt from "jsonwebtoken";
import cookie from "cookie";
import { logout } from "../controllers/teacherUtils.js";
import "dotenv/config"

const SECRET = process.env.SECRET;

//status 401 redirect login (logout)
const authTeacher= async (req, res, next) => {

  const { token } = cookie.parse(req.headers.cookie || "");

  // checking token is available
  if (!token) {
    res = logout(res);
    res.status(401).send({ message: "Not Authorised" });
  } else {
    try {
      const { teacherId } = jwt.verify(token, SECRET);
      if(!teacherId) throw Error("Not Authorised");
      req.teacherId = teacherId;
      next();
    } catch (error) {
        res = logout(res);
        res.status(401).send({message: "Not Authorised"});
    }
  }
};

export default authTeacher;
