const mongoose = require("mongoose");

const meetingSchema = new mongoose.Schema(
  {
    roomId: { type: String, required: true, unique: true, index: true },
    status: {
      type: String,
      enum: ["live", "ended"],
      default: "live",
    },
    host: {
      userId: String,
      name: String,
      email: String,
      peerId: String,
      avatarUrl: String,
    },
    startedAt: { type: Date, default: Date.now },
    endedAt: Date,
    participantHistory: [
      {
        userId: String,
        name: String,
        email: String,
        peerId: String,
        avatarUrl: String,
        joinedAt: { type: Date, default: Date.now },
        leftAt: Date,
      },
    ],
    meetingSettings: {
      allowAllParticipants: { type: Boolean, default: false },
    },
    chatMessages: [
      {
        senderId: String,
        sender: String,
        senderAvatarUrl: String,
        type: {
          type: String,
          enum: ["text", "emoji", "code", "media", "system"],
          default: "text",
        },
        text: String,
        code: String,
        language: String,
        attachments: [
          {
            kind: { type: String, enum: ["image", "video", "file"] },
            url: String,
            fileName: String,
            mimeType: String,
            sizeBytes: Number,
          },
        ],
        createdAt: { type: Date, default: Date.now },
      },
    ],
    reactions: [
      {
        senderId: String,
        sender: String,
        emoji: String,
        createdAt: { type: Date, default: Date.now },
      },
    ],
    recordings: [
      {
        fileName: String,
        durationSec: Number,
        sizeBytes: Number,
        recordedBy: String,
        startedAt: Date,
        endedAt: Date,
        createdAt: { type: Date, default: Date.now },
      },
    ],
    replayMetadata: {
      totalParticipants: { type: Number, default: 0 },
      totalMessages: { type: Number, default: 0 },
      totalReactions: { type: Number, default: 0 },
      totalRecordings: { type: Number, default: 0 },
      durationSec: { type: Number, default: 0 },
    },
  },
  { timestamps: true }
);

module.exports = mongoose.model("Meeting", meetingSchema);
