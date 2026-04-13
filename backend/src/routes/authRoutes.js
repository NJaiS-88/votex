const express = require("express");
const {
  signup,
  login,
  getMe,
  updateMe,
  resetMyData,
} = require("../controllers/authController");
const { protect } = require("../middleware/authMiddleware");

const router = express.Router();

router.post("/signup", signup);
router.post("/login", login);
router.get("/me", protect, getMe);
router.put("/me", protect, updateMe);
router.delete("/reset-data", protect, resetMyData);

module.exports = router;
