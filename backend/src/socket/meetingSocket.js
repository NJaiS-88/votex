const rooms = new Map();
const roomState = new Map();
const pendingParticipants = new Map();
const Meeting = require("../models/Meeting");
const crypto = require("crypto");

const hashValue = (value = "") =>
  crypto.createHash("sha256").update(String(value).toLowerCase().trim()).digest("hex");

const sanitizeText = (value = "") =>
  String(value)
    .replace(/<[^>]*>/g, "")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 2000);

const getRoom = (roomId) => {
  if (!rooms.has(roomId)) {
    rooms.set(roomId, new Map());
  }
  return rooms.get(roomId);
};

const getRoomState = (roomId) => {
  if (!roomState.has(roomId)) {
    roomState.set(roomId, { forcedPinnedPeerId: null, hostPinnedPeerId: null });
  }
  return roomState.get(roomId);
};

const getPendingRoom = (roomId) => {
  if (!pendingParticipants.has(roomId)) {
    pendingParticipants.set(roomId, new Map());
  }
  return pendingParticipants.get(roomId);
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
  const hostPinnedValid = participants.some((participant) => participant.peerId === state.hostPinnedPeerId);

  if (!hostPinnedValid) {
    state.hostPinnedPeerId = null;
  }

  if (state.hostPinnedPeerId) {
    state.forcedPinnedPeerId = state.hostPinnedPeerId;
  } else if (sharingPeerIds.length === 1) {
    state.forcedPinnedPeerId = sharingPeerIds[0];
  } else if (sharingPeerIds.length === 0) {
    state.forcedPinnedPeerId = null;
  } else if (!sharingPeerIds.includes(state.forcedPinnedPeerId)) {
    state.forcedPinnedPeerId = null;
  }

  io.to(roomId).emit("room-pin-updated", {
    forcedPinnedPeerId: state.forcedPinnedPeerId,
    hostPinnedPeerId: state.hostPinnedPeerId,
    sharingPeerIds,
  });
};

const emitPendingParticipants = (io, roomId) => {
  const waiting = Array.from(getPendingRoom(roomId).values()).map((entry) => ({
    peerId: entry.peerId,
    userId: entry.userId,
    name: entry.name,
    avatarUrl: entry.avatarUrl || "",
    requestedAt: entry.requestedAt,
  }));
  const hosts = getParticipants(roomId).filter((participant) => participant.isHost);
  hosts.forEach((host) => {
    io.to(host.peerId).emit("waiting-participants-updated", { waiting });
  });
};

const addParticipantToRoom = async ({ io, socket, roomId, participant }) => {
  const room = getRoom(roomId);
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
        emailHash: hashValue(participant.email || participant.userId || ""),
        peerId: socket.id,
        avatarUrl: participant.avatarUrl,
      },
    },
    $push: {
      participantHistory: {
        userId: participant.userId,
        name: participant.name,
        emailHash: hashValue(participant.email || participant.userId || ""),
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
        emailHash: hashValue(participant.email || participant.userId || ""),
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
  emitPendingParticipants(io, roomId);
};

const removeParticipant = (io, socket, roomId) => {
  const room = rooms.get(roomId);
  const pendingRoom = pendingParticipants.get(roomId);
  if (pendingRoom?.has(socket.id)) {
    pendingRoom.delete(socket.id);
    socket.emit("admission-denied", { message: "Join request cancelled." });
    emitPendingParticipants(io, roomId);
    if (pendingRoom.size === 0) pendingParticipants.delete(roomId);
  }
  if (!room) return;

  room.delete(socket.id);
  socket.to(roomId).emit("user-left", { peerId: socket.id });
  emitParticipants(io, roomId);
  emitPinState(io, roomId);

  if (room.size === 0) {
    rooms.delete(roomId);
    roomState.delete(roomId);
    pendingParticipants.delete(roomId);
  }
};

const registerMeetingSocket = (io) => {
  io.on("connection", (socket) => {
    socket.on("join-room", async ({ roomId, user }) => {
      if (!roomId || !user?.name) return;

      const meeting = await Meeting.findOne({ roomId });
      const room = getRoom(roomId);
      const isMeetingHost = meeting?.host?.userId && meeting.host.userId === user.userId;
      const isPublicJoinEnabled = Boolean(meeting?.meetingSettings?.allowAllParticipants);

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

      if (!participant.isHost && meeting?.host?.userId && !isPublicJoinEnabled) {
        const pendingRoom = getPendingRoom(roomId);
        pendingRoom.set(socket.id, {
          ...participant,
          peerId: socket.id,
          requestedAt: new Date().toISOString(),
        });
        socket.data.pendingRoomId = roomId;
        socket.data.pendingUser = participant;
        socket.emit("join-waiting-approval", {
          message: "Waiting for host to admit you.",
        });
        emitPendingParticipants(io, roomId);
        return;
      }

      await addParticipantToRoom({ io, socket, roomId, participant });
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
      const safeText = sanitizeText(message.text || "");
      if (!safeText) return;
      const safeMessage = {
        id: message.id || crypto.randomUUID(),
        senderId: message.senderId || "",
        sender: sanitizeText(message.sender || "User"),
        senderAvatarUrl: message.senderAvatarUrl || "",
        type: message.type === "emoji" ? "emoji" : "text",
        text: safeText,
        code: "",
        language: "",
        attachments: [],
        createdAt: message.createdAt || new Date().toISOString(),
      };
      io.to(roomId).emit("chat-message", safeMessage);
      Meeting.findOneAndUpdate(
        { roomId },
        {
          $push: {
            chatMessages: {
              senderId: safeMessage.senderId,
              sender: safeMessage.sender,
              senderAvatarUrl: safeMessage.senderAvatarUrl || "",
              type: safeMessage.type,
              text: safeMessage.text,
              code: "",
              language: "",
              attachments: [],
              createdAt: safeMessage.createdAt || new Date(),
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

    socket.on("host-set-pin-all", ({ roomId, targetPeerId }) => {
      const room = rooms.get(roomId);
      if (!room || !room.has(socket.id)) return;
      const actor = room.get(socket.id);
      if (!actor?.isHost) return;
      const state = getRoomState(roomId);
      const hasTarget = targetPeerId && room.has(targetPeerId);
      state.hostPinnedPeerId = hasTarget ? targetPeerId : null;
      emitPinState(io, roomId);
    });

    socket.on("host-admit-participant", async ({ roomId, targetPeerId }) => {
      const room = rooms.get(roomId);
      if (!room || !room.has(socket.id)) return;
      const actor = room.get(socket.id);
      if (!actor?.isHost) return;

      const pendingRoom = pendingParticipants.get(roomId);
      if (!pendingRoom || !pendingRoom.has(targetPeerId)) return;
      const pendingUser = pendingRoom.get(targetPeerId);
      const targetSocket = io.sockets.sockets.get(targetPeerId);
      pendingRoom.delete(targetPeerId);
      if (!targetSocket) {
        emitPendingParticipants(io, roomId);
        if (pendingRoom.size === 0) pendingParticipants.delete(roomId);
        return;
      }

      delete targetSocket.data.pendingRoomId;
      delete targetSocket.data.pendingUser;
      targetSocket.emit("admission-approved", {
        message: "Host admitted you to the meeting.",
      });
      await addParticipantToRoom({
        io,
        socket: targetSocket,
        roomId,
        participant: {
          ...pendingUser,
          peerId: targetSocket.id,
          isHost: false,
        },
      });
      if (pendingRoom.size === 0) pendingParticipants.delete(roomId);
    });

    socket.on("host-reject-participant", ({ roomId, targetPeerId }) => {
      const room = rooms.get(roomId);
      if (!room || !room.has(socket.id)) return;
      const actor = room.get(socket.id);
      if (!actor?.isHost) return;

      const pendingRoom = pendingParticipants.get(roomId);
      if (!pendingRoom || !pendingRoom.has(targetPeerId)) return;
      pendingRoom.delete(targetPeerId);
      io.to(targetPeerId).emit("admission-denied", {
        message: "Host did not admit your request.",
      });
      io.sockets.sockets.get(targetPeerId)?.leave(roomId);
      emitPendingParticipants(io, roomId);
      if (pendingRoom.size === 0) pendingParticipants.delete(roomId);
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
      if (socket.data.pendingRoomId) {
        const pendingRoom = pendingParticipants.get(socket.data.pendingRoomId);
        if (pendingRoom?.has(socket.id)) {
          pendingRoom.delete(socket.id);
          emitPendingParticipants(io, socket.data.pendingRoomId);
          if (pendingRoom.size === 0) {
            pendingParticipants.delete(socket.data.pendingRoomId);
          }
        }
      }
      for (const roomId of socket.rooms) {
        if (roomId === socket.id) continue;
        removeParticipant(io, socket, roomId);
      }
    });
  });
};

module.exports = registerMeetingSocket;
