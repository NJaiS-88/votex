const rooms = new Map();
const Meeting = require("../models/Meeting");

const getRoom = (roomId) => {
  if (!rooms.has(roomId)) {
    rooms.set(roomId, new Map());
  }
  return rooms.get(roomId);
};

const registerMeetingSocket = (io) => {
  io.on("connection", (socket) => {
    socket.on("join-room", async ({ roomId, user }) => {
      if (!roomId || !user?.name) return;

      const room = getRoom(roomId);
      const participant = {
        userId: user.userId || "",
        name: user.name,
        email: user.email || "",
        peerId: socket.id,
        isHost: room.size === 0,
        audioEnabled: true,
        videoEnabled: true,
      };
      room.set(socket.id, participant);

      socket.join(roomId);
      socket.data.roomId = roomId;
      socket.data.user = participant;

      await Meeting.findOneAndUpdate(
        { roomId },
        {
          $setOnInsert: {
            roomId,
            startedAt: new Date(),
            host: {
              userId: participant.userId,
              name: participant.name,
              email: participant.email,
              peerId: socket.id,
            },
          },
          $push: {
            participantHistory: {
              userId: participant.userId,
              name: participant.name,
              email: participant.email,
              peerId: socket.id,
              joinedAt: new Date(),
            },
          },
        },
        { upsert: true }
      );

      const existingParticipants = Array.from(room.entries())
        .filter(([peerId]) => peerId !== socket.id)
        .map(([peerId, participant]) => ({
          peerId,
          user: participant,
        }));

      socket.emit("existing-participants", existingParticipants);
      socket.to(roomId).emit("user-joined", {
        peerId: socket.id,
        user: room.get(socket.id),
      });
      io.to(roomId).emit("participant-list-updated", {
        participants: Array.from(room.values()),
      });
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
              sender: message.sender,
              text: message.text,
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
      io.to(roomId).emit("participant-list-updated", {
        participants: Array.from(room.values()),
      });
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
      const room = rooms.get(roomId);
      if (!room) return;

      room.delete(socket.id);
      socket.to(roomId).emit("user-left", { peerId: socket.id });
      io.to(roomId).emit("participant-list-updated", {
        participants: Array.from(room.values()),
      });

      if (room.size === 0) {
        rooms.delete(roomId);
      }
    });

    socket.on("disconnecting", () => {
      for (const roomId of socket.rooms) {
        if (roomId === socket.id) continue;
        const room = rooms.get(roomId);
        if (!room) continue;

        room.delete(socket.id);
        socket.to(roomId).emit("user-left", { peerId: socket.id });
        io.to(roomId).emit("participant-list-updated", {
          participants: Array.from(room.values()),
        });

        if (room.size === 0) {
          rooms.delete(roomId);
        }
      }
    });
  });
};

module.exports = registerMeetingSocket;
