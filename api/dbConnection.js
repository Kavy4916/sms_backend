import mysql from "mysql2/promise";
import 'dotenv/config';

//creating connection object
var connection = null;
try{
  connection = await mysql.createConnection({
  host: process.env.HOST,
  port: process.env.DBPORT,
  user: process.env.USER,
  database: process.env.DATABASE,
  password: process.env.PASSWORD
});
  console.log("Connected!");
}catch(error){
    throw(error);
}

// host: "127.0.0.1",
// port: "3306",
// user: "root",
// database: "sms",
// password: "12345678"


export default connection;

