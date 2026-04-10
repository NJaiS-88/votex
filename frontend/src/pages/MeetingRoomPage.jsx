import { useEffect, useMemo, useRef, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { io } from "socket.io-client";
import { useAuthStore } from "../store/useAuthStore";
import { useMeetingStore } from "../store/useMeetingStore";
import VideoTile from "../components/VideoTile";
import {
  endMeetingSession,
  saveRecordingMetadata,
  startMeetingSession,
} from "../api/meetingApi";

const rtcConfig = {
  iceServers: [{ urls: "stun:stun.l.google.com:19302" }],
};

const MeetingRoomPage = () => {
  const { roomId } = useParams();
  const navigate = useNavigate();
  const user = useAuthStore((state) => state.user);
  const logout = useAuthStore((state) => state.logout);
  const localVideoRef = useRef(null);
  const socketRef = useRef(null);
  const localStreamRef = useRef(null);
  const cameraStreamRef = useRef(null);
  const peersRef = useRef(new Map());
  const recorderRef = useRef(null);
  const recordedChunksRef = useRef([]);
  const [remoteStreams, setRemoteStreams] = useState([]);
  const [chatInput, setChatInput] = useState("");
  const [recording, setRecording] = useState(false);
  const [sharingScreen, setSharingScreen] = useState(false);
  const [audioEnabled, setAudioEnabled] = useState(true);
  const [videoEnabled, setVideoEnabled] = useState(true);
  const [mediaPermissionGranted, setMediaPermissionGranted] = useState(false);
  const [requestingPermissions, setRequestingPermissions] = useState(false);
  const [permissionMessage, setPermissionMessage] = useState("");
  const [participants, setParticipants] = useState([]);
  const [socketId, setSocketId] = useState("");
  const [meetingStartedAt, setMeetingStartedAt] = useState(null);
  const [error, setError] = useState("");

  const { chatMessages, reactions } = useMeetingStore();
  const addChatMessage = useMeetingStore((state) => state.addChatMessage);
  const clearChat = useMeetingStore((state) => state.clearChat);
  const addReaction = useMeetingStore((state) => state.addReaction);
  const removeReaction = useMeetingStore((state) => state.removeReaction);
  const clearMeetingState = useMeetingStore((state) => state.clearMeetingState);

  const socketServerUrl = useMemo(() => {
    if (import.meta.env.VITE_SOCKET_URL) {
      return import.meta.env.VITE_SOCKET_URL;
    }
    const apiBase =
      import.meta.env.VITE_API_URL ||
      `${window.location.protocol}//${window.location.hostname}:5000/api`;
    return apiBase.replace(/\/api\/?$/, "");
  }, []);

  const createPeerConnection = (targetPeerId, targetUser) => {
    if (peersRef.current.has(targetPeerId)) {
      return peersRef.current.get(targetPeerId).peerConnection;
    }

    const peerConnection = new RTCPeerConnection(rtcConfig);

    localStreamRef.current?.getTracks().forEach((track) => {
      peerConnection.addTrack(track, localStreamRef.current);
    });

    peerConnection.onicecandidate = (event) => {
      if (event.candidate) {
        socketRef.current?.emit("signal-ice-candidate", {
          targetPeerId,
          candidate: event.candidate,
        });
      }
    };

    peerConnection.ontrack = (event) => {
      const [stream] = event.streams;
      if (!stream) return;

      setRemoteStreams((previous) => {
        const exists = previous.some((item) => item.peerId === targetPeerId);
        if (exists) {
          return previous.map((item) =>
            item.peerId === targetPeerId ? { ...item, stream } : item
          );
        }
        return [
          ...previous,
          {
            peerId: targetPeerId,
            stream,
            userName: targetUser?.name || "Participant",
          },
        ];
      });
    };

    peersRef.current.set(targetPeerId, {
      peerConnection,
      userName: targetUser?.name || "Participant",
    });

    return peerConnection;
  };

  const cleanupPeer = (peerId) => {
    const peer = peersRef.current.get(peerId);
    if (peer) {
      peer.peerConnection.close();
      peersRef.current.delete(peerId);
    }
    setRemoteStreams((previous) => previous.filter((item) => item.peerId !== peerId));
  };

  const replaceOutgoingVideoTrack = (newVideoTrack) => {
    peersRef.current.forEach(({ peerConnection }) => {
      const sender = peerConnection
        .getSenders()
        .find((item) => item.track && item.track.kind === "video");
      if (sender) sender.replaceTrack(newVideoTrack);
    });
  };

  const startRecording = async () => {
    try {
      const displayStream = await navigator.mediaDevices.getDisplayMedia({
        video: true,
        audio: true,
      });

      const recordingStartedAt = new Date();
      recordedChunksRef.current = [];
      const mediaRecorder = new MediaRecorder(displayStream, {
        mimeType: "video/webm",
      });

      recorderRef.current = mediaRecorder;
      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          recordedChunksRef.current.push(event.data);
        }
      };

      mediaRecorder.onstop = async () => {
        const blob = new Blob(recordedChunksRef.current, { type: "video/webm" });
        const url = URL.createObjectURL(blob);
        const anchor = document.createElement("a");
        const fileName = `meeting-${roomId}-${Date.now()}.webm`;
        anchor.href = url;
        anchor.download = fileName;
        document.body.appendChild(anchor);
        anchor.click();
        anchor.remove();
        URL.revokeObjectURL(url);
        displayStream.getTracks().forEach((track) => track.stop());
        const recordingEndedAt = new Date();
        const durationSec = Math.max(
          1,
          Math.floor((recordingEndedAt.getTime() - recordingStartedAt.getTime()) / 1000)
        );
        try {
          await saveRecordingMetadata(roomId, {
            fileName,
            durationSec,
            sizeBytes: blob.size,
            startedAt: recordingStartedAt.toISOString(),
            endedAt: recordingEndedAt.toISOString(),
          });
        } catch {
          setError("Recording downloaded, but metadata save failed.");
        }
      };

      mediaRecorder.start();
      setRecording(true);
    } catch {
      setError("Recording was blocked or cancelled.");
    }
  };

  const stopRecording = () => {
    recorderRef.current?.stop();
    setRecording(false);
  };

  const handleScreenShare = async () => {
    try {
      const screenStream = await navigator.mediaDevices.getDisplayMedia({
        video: true,
      });
      const screenTrack = screenStream.getVideoTracks()[0];

      if (!screenTrack) return;

      replaceOutgoingVideoTrack(screenTrack);
      if (localVideoRef.current) {
        localVideoRef.current.srcObject = screenStream;
      }
      setSharingScreen(true);

      screenTrack.onended = () => {
        const cameraTrack = cameraStreamRef.current?.getVideoTracks()[0];
        if (cameraTrack) {
          replaceOutgoingVideoTrack(cameraTrack);
          if (localVideoRef.current) {
            localVideoRef.current.srcObject = cameraStreamRef.current;
          }
        }
        setSharingScreen(false);
      };
    } catch {
      setError("Screen share was blocked or cancelled.");
    }
  };

  const sendChatMessage = (event) => {
    event.preventDefault();
    const text = chatInput.trim();
    if (!text) return;

    const message = {
      id: crypto.randomUUID(),
      text,
      sender: user?.name || user?.email || "User",
      createdAt: new Date().toISOString(),
    };

    socketRef.current?.emit("chat-message", { roomId, message });
    setChatInput("");
  };

  const sendReaction = (emoji) => {
    const reaction = {
      id: crypto.randomUUID(),
      emoji,
      sender: user?.name || user?.email || "User",
    };
    socketRef.current?.emit("reaction", { roomId, reaction });
  };

  const toggleAudio = () => {
    const track = localStreamRef.current?.getAudioTracks()[0];
    if (!track) return;
    const next = !track.enabled;
    track.enabled = next;
    setAudioEnabled(next);
    socketRef.current?.emit("participant-media-updated", {
      roomId,
      updates: { audioEnabled: next },
    });
  };

  const toggleVideo = () => {
    const track = localStreamRef.current?.getVideoTracks()[0];
    if (!track) return;
    const next = !track.enabled;
    track.enabled = next;
    setVideoEnabled(next);
    socketRef.current?.emit("participant-media-updated", {
      roomId,
      updates: { videoEnabled: next },
    });
  };

  const isHost = participants.find((item) => item.peerId === socketId)?.isHost;

  const handleHostAction = (targetPeerId, action) => {
    socketRef.current?.emit("host-action", { roomId, targetPeerId, action });
  };

  const handleEndMeeting = async () => {
    try {
      await endMeetingSession(roomId);
      navigate("/meet");
    } catch {
      setError("Failed to end meeting session.");
    }
  };

  const handleLogout = () => {
    socketRef.current?.emit("leave-room", { roomId });
    logout();
    navigate("/login");
  };

  const requestMediaPermissions = async () => {
    setRequestingPermissions(true);
    setPermissionMessage("");
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: true,
        audio: true,
      });
      localStreamRef.current = stream;
      cameraStreamRef.current = stream;
      if (localVideoRef.current) {
        localVideoRef.current.srcObject = stream;
      }
      setAudioEnabled(stream.getAudioTracks()[0]?.enabled ?? true);
      setVideoEnabled(stream.getVideoTracks()[0]?.enabled ?? true);
      setMediaPermissionGranted(true);
    } catch {
      setPermissionMessage(
        "Camera/microphone access denied. Please allow permissions in browser settings and try again."
      );
      setMediaPermissionGranted(false);
    } finally {
      setRequestingPermissions(false);
    }
  };

  useEffect(() => {
    if (!user) {
      navigate("/login");
      return;
    }

    const bootstrap = async () => {
      try {
        if (!mediaPermissionGranted || !localStreamRef.current) return;

        const socket = io(socketServerUrl, {
          transports: ["websocket"],
        });
        socketRef.current = socket;

        socket.on("connect", () => {
          setSocketId(socket.id);
          socket.emit("join-room", {
            roomId,
            user: {
              userId: user?._id || user?.id || "",
              name: user?.name || "User",
              email: user?.email || "",
            },
          });
        });

        startMeetingSession(roomId)
          .then((response) => {
            setMeetingStartedAt(response.data.meeting?.startedAt || null);
          })
          .catch(() => {});

        socket.on("existing-participants", async (participants) => {
          for (const participant of participants) {
            const peerConnection = createPeerConnection(participant.peerId, participant.user);
            const offer = await peerConnection.createOffer();
            await peerConnection.setLocalDescription(offer);
            socket.emit("signal-offer", {
              targetPeerId: participant.peerId,
              roomId,
              offer: peerConnection.localDescription,
              sender: { name: user?.name || "User", email: user?.email || "" },
            });
          }
        });

        socket.on("signal-offer", async ({ fromPeerId, offer, sender }) => {
          const peerConnection = createPeerConnection(fromPeerId, sender);
          await peerConnection.setRemoteDescription(new RTCSessionDescription(offer));
          const answer = await peerConnection.createAnswer();
          await peerConnection.setLocalDescription(answer);
          socket.emit("signal-answer", {
            targetPeerId: fromPeerId,
            answer: peerConnection.localDescription,
          });
        });

        socket.on("signal-answer", async ({ fromPeerId, answer }) => {
          const peer = peersRef.current.get(fromPeerId);
          if (!peer) return;
          await peer.peerConnection.setRemoteDescription(
            new RTCSessionDescription(answer)
          );
        });

        socket.on("signal-ice-candidate", async ({ fromPeerId, candidate }) => {
          const peer = peersRef.current.get(fromPeerId);
          if (!peer || !candidate) return;
          await peer.peerConnection.addIceCandidate(new RTCIceCandidate(candidate));
        });

        socket.on("user-left", ({ peerId }) => {
          cleanupPeer(peerId);
        });

        socket.on("participant-list-updated", ({ participants: list }) => {
          setParticipants(list || []);
        });

        socket.on("host-action", ({ action, by }) => {
          if (action === "mute-audio") {
            const track = localStreamRef.current?.getAudioTracks()[0];
            if (track) {
              track.enabled = false;
              setAudioEnabled(false);
            }
            setError(`Muted by host ${by}`);
          }
          if (action === "mute-video") {
            const track = localStreamRef.current?.getVideoTracks()[0];
            if (track) {
              track.enabled = false;
              setVideoEnabled(false);
            }
            setError(`Camera turned off by host ${by}`);
          }
        });

        socket.on("removed-by-host", () => {
          navigate("/meet");
        });
        socket.on("disconnect", () => setSocketId(""));

        socket.on("chat-message", (message) => {
          addChatMessage(message);
        });

        socket.on("reaction", (reaction) => {
          addReaction(reaction);
        });
      } catch {
        setError("Camera/microphone permission is required.");
      }
    };

    if (!mediaPermissionGranted) {
      requestMediaPermissions();
    }

    bootstrap();

    const peers = peersRef.current;

    return () => {
      socketRef.current?.emit("leave-room", { roomId });
      socketRef.current?.disconnect();
      peers.forEach(({ peerConnection }) => peerConnection.close());
      peers.clear();
      localStreamRef.current?.getTracks().forEach((track) => track.stop());
      cameraStreamRef.current?.getTracks().forEach((track) => track.stop());
      clearMeetingState();
    };
  }, [
    roomId,
    user,
    navigate,
    socketServerUrl,
    addChatMessage,
    addReaction,
    clearMeetingState,
    mediaPermissionGranted,
  ]);

  useEffect(() => {
    if (reactions.length === 0) return;
    const latestReaction = reactions[reactions.length - 1];
    const timeout = setTimeout(() => {
      removeReaction(latestReaction.id);
    }, 2500);
    return () => clearTimeout(timeout);
  }, [reactions, removeReaction]);

  return (
    <div className="min-h-screen bg-slate-950 px-3 py-4 text-white">
      <div className="mx-auto max-w-7xl">
        {!mediaPermissionGranted ? (
          <div className="mb-4 rounded-xl border border-slate-800 bg-slate-900 p-4">
            <h2 className="text-lg font-semibold">Enable Camera & Microphone</h2>
            <p className="mt-1 text-sm text-slate-300">
              To join the meeting on laptop or phone, allow browser access to camera and microphone.
            </p>
            {permissionMessage ? (
              <p className="mt-2 text-sm text-rose-400">{permissionMessage}</p>
            ) : null}
            <button
              type="button"
              onClick={requestMediaPermissions}
              disabled={requestingPermissions}
              className="mt-3 rounded bg-indigo-500 px-3 py-2 text-sm font-medium hover:bg-indigo-400 disabled:cursor-not-allowed disabled:bg-indigo-700"
            >
              {requestingPermissions ? "Requesting..." : "Allow Camera & Microphone"}
            </button>
          </div>
        ) : null}

        <div className="mb-3 flex flex-wrap items-center gap-2">
          <Link to="/meet" className="rounded bg-slate-800 px-3 py-1 text-sm hover:bg-slate-700">
            Back to lobby
          </Link>
          <button
            type="button"
            onClick={handleLogout}
            className="rounded bg-rose-500 px-3 py-1 text-sm font-medium hover:bg-rose-400"
          >
            Logout
          </button>
          <span className="rounded bg-slate-800 px-3 py-1 text-sm">
            Meeting ID: <span className="font-mono">{roomId}</span>
          </span>
          <button
            type="button"
            onClick={toggleAudio}
            disabled={!mediaPermissionGranted}
            className="rounded bg-amber-500 px-3 py-1 text-sm font-medium hover:bg-amber-400"
          >
            {audioEnabled ? "Mute" : "Unmute"}
          </button>
          <button
            type="button"
            onClick={toggleVideo}
            disabled={!mediaPermissionGranted}
            className="rounded bg-cyan-500 px-3 py-1 text-sm font-medium hover:bg-cyan-400"
          >
            {videoEnabled ? "Camera Off" : "Camera On"}
          </button>
          <button
            type="button"
            onClick={handleScreenShare}
            className="rounded bg-indigo-500 px-3 py-1 text-sm font-medium hover:bg-indigo-400"
          >
            {sharingScreen ? "Sharing Screen" : "Share Screen"}
          </button>
          <button
            type="button"
            onClick={recording ? stopRecording : startRecording}
            className="rounded bg-emerald-500 px-3 py-1 text-sm font-medium hover:bg-emerald-400"
          >
            {recording ? "Stop & Download Recording" : "Record Meeting"}
          </button>
          {isHost ? (
            <button
              type="button"
              onClick={handleEndMeeting}
              className="rounded bg-rose-500 px-3 py-1 text-sm font-medium hover:bg-rose-400"
            >
              End Meeting
            </button>
          ) : null}
          {["👍", "🔥", "😂", "👏", "❤️"].map((emoji) => (
            <button
              key={emoji}
              type="button"
              onClick={() => sendReaction(emoji)}
              className="rounded bg-slate-800 px-2 py-1 text-lg hover:bg-slate-700"
            >
              {emoji}
            </button>
          ))}
        </div>

        {error ? (
          <p className="mb-3 rounded border border-rose-700 bg-rose-950/50 px-3 py-2 text-sm text-rose-300">
            {error}
          </p>
        ) : null}
        {meetingStartedAt ? (
          <p className="mb-3 text-xs text-slate-400">
            Session started: {new Date(meetingStartedAt).toLocaleString()}
          </p>
        ) : null}

        <div className="grid gap-4 lg:grid-cols-4">
          <div className="lg:col-span-3">
            <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
              <VideoTile title="You" subtitle={user?.name} videoRef={localVideoRef} muted />
              {remoteStreams.map((participant) => (
                <RemoteVideo
                  key={participant.peerId}
                  peerId={participant.peerId}
                  userName={participant.userName}
                  stream={participant.stream}
                />
              ))}
            </div>
          </div>

          <div className="rounded-xl border border-slate-800 bg-slate-900 p-3">
            <h2 className="mb-2 text-lg font-medium">Participants</h2>
            <div className="mb-3 max-h-44 space-y-2 overflow-auto rounded border border-slate-800 p-2">
              {participants.map((participant) => (
                <div
                  key={participant.peerId}
                  className="rounded bg-slate-800 p-2 text-xs text-slate-200"
                >
                  <div className="flex items-center justify-between">
                    <p className="font-medium">
                      {participant.name} {participant.isHost ? "(Host)" : ""}
                    </p>
                    <span>
                      A:{participant.audioEnabled ? "on" : "off"} V:
                      {participant.videoEnabled ? "on" : "off"}
                    </span>
                  </div>
                  {isHost && participant.peerId !== socketId ? (
                    <div className="mt-2 flex gap-1">
                      <button
                        type="button"
                        onClick={() => handleHostAction(participant.peerId, "mute-audio")}
                        className="rounded bg-amber-600 px-2 py-1"
                      >
                        Mute
                      </button>
                      <button
                        type="button"
                        onClick={() => handleHostAction(participant.peerId, "mute-video")}
                        className="rounded bg-cyan-600 px-2 py-1"
                      >
                        Cam Off
                      </button>
                      <button
                        type="button"
                        onClick={() => handleHostAction(participant.peerId, "remove")}
                        className="rounded bg-rose-600 px-2 py-1"
                      >
                        Remove
                      </button>
                    </div>
                  ) : null}
                </div>
              ))}
            </div>
            <h2 className="mb-2 text-lg font-medium">Live Chat</h2>
            <div className="h-[420px] overflow-auto rounded border border-slate-800 p-2">
              {chatMessages.length === 0 ? (
                <p className="text-sm text-slate-400">No messages yet.</p>
              ) : (
                <div className="space-y-2">
                  {chatMessages.map((message) => (
                    <div key={message.id} className="rounded bg-slate-800 p-2 text-sm">
                      <p className="font-medium text-indigo-300">{message.sender}</p>
                      <p>{message.text}</p>
                    </div>
                  ))}
                </div>
              )}
            </div>
            <form onSubmit={sendChatMessage} className="mt-2 flex gap-2">
              <input
                value={chatInput}
                onChange={(event) => setChatInput(event.target.value)}
                placeholder="Type a message..."
                className="flex-1 rounded border border-slate-700 bg-slate-800 px-3 py-2 text-sm outline-none ring-indigo-500 focus:ring"
              />
              <button
                type="submit"
                className="rounded bg-indigo-500 px-3 py-2 text-sm font-medium hover:bg-indigo-400"
              >
                Send
              </button>
            </form>
            <button
              type="button"
              onClick={clearChat}
              className="mt-2 text-xs text-slate-400 hover:text-slate-200"
            >
              Clear chat
            </button>
          </div>
        </div>
      </div>

      <div className="pointer-events-none fixed inset-0 overflow-hidden">
        {reactions.map((reaction, index) => (
          <div
            key={reaction.id}
            className="absolute animate-pulse text-4xl"
            style={{
              left: `${10 + (index % 6) * 14}%`,
              bottom: `${10 + (index % 4) * 12}%`,
            }}
          >
            <span role="img" aria-label="reaction">
              {reaction.emoji}
            </span>
            <p className="mt-1 text-xs text-white">{reaction.sender}</p>
          </div>
        ))}
      </div>
    </div>
  );
};

const RemoteVideo = ({ peerId, userName, stream }) => {
  const videoRef = useRef(null);

  useEffect(() => {
    if (videoRef.current) {
      videoRef.current.srcObject = stream;
    }
  }, [stream]);

  return <VideoTile title={userName || "Participant"} subtitle={peerId} videoRef={videoRef} />;
};

export default MeetingRoomPage;
