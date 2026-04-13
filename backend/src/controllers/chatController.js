const DirectMessageThread = require("../models/DirectMessageThread");
const User = require("../models/User");

const getParticipantKey = (userAId, userBId) => [String(userAId), String(userBId)].sort().join(":");

const getMyDirectThreads = async (req, res) => {
  try {
    const myUserId = String(req.user._id);
    const threads = await DirectMessageThread.find({ participantIds: myUserId }).sort({
      lastMessageAt: -1,
    });
    return res.status(200).json({ threads });
  } catch {
    return res.status(500).json({ message: "Could not fetch direct chats" });
  }
};

const getDirectThreadById = async (req, res) => {
  try {
    const myUserId = String(req.user._id);
    const thread = await DirectMessageThread.findById(req.params.threadId);
    if (!thread) return res.status(404).json({ message: "Chat not found" });
    if (!thread.participantIds.includes(myUserId)) {
      return res.status(403).json({ message: "Not authorized for this chat" });
    }
    return res.status(200).json({ thread });
  } catch {
    return res.status(500).json({ message: "Could not fetch chat thread" });
  }
};

const sendDirectMessage = async (req, res) => {
  try {
    const myUserId = String(req.user._id);
    const { otherUserId } = req.params;
    const { text } = req.body;
    if (!otherUserId || !text?.trim()) {
      return res.status(400).json({ message: "Recipient and message are required" });
    }
    if (myUserId === String(otherUserId)) {
      return res.status(400).json({ message: "Cannot message yourself" });
    }

    const otherUser = await User.findById(otherUserId).select("name email avatarUrl");
    if (!otherUser) return res.status(404).json({ message: "Recipient not found" });

    const participantKey = getParticipantKey(myUserId, otherUserId);
    let thread = await DirectMessageThread.findOne({ participantKey });
    if (!thread) {
      thread = await DirectMessageThread.create({
        participantIds: [myUserId, String(otherUserId)].sort(),
        participantKey,
        participants: [
          {
            userId: myUserId,
            name: req.user.name,
            email: req.user.email,
            avatarUrl: req.user.avatarUrl || "",
          },
          {
            userId: String(otherUser._id),
            name: otherUser.name,
            email: otherUser.email,
            avatarUrl: otherUser.avatarUrl || "",
          },
        ],
        messages: [],
      });
    }

    thread.messages.push({
      senderId: myUserId,
      senderName: req.user.name,
      senderAvatarUrl: req.user.avatarUrl || "",
      text: text.trim(),
      createdAt: new Date(),
    });
    thread.lastMessageAt = new Date();
    await thread.save();

    return res.status(200).json({ thread });
  } catch {
    return res.status(500).json({ message: "Could not send message" });
  }
};

module.exports = {
  getMyDirectThreads,
  getDirectThreadById,
  sendDirectMessage,
};
