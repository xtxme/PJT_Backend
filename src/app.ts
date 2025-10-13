import express from "express";
import cors, { CorsOptions } from "cors";
import helmet from "helmet";
import morgan from "morgan";
import session from "express-session";
import passport from "passport";
import routes from "./routes/index.js";
import { notFound, errorHandler } from "./middlewares/errorHandler.js";
import "./config/passport.js"; // โหลดกลยุทธ์ Google

const app = express();

// disable etag to always send fresh analytics responses
app.disable("etag");

const parseOrigins = (raw?: string): string[] =>
    (raw ?? "")
        .split(",")
        .map((origin) => origin.trim())
        .filter(Boolean)
        .map((origin) => origin.replace(/\/$/, ""));

const defaultOrigins = ["http://localhost:3000", "http://localhost:3001"];
const allowedOrigins = Array.from(
    new Set([...defaultOrigins, ...parseOrigins(process.env.FRONTEND_URL)])
);

const corsOptions: CorsOptions = {
    origin: (origin, callback) => {
        if (!origin) return callback(null, true);
        const normalizedOrigin = origin.replace(/\/$/, "");
        if (allowedOrigins.includes(normalizedOrigin)) {
            return callback(null, true);
        }
        return callback(null, false);
    },
    credentials: true,
};

// middlewares พื้นฐาน
app.use(morgan("dev"));
app.use(helmet());

const rawFrontendOrigins = process.env.FRONTEND_URL ?? "http://localhost:3000,http://localhost:3005";
const allowedOrigins = rawFrontendOrigins
    .split(",")
    .map((origin) => origin.trim().replace(/\/+$/, ""))
    .filter(Boolean);

app.use(
    cors({
        origin(origin, callback) {
            if (!origin) {
                callback(null, true);
                return;
            }

            const normalizedOrigin = origin.replace(/\/+$/, "");

            if (allowedOrigins.includes(normalizedOrigin)) {
                callback(null, true);
            } else {
                callback(null, false);
            }
        },
        credentials: true,
    })
);
app.use(cors(corsOptions));
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
