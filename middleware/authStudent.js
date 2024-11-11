import jwt from "jsonwebtoken";
import cookie from "cookie";
import { logout } from "../controllers/studentUtils.js";


const authStudent = async (req, res, next) => {

  const { token } = cookie.parse(req.headers.cookie || "");

  // checking token is available
  if (!token) {
    res = logout(res);
    res.status(401).send({ message: "Not Authorised" });
  } else {
    try {
      const { studentId } = jwt.verify(token, "5EeOrBTP7khfjGZap428zDP2Fp8xk6QV");
      if(!studentId) throw Error("Not Authorised");
      req.studentId = studentId;
      next();
    } catch (error) {
        res = logout(res);
        res.status(401).send({message: "Not Authorised"});
    }
  }
};

export default authStudent;
