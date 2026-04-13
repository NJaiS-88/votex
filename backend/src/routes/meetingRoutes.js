const express = require("express");
const { protect } = require("../middleware/authMiddleware");
const {
  startMeeting,
  endMeeting,
  saveRecordingMetadata,
  getMeeting,
  getMyMeetingHistory,
  updateMeetingSettings,
} = require("../controllers/meetingController");

const router = express.Router();

router.get("/history/my", protect, getMyMeetingHistory);
router.get("/:roomId", protect, getMeeting);
router.post("/:roomId/start", protect, startMeeting);
router.post("/:roomId/end", protect, endMeeting);
router.post("/:roomId/recordings", protect, saveRecordingMetadata);
router.patch("/:roomId/settings", protect, updateMeetingSettings);

module.exports = router;
