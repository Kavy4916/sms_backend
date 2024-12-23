import express from "express";
import studentRouter from "./routes/studentRoute.js";
import bodyParser from "body-parser";
import connection from "./api/dbConnection.js";
import teacherRouter from "./routes/teacherRoute.js";
import "dotenv/config"

const PORT = process.env.PORT || 4000;
const FRONTEND = process.env.FRONTEND;

const app = express();

app.use((req, res, next) => {
    res.header('Access-Control-Allow-Origin', FRONTEND);
    res.header('Access-Control-Allow-Credentials', 'true');
    res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept, Authorization');
    res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
    next();
});

app.options('*', (req, res) => {
    res.header('Access-Control-Allow-Origin', FRONTEND);
    res.header('Access-Control-Allow-Credentials', 'true');
    res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept, Authorization');
    res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
    res.status(200).send();
  });


// Middleware to parse URL-encoded bodies
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));


app.use("/api/student", studentRouter);
app.use("/api/teacher",teacherRouter);


app.listen(PORT, async () => {
    console.log(`Listening to port ${PORT}!`);
});
