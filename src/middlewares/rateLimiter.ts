import rateLimit from "express-rate-limit";

const limiter = rateLimit({
  windowMs: 2 * 60 * 1000, // 2 min /
  limit: 100, // max 100 requests
  standardHeaders: "draft-7",
  legacyHeaders: false,
});

export default limiter;
