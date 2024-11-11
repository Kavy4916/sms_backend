import mysql from "mysql2/promise";

//creating connection object
var connection = null;
try{
  connection = await mysql.createConnection({
  host: "34.131.12.8",
  port: "3306",
  user: "user",
  database: "sms",
  password: "6csnf[LdBmZu.A[1"
});
  console.log("Connected!");
}catch(error){
    throw(error);
}

//connecting to server


export default connection;

