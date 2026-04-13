const express = require("express");
const { protect } = require("../middleware/authMiddleware");
const {
  getMyDirectThreads,
  getDirectThreadById,
  sendDirectMessage,
} = require("../controllers/chatController");

const router = express.Router();

router.get("/threads", protect, getMyDirectThreads);
router.get("/threads/:threadId", protect, getDirectThreadById);
router.post("/direct/:otherUserId/messages", protect, sendDirectMessage);

module.exports = router;
