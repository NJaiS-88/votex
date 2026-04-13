const rooms = new Map();
const roomState = new Map();
const Meeting = require("../models/Meeting");

const getRoom = (roomId) => {
  if (!rooms.has(roomId)) {
    rooms.set(roomId, new Map());
  }
  return rooms.get(roomId);
};

const getRoomState = (roomId) => {
  if (!roomState.has(roomId)) {
    roomState.set(roomId, { forcedPinnedPeerId: null });
  }
  return roomState.get(roomId);
};

const getParticipants = (roomId) =>
  rooms.has(roomId) ? Array.from(rooms.get(roomId).values()) : [];

const emitParticipants = (io, roomId) => {
  io.to(roomId).emit("participant-list-updated", {
    participants: getParticipants(roomId),
  });
};

const emitPinState = (io, roomId) => {
  const participants = getParticipants(roomId);
  const sharingPeerIds = participants
    .filter((participant) => participant.isScreenSharing)
    .map((participant) => participant.peerId);
  const state = getRoomState(roomId);
  if (sharingPeerIds.length === 1) {
    state.forcedPinnedPeerId = sharingPeerIds[0];
  } else if (sharingPeerIds.length === 0) {
    state.forcedPinnedPeerId = null;
  } else if (!sharingPeerIds.includes(state.forcedPinnedPeerId)) {
    state.forcedPinnedPeerId = null;
  }
  io.to(roomId).emit("room-pin-updated", {
    forcedPinnedPeerId: state.forcedPinnedPeerId,
    sharingPeerIds,
  });
};

const removeParticipant = (io, socket, roomId) => {
  const room = rooms.get(roomId);
  if (!room) return;

  room.delete(socket.id);
  socket.to(roomId).emit("user-left", { peerId: socket.id });
  emitParticipants(io, roomId);
  emitPinState(io, roomId);

  if (room.size === 0) {
    rooms.delete(roomId);
    roomState.delete(roomId);
  }
};

const registerMeetingSocket = (io) => {
  io.on("connection", (socket) => {
    socket.on("join-room", async ({ roomId, user }) => {
      if (!roomId || !user?.name) return;

      const meeting = await Meeting.findOne({ roomId });
      const room = getRoom(roomId);
      const hasHostOnline = Array.from(room.values()).some((participant) => participant.isHost);
      const isMeetingHost = meeting?.host?.userId && meeting.host.userId === user.userId;
      const shouldBlockWithoutHost =
        !hasHostOnline &&
        room.size === 0 &&
        !!meeting?.host?.userId &&
        !isMeetingHost &&
        !meeting?.meetingSettings?.allowAllParticipants;

      if (shouldBlockWithoutHost) {
        socket.emit("host-unavailable", {
          message: "You will be let in when admin joins.",
        });
        return;
      }

      const participant = {
        userId: user.userId || "",
        name: user.name,
        email: user.email || "",
        avatarUrl: user.avatarUrl || "",
        peerId: socket.id,
        isHost: Boolean(isMeetingHost) || (room.size === 0 && !meeting?.host?.userId),
        audioEnabled: user.audioEnabled ?? true,
        videoEnabled: user.videoEnabled ?? true,
        isScreenSharing: false,
      };

      room.set(socket.id, participant);
      socket.join(roomId);
      socket.data.roomId = roomId;
      socket.data.user = participant;

      const update = {
        $setOnInsert: {
          roomId,
          startedAt: new Date(),
          host: {
            userId: participant.userId,
            name: participant.name,
            email: participant.email,
            peerId: socket.id,
            avatarUrl: participant.avatarUrl,
          },
        },
        $push: {
          participantHistory: {
            userId: participant.userId,
            name: participant.name,
            email: participant.email,
            peerId: socket.id,
            avatarUrl: participant.avatarUrl,
            joinedAt: new Date(),
          },
        },
      };
      if (participant.isHost) {
        delete update.$setOnInsert.host;
        update.$set = {
          host: {
            userId: participant.userId,
            name: participant.name,
            email: participant.email,
            peerId: socket.id,
            avatarUrl: participant.avatarUrl,
          },
        };
      }

      await Meeting.findOneAndUpdate({ roomId }, update, { upsert: true });

      const existingParticipants = Array.from(room.entries())
        .filter(([peerId]) => peerId !== socket.id)
        .map(([peerId, otherParticipant]) => ({
          peerId,
          user: otherParticipant,
        }));

      socket.emit("existing-participants", existingParticipants);
      socket.to(roomId).emit("user-joined", {
        peerId: socket.id,
        user: room.get(socket.id),
      });
      emitParticipants(io, roomId);
      emitPinState(io, roomId);
    });

    socket.on("signal-offer", ({ targetPeerId, offer, roomId, sender }) => {
      io.to(targetPeerId).emit("signal-offer", {
        fromPeerId: socket.id,
        offer,
        sender,
        roomId,
      });
    });

    socket.on("signal-answer", ({ targetPeerId, answer }) => {
      io.to(targetPeerId).emit("signal-answer", {
        fromPeerId: socket.id,
        answer,
      });
    });

    socket.on("signal-ice-candidate", ({ targetPeerId, candidate }) => {
      io.to(targetPeerId).emit("signal-ice-candidate", {
        fromPeerId: socket.id,
        candidate,
      });
    });

    socket.on("chat-message", ({ roomId, message }) => {
      if (!roomId || !message) return;
      io.to(roomId).emit("chat-message", message);
      Meeting.findOneAndUpdate(
        { roomId },
        {
          $push: {
            chatMessages: {
              senderId: message.senderId,
              sender: message.sender,
              senderAvatarUrl: message.senderAvatarUrl || "",
              type: message.type || "text",
              text: message.text,
              code: message.code || "",
              language: message.language || "",
              attachments: message.attachments || [],
              createdAt: message.createdAt || new Date(),
            },
          },
        },
        { upsert: true }
      ).catch(() => {});
    });

    socket.on("reaction", ({ roomId, reaction }) => {
      if (!roomId || !reaction) return;
      io.to(roomId).emit("reaction", reaction);
      Meeting.findOneAndUpdate(
        { roomId },
        {
          $push: {
            reactions: {
              senderId: reaction.senderId || "",
              sender: reaction.sender,
              emoji: reaction.emoji,
              createdAt: new Date(),
            },
          },
        },
        { upsert: true }
      ).catch(() => {});
    });

    socket.on("participant-media-updated", ({ roomId, updates }) => {
      const room = rooms.get(roomId);
      if (!room || !room.has(socket.id)) return;
      const current = room.get(socket.id);
      room.set(socket.id, { ...current, ...updates });
      emitParticipants(io, roomId);
      emitPinState(io, roomId);
    });

    socket.on("host-action", ({ roomId, targetPeerId, action }) => {
      const room = rooms.get(roomId);
      if (!room || !room.has(socket.id)) return;
      const actor = room.get(socket.id);
      if (!actor.isHost) return;
      io.to(targetPeerId).emit("host-action", { action, by: actor.name });
      if (action === "remove") {
        io.sockets.sockets.get(targetPeerId)?.leave(roomId);
        io.to(targetPeerId).emit("removed-by-host");
      }
    });

    socket.on("leave-room", ({ roomId }) => {
      if (!roomId) return;
      removeParticipant(io, socket, roomId);
    });

    socket.on("disconnecting", () => {
      for (const roomId of socket.rooms) {
        if (roomId === socket.id) continue;
        removeParticipant(io, socket, roomId);
      }
    });
  });
};

module.exports = registerMeetingSocket;
