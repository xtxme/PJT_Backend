import express from "express";
import cors from "cors";
import helmet from "helmet";
import morgan from "morgan";
import session from "express-session";
import passport from "passport";
import routes from "./routes/index.js";
import { notFound, errorHandler } from "./middlewares/errorHandler.js";
import "./config/passport.js"; // โหลดกลยุทธ์ Google

const app = express();

// middlewares พื้นฐาน
app.use(morgan("dev"));
app.use(helmet());
app.use(cors({ origin: process.env.FRONTEND_URL, credentials: true }));
app.use(express.json());

// session + passport
app.use(
    session({
        secret: process.env.SESSION_SECRET || "secret",
        resave: false,
        saveUninitialized: false,
    })
);
app.use(passport.initialize());
app.use(passport.session());

// routes หลัก
app.use("/", routes);

// 404 + error
app.use(notFound);
app.use(errorHandler);

export default app;
