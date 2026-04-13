const mongoose = require("mongoose");

const directMessageThreadSchema = new mongoose.Schema(
  {
    participantIds: [{ type: String, required: true }],
    participantKey: { type: String, required: true, unique: true, index: true },
    participants: [
      {
        userId: String,
        name: String,
        email: String,
        avatarUrl: String,
      },
    ],
    messages: [
      {
        senderId: String,
        senderName: String,
        senderAvatarUrl: String,
        text: String,
        createdAt: { type: Date, default: Date.now },
      },
    ],
    lastMessageAt: { type: Date, default: Date.now, index: true },
  },
  { timestamps: true }
);

module.exports = mongoose.model("DirectMessageThread", directMessageThreadSchema);
