require("dotenv").config();
const express = require("express");
const cookieParser = require("cookie-parser");
const path = require("path");
const fs = require("fs");

const publicRoutes = require("./routes/public");
const adminRoutes = require("./routes/admin");
const scanRoutes = require("./routes/scan");

const app = express();
const PORT = process.env.PORT || 3000;

// Make sure the uploads folder exists before multer needs it.
const uploadsDir = path.join(__dirname, "uploads");
if (!fs.existsSync(uploadsDir)) fs.mkdirSync(uploadsDir);

app.set("view engine", "ejs");
app.set("views", path.join(__dirname, "views"));

app.use(express.urlencoded({ extended: true }));
app.use(express.json());
app.use(cookieParser());
app.use(express.static(path.join(__dirname, "public")));
app.use("/uploads", express.static(uploadsDir));

app.use((req, res, next) => {
  res.locals.aiEnabled = !!process.env.ANTHROPIC_API_KEY;
  next();
});

app.use("/", publicRoutes);
app.use("/admin", adminRoutes);
app.use("/", scanRoutes);

app.use((req, res) => {
  res.status(404).render("404", { title: "Not Found" });
});

app.listen(PORT, () => {
  console.log(`Local Lumber Marketplace running at http://localhost:${PORT}`);
  if (!process.env.ANTHROPIC_API_KEY) {
    console.log("ANTHROPIC_API_KEY not set — Project Scanner will use the rule-of-thumb fallback estimator.");
  }
});
