const Meeting = require("../models/Meeting");

const startMeeting = async (req, res) => {
  try {
    const { roomId } = req.params;
    const meeting = await Meeting.findOneAndUpdate(
      { roomId },
      {
        $setOnInsert: {
          roomId,
          startedAt: new Date(),
          status: "live",
          host: {
            userId: String(req.user._id),
            name: req.user.name,
            email: req.user.email,
          },
        },
      },
      { upsert: true, returnDocument: "after" }
    );
    return res.status(200).json({ meeting });
  } catch {
    return res.status(500).json({ message: "Could not start meeting" });
  }
};

const endMeeting = async (req, res) => {
  try {
    const { roomId } = req.params;
    const meeting = await Meeting.findOne({ roomId });
    if (!meeting) return res.status(404).json({ message: "Meeting not found" });

    meeting.status = "ended";
    meeting.endedAt = new Date();
    const durationSec = Math.max(
      0,
      Math.floor((meeting.endedAt.getTime() - meeting.startedAt.getTime()) / 1000)
    );
    meeting.replayMetadata = {
      totalParticipants: meeting.participantHistory.length,
      totalMessages: meeting.chatMessages.length,
      totalReactions: meeting.reactions.length,
      totalRecordings: meeting.recordings.length,
      durationSec,
    };
    await meeting.save();

    return res.status(200).json({ meeting });
  } catch {
    return res.status(500).json({ message: "Could not end meeting" });
  }
};

const saveRecordingMetadata = async (req, res) => {
  try {
    const { roomId } = req.params;
    const { fileName, durationSec, sizeBytes, startedAt, endedAt } = req.body;
    const meeting = await Meeting.findOneAndUpdate(
      { roomId },
      {
        $push: {
          recordings: {
            fileName,
            durationSec,
            sizeBytes,
            startedAt,
            endedAt,
            recordedBy: req.user.name,
          },
        },
      },
      { upsert: true, returnDocument: "after" }
    );
    return res.status(200).json({ meeting });
  } catch {
    return res.status(500).json({ message: "Could not save recording metadata" });
  }
};

const getMeeting = async (req, res) => {
  try {
    const meeting = await Meeting.findOne({ roomId: req.params.roomId });
    if (!meeting) return res.status(404).json({ message: "Meeting not found" });
    return res.status(200).json({ meeting });
  } catch {
    return res.status(500).json({ message: "Could not fetch meeting" });
  }
};

const getMyMeetingHistory = async (req, res) => {
  try {
    const meetings = await Meeting.find({
      $or: [
        { "host.userId": String(req.user._id) },
        { "participantHistory.userId": String(req.user._id) },
      ],
    })
      .sort({ updatedAt: -1 })
      .limit(20);
    return res.status(200).json({ meetings });
  } catch {
    return res.status(500).json({ message: "Could not fetch meeting history" });
  }
};

module.exports = {
  startMeeting,
  endMeeting,
  saveRecordingMetadata,
  getMeeting,
  getMyMeetingHistory,
};
