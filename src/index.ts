import express from "express";
import cors from "cors";
import path from "path";
import helmet from "helmet";
import fileUpload from "express-fileupload";
import bodyParser from "body-parser";
import "dotenv/config";
import rateLimiter from "./middlewares/rateLimiter";
import userRoutes from "./routes/userRoutes";
import uploadRoutes from "./routes/uploadRoutes";
import pageRoutes from "./routes/pageRoutes";

const app = express();
const port = process.env.PORT || 3000;

app.set("trust proxy", "loopback");

app.use(rateLimiter);
app.use(cors());
app.use(helmet());
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));
app.use(
  fileUpload({
    limits: { fileSize: 50 * 1024 * 1024 },
  }),
);

app.use("/", (req,res,next)=>{
  express.static(path.join(__dirname, "src/public"))(req,res,next);
});
app.set("view engine", "hbs");

app.use("/api", userRoutes);
app.use("/api", uploadRoutes);
app.use("/", pageRoutes);

app.listen(port, () => {
  console.log(`Server is running on port ${port}`);
});
