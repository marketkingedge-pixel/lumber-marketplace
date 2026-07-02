const express = require("express");
const multer = require("multer");
const path = require("path");
const router = express.Router();
const { estimateProject } = require("../lib/estimator");

const storage = multer.diskStorage({
  destination: path.join(__dirname, "..", "uploads"),
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname) || ".jpg";
    cb(null, `scan-${Date.now()}${ext}`);
  },
});

const upload = multer({
  storage,
  limits: { fileSize: 10 * 1024 * 1024 }, // 10MB
  fileFilter: (req, file, cb) => {
    if (!file.mimetype.startsWith("image/")) {
      return cb(new Error("Please upload an image file."));
    }
    cb(null, true);
  },
});

router.get("/scanner", (req, res) => {
  res.render("scanner", { title: "Project Scanner", error: null });
});

router.post("/scanner", (req, res) => {
  upload.single("photo")(req, res, async (err) => {
    if (err) {
      return res.render("scanner", { title: "Project Scanner", error: err.message });
    }
    if (!req.file) {
      return res.render("scanner", { title: "Project Scanner", error: "Please choose a photo of the project area." });
    }

    const { projectType, length, width, notes } = req.body;

    try {
      const result = await estimateProject({
        imagePath: req.file.path,
        mimeType: req.file.mimetype,
        projectType,
        length,
        width,
        notes,
      });

      res.render("scan-result", {
        title: "Your Project Estimate",
        result,
        photoUrl: `/uploads/${req.file.filename}`,
      });
    } catch (e) {
      console.error(e);
      res.render("scanner", { title: "Project Scanner", error: "Something went wrong analyzing that photo. Please try again." });
    }
  });
});

module.exports = router;
