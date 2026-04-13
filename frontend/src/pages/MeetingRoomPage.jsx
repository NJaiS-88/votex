import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { io } from "socket.io-client";
import { useAuthStore } from "../store/useAuthStore";
import { useMeetingStore } from "../store/useMeetingStore";
import VideoTile from "../components/VideoTile";
import {
  endMeetingSession,
  getMeetingById,
  saveRecordingMetadata,
  startMeetingSession,
  updateMeetingSettings,
} from "../api/meetingApi";

const rtcConfig = {
  iceServers: [{ urls: "stun:stun.l.google.com:19302" }],
};

const REACTIONS = [
  "👍",
  "👎",
  "👏",
  "🙌",
  "🔥",
  "💯",
  "❤️",
  "💙",
  "💚",
  "💛",
  "💜",
  "🖤",
  "🤍",
  "🤎",
  "🎉",
  "🥳",
  "😂",
  "🤣",
  "😅",
  "😊",
  "😍",
  "🤩",
  "😮",
  "😲",
  "😢",
  "😭",
  "😡",
  "🤯",
  "😎",
  "🤔",
  "🤝",
  "🙏",
  "👌",
  "✅",
  "❌",
  "⚡",
  "🌟",
  "✨",
  "💡",
  "🎯",
  "💬",
  "📌",
  "🚀",
  "🎵",
  "🎬",
  "🧠",
  "🤗",
  "🫶",
  "🥰",
  "😴",
  "🍀",
  "🌈",
  "☕",
  "🍕",
  "🍿",
];

const MeetingRoomPage = () => {
  const { roomId } = useParams();
  const navigate = useNavigate();
  const user = useAuthStore((state) => state.user);
  const updateProfile = useAuthStore((state) => state.updateProfile);
  const theme = useAuthStore((state) => state.theme);
  const setTheme = useAuthStore((state) => state.setTheme);
  const localVideoRef = useRef(null);
  const socketRef = useRef(null);
  const localStreamRef = useRef(null);
  const cameraStreamRef = useRef(null);
  const audioEnabledRef = useRef(true);
  const videoEnabledRef = useRef(true);
  const desiredAudioEnabledRef = useRef(true);
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
  const [allowAllParticipants, setAllowAllParticipants] = useState(false);
  const [error, setError] = useState("");
  const [joinedCall, setJoinedCall] = useState(false);
  const [displayName, setDisplayName] = useState(user?.name || "");
  const [avatarUrl, setAvatarUrl] = useState(user?.avatarUrl || "");
  const [manualPinnedPeerId, setManualPinnedPeerId] = useState("");
  const [forcedPinnedPeerId, setForcedPinnedPeerId] = useState("");
  const [hostPinnedPeerId, setHostPinnedPeerId] = useState("");
  const [sharingPeerIds, setSharingPeerIds] = useState([]);
  const [tilePage, setTilePage] = useState(0);
  const [participantSearch, setParticipantSearch] = useState("");
  const [previousParticipants, setPreviousParticipants] = useState([]);
  const [permissionChecked, setPermissionChecked] = useState(false);
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const [showDiagnostics, setShowDiagnostics] = useState(false);
  const [showParticipantsPanel, setShowParticipantsPanel] = useState(false);
  const [showChatPanel, setShowChatPanel] = useState(false);
  const [showHamburgerMenu, setShowHamburgerMenu] = useState(false);
  const [isMobileViewport, setIsMobileViewport] = useState(false);
  const [showMobileDock, setShowMobileDock] = useState(false);
  const mobileDockTimerRef = useRef(null);
  const desktopDockTimerRef = useRef(null);
  const lastMicTouchAtRef = useRef(0);
  const emojiPickerRef = useRef(null);
  const hamburgerMenuRef = useRef(null);
  const participantsPanelRef = useRef(null);
  const chatPanelRef = useRef(null);
  const diagnosticsPanelRef = useRef(null);
  const tilesContainerRef = useRef(null);
  const tileWheelCooldownRef = useRef(0);
  const [expandedCodeMessages, setExpandedCodeMessages] = useState({});
  const [waitingParticipants, setWaitingParticipants] = useState([]);
  const [joinApprovalStatus, setJoinApprovalStatus] = useState("approved");

  const { chatMessages, reactions } = useMeetingStore();
  const addChatMessage = useMeetingStore((state) => state.addChatMessage);
  const setChatMessages = useMeetingStore((state) => state.setChatMessages);
  const clearChat = useMeetingStore((state) => state.clearChat);
  const addReaction = useMeetingStore((state) => state.addReaction);
  const pruneOldReactions = useMeetingStore((state) => state.pruneOldReactions);
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

  const replaceOutgoingAudioTrack = useCallback((newAudioTrack) => {
    peersRef.current.forEach(({ peerConnection }) => {
      const audioSenders = peerConnection
        .getSenders()
        .filter((item) => item.track && item.track.kind === "audio");

      if (audioSenders.length === 0 && newAudioTrack && localStreamRef.current) {
        peerConnection.addTrack(newAudioTrack, localStreamRef.current);
        return;
      }

      audioSenders.forEach((sender, index) => {
        if (index === 0) {
          sender.replaceTrack(newAudioTrack || null).catch(() => {});
          return;
        }
        try {
          peerConnection.removeTrack(sender);
        } catch {
          // Ignore remove errors; keep first audio sender as source of truth.
        }
      });
    });
  }, []);

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

  const sendChatMessage = (event) => {
    event.preventDefault();
    const text = chatInput.trim();
    if (!text) return;
    if (!socketRef.current?.connected) {
      setError("Chat is not connected yet. Please wait for meeting connection.");
      return;
    }

    const message = {
      id: crypto.randomUUID(),
      text,
      type: "text",
      code: "",
      language: "",
      attachments: [],
      senderId: user?._id || user?.id || "",
      sender: user?.name || user?.email || "User",
      senderAvatarUrl: user?.avatarUrl || "",
      createdAt: new Date().toISOString(),
    };

    socketRef.current?.emit("chat-message", { roomId, message });
    setChatInput("");
    setShowChatPanel(false);
  };

  const sendReaction = (emoji) => {
    const reaction = {
      id: crypto.randomUUID(),
      emoji,
      createdAt: new Date().toISOString(),
      senderId: user?._id || user?.id || "",
      sender: user?.name || user?.email || "User",
    };
    socketRef.current?.emit("reaction", { roomId, reaction });
  };

  const emitAudioPresence = useCallback(
    (next) => {
      socketRef.current?.emit("participant-media-updated", {
        roomId,
        updates: { audioEnabled: next },
      });
    },
    [roomId]
  );

  const toggleAudio = async () => {
    let track = localStreamRef.current?.getAudioTracks()[0];
    if (!track || track.readyState === "ended") {
      const recovered = await ensureLiveMicrophoneTrack();
      if (!recovered) {
        setError("Microphone is unavailable. Please allow mic permission and retry.");
        return;
      }
      track = localStreamRef.current?.getAudioTracks()[0];
      if (!track) return;
      const nextAfterRecovery = !audioEnabledRef.current;
      desiredAudioEnabledRef.current = nextAfterRecovery;
      track.enabled = nextAfterRecovery;
      audioEnabledRef.current = nextAfterRecovery;
      setAudioEnabled(nextAfterRecovery);
      emitAudioPresence(nextAfterRecovery);
      return;
    }
    const next = !track.enabled;
    desiredAudioEnabledRef.current = next;
    track.enabled = next;
    audioEnabledRef.current = next;
    setAudioEnabled(next);
    emitAudioPresence(next);
  };

  const toggleVideo = () => {
    const track = localStreamRef.current?.getVideoTracks()[0];
    if (!track) return;
    const next = !track.enabled;
    track.enabled = next;
    videoEnabledRef.current = next;
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

  const handleHostPinForAll = (targetPeerId = "") => {
    socketRef.current?.emit("host-set-pin-all", {
      roomId,
      targetPeerId: targetPeerId || "",
    });
  };

  const handleHostAdmitParticipant = (targetPeerId) => {
    socketRef.current?.emit("host-admit-participant", { roomId, targetPeerId });
  };

  const handleHostRejectParticipant = (targetPeerId) => {
    socketRef.current?.emit("host-reject-participant", { roomId, targetPeerId });
  };

  const handleEndMeeting = async () => {
    try {
      await endMeetingSession(roomId);
      navigate("/meet");
    } catch {
      setError("Failed to end meeting session.");
    }
  };

  const handleLeaveMeeting = () => {
    socketRef.current?.emit("leave-room", { roomId });
    socketRef.current?.disconnect();
    navigate("/meet");
  };

  const hasSecureMediaContext = () => {
    const host = window.location.hostname;
    const isLocalHost = host === "localhost" || host === "127.0.0.1";
    return window.isSecureContext || isLocalHost;
  };

  const getPermissionDenialHint = async () => {
    try {
      if (!navigator.permissions?.query) return "";
      const checks = await Promise.allSettled([
        navigator.permissions.query({ name: "camera" }),
        navigator.permissions.query({ name: "microphone" }),
      ]);
      const cameraDenied = checks[0]?.status === "fulfilled" && checks[0].value.state === "denied";
      const micDenied = checks[1]?.status === "fulfilled" && checks[1].value.state === "denied";
      if (cameraDenied || micDenied) {
        return "Camera/microphone is blocked in browser settings. On mobile, open site settings and Allow Camera + Microphone, then reload.";
      }
      return "";
    } catch {
      return "";
    }
  };

  const stopExistingLocalStreams = () => {
    localStreamRef.current?.getTracks().forEach((track) => track.stop());
    cameraStreamRef.current?.getTracks().forEach((track) => track.stop());
  };

  const requestMediaPermissions = async () => {
    setRequestingPermissions(true);
    setPermissionMessage("");
    setPermissionChecked(true);
    try {
      if (!hasSecureMediaContext()) {
        setMediaPermissionGranted(false);
        setPermissionMessage(
          "Camera/microphone needs HTTPS on mobile. Open this app over https:// (or localhost) and try again."
        );
        return false;
      }
      if (!navigator.mediaDevices?.getUserMedia) {
        setMediaPermissionGranted(false);
        setPermissionMessage("This browser does not support camera/microphone access.");
        return false;
      }

      const denialHint = await getPermissionDenialHint();
      if (denialHint) {
        setMediaPermissionGranted(false);
        setPermissionMessage(denialHint);
        return false;
      }

      const preferenceConstraints = [
        {
          audio: {
            echoCancellation: true,
            noiseSuppression: true,
            autoGainControl: true,
          },
          video: {
            facingMode: "user",
            width: { ideal: 1280 },
            height: { ideal: 720 },
          },
        },
        { audio: true, video: { facingMode: "user" } },
        { audio: true, video: true },
        { audio: true, video: false },
        { audio: false, video: true },
      ];

      let stream = null;
      let lastError = null;
      for (const constraints of preferenceConstraints) {
        try {
          // Try progressive fallbacks for mobile browser compatibility.
          stream = await navigator.mediaDevices.getUserMedia(constraints);
          if (stream) break;
        } catch (error) {
          lastError = error;
        }
      }

      if (!stream) {
        const errorName = lastError?.name || "";
        const guidance =
          errorName === "NotAllowedError"
            ? "Permission denied. Please allow camera/microphone in browser settings."
            : errorName === "NotFoundError"
            ? "No camera/microphone found on this device."
            : "Could not access camera/microphone. Try closing other apps using camera and retry.";
        setMediaPermissionGranted(false);
        setPermissionMessage(guidance);
        return false;
      }

      stopExistingLocalStreams();
      localStreamRef.current = stream;
      cameraStreamRef.current = stream;
      if (localVideoRef.current) {
        localVideoRef.current.srcObject = stream;
        localVideoRef.current.play().catch(() => {});
      }

      const hasAudioTrack = stream.getAudioTracks().length > 0;
      const hasVideoTrack = stream.getVideoTracks().length > 0;
      desiredAudioEnabledRef.current = hasAudioTrack;
      audioEnabledRef.current = hasAudioTrack;
      videoEnabledRef.current = hasVideoTrack;
      setAudioEnabled(hasAudioTrack);
      setVideoEnabled(hasVideoTrack);
      setMediaPermissionGranted(hasAudioTrack || hasVideoTrack);
      if (!hasAudioTrack || !hasVideoTrack) {
        setPermissionMessage(
          `Joined with limited media: ${hasAudioTrack ? "mic" : "no mic"} / ${
            hasVideoTrack ? "camera" : "no camera"
          }.`
        );
      }
      return hasAudioTrack || hasVideoTrack;
    } catch {
      setMediaPermissionGranted(false);
      setPermissionMessage(
        "Camera/microphone access failed. On mobile, allow permissions in browser site settings and try again."
      );
      return false;
    } finally {
      setRequestingPermissions(false);
    }
  };

  const ensureLiveMicrophoneTrack = useCallback(async () => {
    if (!desiredAudioEnabledRef.current) {
      // Respect explicit user mute choice.
      return true;
    }
    const currentAudioTrack = localStreamRef.current?.getAudioTracks?.()[0];
    if (currentAudioTrack && currentAudioTrack.readyState === "live") {
      return true;
    }
    try {
      const audioOnlyStream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
        },
        video: false,
      });
      const recoveredTrack = audioOnlyStream.getAudioTracks?.()[0];
      if (!recoveredTrack) return false;

      if (!localStreamRef.current) {
        localStreamRef.current = new MediaStream();
      }
      const oldTrack = localStreamRef.current.getAudioTracks?.()[0];
      if (oldTrack) {
        localStreamRef.current.removeTrack(oldTrack);
        oldTrack.stop();
      }
      localStreamRef.current.addTrack(recoveredTrack);
      recoveredTrack.enabled = desiredAudioEnabledRef.current;
      audioEnabledRef.current = desiredAudioEnabledRef.current;
      setAudioEnabled(desiredAudioEnabledRef.current);
      setMediaPermissionGranted(true);
      replaceOutgoingAudioTrack(recoveredTrack);
      emitAudioPresence(desiredAudioEnabledRef.current);
      return true;
    } catch {
      return false;
    }
  }, [emitAudioPresence, replaceOutgoingAudioTrack]);

  useEffect(() => {
    if (!user) return;
    getMeetingById(roomId)
      .then((response) => {
        const meeting = response.data.meeting;
        setMeetingStartedAt(meeting?.startedAt || null);
        setAllowAllParticipants(Boolean(meeting?.meetingSettings?.allowAllParticipants));
        setChatMessages(
          (meeting?.chatMessages || []).map((message) => ({
            ...message,
            id: message.id || crypto.randomUUID(),
          }))
        );
        const uniqueParticipants = Array.from(
          new Map(
            (meeting?.participantHistory || [])
              .filter((participant) => participant.name)
              .map((participant) => [participant.userId || participant.email, participant])
          ).values()
        );
        setPreviousParticipants(uniqueParticipants);
      })
      .catch(() => {});
  }, [roomId, user, setChatMessages]);

  useEffect(() => {
    if (!user) {
      navigate("/login");
      return;
    }
    if (!mediaPermissionGranted || !localStreamRef.current || !joinedCall) {
      return;
    }

    const bootstrap = async () => {
      try {
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
              name: displayName || user?.name || "User",
              email: user?.email || "",
              avatarUrl,
              audioEnabled: audioEnabledRef.current,
              videoEnabled: videoEnabledRef.current,
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

        socket.on(
          "room-pin-updated",
          ({ forcedPinnedPeerId: forcedPeerId, sharingPeerIds, hostPinnedPeerId: hostPinnedId }) => {
          setForcedPinnedPeerId(forcedPeerId || "");
          setHostPinnedPeerId(hostPinnedId || "");
          setSharingPeerIds(sharingPeerIds || []);
          }
        );

        socket.on("host-unavailable", ({ message }) => {
          setError(message || "You will be let in when admin joins.");
          setJoinApprovalStatus("waiting");
        });

        socket.on("join-waiting-approval", ({ message }) => {
          setError(message || "Waiting for host to admit you.");
          setJoinApprovalStatus("waiting");
        });

        socket.on("admission-approved", ({ message }) => {
          setError(message || "");
          setJoinApprovalStatus("approved");
        });

        socket.on("admission-denied", ({ message }) => {
          setJoinApprovalStatus("denied");
          setError(message || "Host did not admit your request.");
        });

        socket.on("waiting-participants-updated", ({ waiting }) => {
          setWaitingParticipants(waiting || []);
        });

        socket.on("host-action", ({ action, by }) => {
          if (action === "mute-audio") {
            const track = localStreamRef.current?.getAudioTracks()[0];
            if (track) {
              track.enabled = false;
              desiredAudioEnabledRef.current = false;
              audioEnabledRef.current = false;
              setAudioEnabled(false);
            }
            setError(`Muted by host ${by}`);
          }
          if (action === "unmute-audio") {
            const track = localStreamRef.current?.getAudioTracks()[0];
            if (track) {
              track.enabled = true;
              desiredAudioEnabledRef.current = true;
              audioEnabledRef.current = true;
              setAudioEnabled(true);
            }
            setError(`Unmuted by host ${by}`);
          }
          if (action === "mute-video") {
            const track = localStreamRef.current?.getVideoTracks()[0];
            if (track) {
              track.enabled = false;
              videoEnabledRef.current = false;
              setVideoEnabled(false);
            }
            setError(`Camera turned off by host ${by}`);
          }
          if (action === "unmute-video") {
            const track = localStreamRef.current?.getVideoTracks()[0];
            if (track) {
              track.enabled = true;
              videoEnabledRef.current = true;
              setVideoEnabled(true);
            }
            setError(`Camera enabled by host ${by}`);
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

    bootstrap();

    const peers = peersRef.current;

    return () => {
      socketRef.current?.emit("leave-room", { roomId });
      socketRef.current?.disconnect();
      peers.forEach(({ peerConnection }) => peerConnection.close());
      peers.clear();
    };
  }, [
    roomId,
    user,
    navigate,
    socketServerUrl,
    addChatMessage,
    addReaction,
    mediaPermissionGranted,
    joinedCall,
    displayName,
    avatarUrl,
    setChatMessages,
  ]);

  useEffect(
    () => () => {
      localStreamRef.current?.getTracks().forEach((track) => track.stop());
      cameraStreamRef.current?.getTracks().forEach((track) => track.stop());
      clearMeetingState();
    },
    [clearMeetingState]
  );

  useEffect(() => {
    const mediaQuery = window.matchMedia("(max-width: 768px)");
    const updateViewportMode = () => {
      const mobile = mediaQuery.matches;
      setIsMobileViewport(mobile);
      if (!mobile) {
        setShowMobileDock(true);
        if (mobileDockTimerRef.current) {
          clearTimeout(mobileDockTimerRef.current);
          mobileDockTimerRef.current = null;
        }
      } else {
        setShowMobileDock(true);
      }
    };
    updateViewportMode();
    mediaQuery.addEventListener("change", updateViewportMode);
    return () => {
      mediaQuery.removeEventListener("change", updateViewportMode);
      if (mobileDockTimerRef.current) {
        clearTimeout(mobileDockTimerRef.current);
      }
      if (desktopDockTimerRef.current) {
        clearTimeout(desktopDockTimerRef.current);
      }
    };
  }, []);

  useEffect(() => {
    const interval = setInterval(() => {
      pruneOldReactions(7000);
    }, 1000);
    return () => clearInterval(interval);
  }, [pruneOldReactions]);

  useEffect(() => {
    if (!joinedCall) return;
    const interval = setInterval(() => {
      const track = localStreamRef.current?.getAudioTracks?.()[0];
      if (!track || track.readyState === "ended") {
        ensureLiveMicrophoneTrack().then((ok) => {
          if (!ok) {
            setPermissionMessage(
              "Microphone disconnected. Please reopen browser site settings and allow microphone."
            );
          }
        });
      }
    }, 3000);
    return () => clearInterval(interval);
  }, [joinedCall, ensureLiveMicrophoneTrack]);

  const closeFloatingUi = useCallback(() => {
    setShowEmojiPicker(false);
    setShowHamburgerMenu(false);
    setShowParticipantsPanel(false);
    setShowChatPanel(false);
    setShowDiagnostics(false);
  }, []);

  useEffect(() => {
    const handleOutside = (event) => {
      const target = event.target;
      const insidePopup =
        emojiPickerRef.current?.contains(target) ||
        hamburgerMenuRef.current?.contains(target) ||
        participantsPanelRef.current?.contains(target) ||
        chatPanelRef.current?.contains(target) ||
        diagnosticsPanelRef.current?.contains(target);
      if (!insidePopup) {
        closeFloatingUi();
      }
    };
    document.addEventListener("mousedown", handleOutside);
    document.addEventListener("touchstart", handleOutside, { passive: true });
    return () => {
      document.removeEventListener("mousedown", handleOutside);
      document.removeEventListener("touchstart", handleOutside);
    };
  }, [closeFloatingUi]);

  const handleJoinNow = async () => {
    if (!displayName.trim()) {
      setError("Display name is required.");
      return;
    }
    setJoinApprovalStatus("approved");
    setError("");
    if (!mediaPermissionGranted) {
      const granted = await requestMediaPermissions();
      if (!granted) return;
    }
    const microphoneRecovered = await ensureLiveMicrophoneTrack();
    if (!microphoneRecovered) {
      setPermissionMessage(
        "Microphone is unavailable on this device/browser. Please allow microphone and try again."
      );
    }
    await updateProfile({ name: displayName.trim(), avatarUrl, theme });
    setJoinedCall(true);
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
      socketRef.current?.emit("participant-media-updated", {
        roomId,
        updates: { isScreenSharing: true },
      });

      screenTrack.onended = () => {
        const cameraTrack = cameraStreamRef.current?.getVideoTracks()[0];
        if (cameraTrack) {
          replaceOutgoingVideoTrack(cameraTrack);
          if (localVideoRef.current) {
            localVideoRef.current.srcObject = cameraStreamRef.current;
          }
        }
        setSharingScreen(false);
        socketRef.current?.emit("participant-media-updated", {
          roomId,
          updates: { isScreenSharing: false },
        });
      };
    } catch {
      setError("Screen share was blocked or cancelled.");
    }
  };

  const toggleAllowAllParticipants = async () => {
    try {
      const nextValue = !allowAllParticipants;
      await updateMeetingSettings(roomId, { allowAllParticipants: nextValue });
      setAllowAllParticipants(nextValue);
    } catch {
      setError("Could not update participant settings.");
    }
  };

  const effectivePinnedPeerId = forcedPinnedPeerId || manualPinnedPeerId;
  const localTile = {
    peerId: socketId || "local-preview",
    userName: "You",
    avatarUrl,
    stream: localStreamRef.current,
    subtitle: displayName || user?.name || "",
    videoEnabled,
    audioEnabled,
  };
  const remoteTiles = remoteStreams.map((participant) => {
    const participantMeta = participants.find((item) => item.peerId === participant.peerId);
    const streamAudioTrack = participant.stream?.getAudioTracks?.()[0];
    const streamVideoTrack = participant.stream?.getVideoTracks?.()[0];
    const resolvedAudioEnabled =
      participantMeta?.audioEnabled ??
      (streamAudioTrack ? streamAudioTrack.readyState === "live" : true);
    const resolvedVideoEnabled =
      (streamVideoTrack && streamVideoTrack.readyState === "live") ||
      participantMeta?.videoEnabled === true;
    return {
      ...participant,
      avatarUrl: participantMeta?.avatarUrl || "",
      subtitle: participant.peerId,
      videoEnabled: resolvedVideoEnabled,
      audioEnabled: resolvedAudioEnabled,
    };
  });
  const allTiles = [localTile, ...remoteTiles];
  const orderedTiles = effectivePinnedPeerId
    ? [
        ...allTiles.filter((tile) => tile.peerId === effectivePinnedPeerId),
        ...allTiles.filter((tile) => tile.peerId !== effectivePinnedPeerId),
      ]
    : allTiles;
  const pageSize = 9;
  const totalPages = Math.max(1, Math.ceil(orderedTiles.length / pageSize));
  const currentPage = Math.min(tilePage, totalPages - 1);
  const visibleTiles = orderedTiles.slice(
    currentPage * pageSize,
    currentPage * pageSize + pageSize
  );
  const gridColsClass =
    visibleTiles.length <= 1
      ? "grid-cols-1 lg:grid-cols-2"
      : visibleTiles.length <= 4
      ? "grid-cols-1 sm:grid-cols-2 lg:grid-cols-2"
      : visibleTiles.length <= 9
      ? "grid-cols-1 sm:grid-cols-2 lg:grid-cols-3"
      : "grid-cols-2 sm:grid-cols-3 lg:grid-cols-4";
  const searchedCurrentParticipants = participants.filter((participant) => {
    const keyword = participantSearch.trim().toLowerCase();
    if (!keyword) return true;
    return (
      (participant.name || "").toLowerCase().includes(keyword) ||
      (participant.email || "").toLowerCase().includes(keyword)
    );
  });
  const searchedPreviousParticipants = previousParticipants.filter((participant) => {
    const keyword = participantSearch.trim().toLowerCase();
    if (!keyword) return true;
    return (
      (participant.name || "").toLowerCase().includes(keyword) ||
      (participant.email || "").toLowerCase().includes(keyword)
    );
  });
  const localAudioTrack = localStreamRef.current?.getAudioTracks?.()[0] || null;
  const localVideoTrack = localStreamRef.current?.getVideoTracks?.()[0] || null;
  const localAudioReadyState = localAudioTrack?.readyState || "missing";
  const localVideoReadyState = localVideoTrack?.readyState || "missing";
  const remoteDiagnostics = remoteStreams.map((item) => {
    const audioTrack = item.stream?.getAudioTracks?.()[0] || null;
    const videoTrack = item.stream?.getVideoTracks?.()[0] || null;
    return {
      peerId: item.peerId,
      userName: item.userName || "Participant",
      hasAudioTrack: Boolean(audioTrack),
      hasVideoTrack: Boolean(videoTrack),
      audioState: audioTrack?.readyState || "missing",
      videoState: videoTrack?.readyState || "missing",
    };
  });

  useEffect(() => {
    const availablePeerIds = new Set([
      socketId || "local-preview",
      ...remoteStreams.map((item) => item.peerId),
    ]);
    if (manualPinnedPeerId && !availablePeerIds.has(manualPinnedPeerId)) {
      setManualPinnedPeerId("");
    }
    if (forcedPinnedPeerId && !availablePeerIds.has(forcedPinnedPeerId)) {
      setForcedPinnedPeerId("");
    }
  }, [manualPinnedPeerId, forcedPinnedPeerId, remoteStreams, socketId]);

  const revealControlsDock = useCallback(() => {
    if (!joinedCall) return;
    setShowMobileDock(true);
    if (mobileDockTimerRef.current) {
      clearTimeout(mobileDockTimerRef.current);
    }
    if (desktopDockTimerRef.current) {
      clearTimeout(desktopDockTimerRef.current);
    }
    const timer = setTimeout(() => {
      setShowMobileDock(false);
      mobileDockTimerRef.current = null;
      desktopDockTimerRef.current = null;
    }, 10000);
    if (isMobileViewport) {
      mobileDockTimerRef.current = timer;
    } else {
      desktopDockTimerRef.current = timer;
    }
  }, [isMobileViewport, joinedCall]);

  useEffect(() => {
    if (!joinedCall) return;
    revealControlsDock();
  }, [joinedCall, revealControlsDock]);

  const handleViewportMouseMove = (event) => {
    if (!joinedCall || isMobileViewport) return;
    if (event.clientY >= window.innerHeight - 120) {
      revealControlsDock();
    }
  };

  const handleTilesWheel = (event) => {
    if (totalPages <= 1) return;
    const now = Date.now();
    if (now - tileWheelCooldownRef.current < 300) return;
    if (Math.abs(event.deltaY) < 15) return;
    tileWheelCooldownRef.current = now;
    event.preventDefault();
    if (event.deltaY > 0) {
      setTilePage((page) => Math.min(totalPages - 1, page + 1));
    } else {
      setTilePage((page) => Math.max(0, page - 1));
    }
  };

  const handleMicButtonTouchEnd = (event) => {
    event.preventDefault();
    lastMicTouchAtRef.current = Date.now();
    toggleAudio();
  };

  const handleMicButtonClick = () => {
    if (Date.now() - lastMicTouchAtRef.current < 500) return;
    toggleAudio();
  };

  return (
    <div
      className={`min-h-screen overflow-x-hidden px-3 py-5 ${
        theme === "dark"
          ? "dark bg-linear-to-b from-slate-950 via-slate-900 to-slate-950 text-white"
          : "bg-linear-to-b from-slate-100 via-white to-slate-100 text-slate-900"
      }`}
      onTouchStart={revealControlsDock}
      onClick={revealControlsDock}
      onMouseMove={handleViewportMouseMove}
    >
      <div className="mx-auto max-w-[1400px]">
        {!joinedCall ? (
          <div className="ui-card mb-4 p-5">
            <h2 className="text-lg font-semibold">Ready to join?</h2>
            <p className="ui-subtitle mt-1">
              Configure your name, profile image and devices before entering the meeting room.
            </p>
            <div className="mt-3 grid gap-3 md:grid-cols-2">
              <input
                value={displayName}
                onChange={(event) => setDisplayName(event.target.value)}
                placeholder="Display name"
                className="ui-input"
              />
              <input
                value={avatarUrl}
                onChange={(event) => setAvatarUrl(event.target.value)}
                placeholder="Profile image URL (optional)"
                className="ui-input"
              />
            </div>
            {!mediaPermissionGranted ? (
              <button
                type="button"
                onClick={requestMediaPermissions}
                disabled={requestingPermissions}
                className="ui-btn-primary mt-3 disabled:cursor-not-allowed disabled:bg-indigo-700"
              >
                {requestingPermissions
                  ? "Requesting..."
                  : permissionChecked
                  ? "Retry Camera & Microphone"
                  : "Allow Camera & Microphone"}
              </button>
            ) : null}
            {permissionMessage ? <p className="mt-2 text-sm text-rose-400">{permissionMessage}</p> : null}
            <button
              type="button"
              onClick={handleJoinNow}
              className="ui-btn-success mt-3"
            >
              Join Meeting
            </button>
          </div>
        ) : null}

        {showEmojiPicker ? (
          <div
            ref={emojiPickerRef}
            className="fixed right-3 top-24 z-[100] w-[min(360px,95vw)] rounded-xl border border-slate-200 bg-white p-3 shadow-lg dark:border-slate-700 dark:bg-slate-900"
          >
            <div className="mb-2 flex items-center justify-between">
              <p className="text-sm font-medium">Send reaction</p>
              <button
                type="button"
                className="text-xs text-slate-500 hover:text-slate-700 dark:hover:text-slate-200"
                onClick={() => setShowEmojiPicker(false)}
              >
                Close
              </button>
            </div>
            <div className="grid max-h-52 grid-cols-8 gap-2 overflow-auto pr-1">
              {REACTIONS.map((emoji) => (
                <button
                  key={emoji}
                  type="button"
                  onClick={() => {
                    sendReaction(emoji);
                    setShowEmojiPicker(false);
                  }}
                  className="rounded-md border border-slate-200 bg-slate-50 px-2 py-1 text-base hover:bg-slate-100 dark:border-slate-700 dark:bg-slate-800 dark:hover:bg-slate-700"
                >
                  {emoji}
                </button>
              ))}
            </div>
          </div>
        ) : null}
        {showHamburgerMenu ? (
          <div
            ref={hamburgerMenuRef}
            className="fixed bottom-24 right-3 z-[95] w-[min(320px,92vw)] rounded-xl border border-slate-200 bg-white p-3 shadow-lg dark:border-slate-700 dark:bg-slate-900"
          >
            <p className="mb-2 text-sm font-medium">Meeting Menu</p>
            <div className="grid gap-2">
              <button
                type="button"
                onClick={() => {
                  setShowChatPanel((value) => !value);
                  setShowHamburgerMenu(false);
                }}
                className="ui-btn-ghost justify-start"
              >
                {showChatPanel ? "Hide Chat" : "Open Chat"}
              </button>
              <button
                type="button"
                onClick={() => {
                  setShowParticipantsPanel((value) => !value);
                  setShowHamburgerMenu(false);
                }}
                className="ui-btn-ghost justify-start"
              >
                {showParticipantsPanel ? "Hide Participants" : "Open Participants"}
              </button>
              <button
                type="button"
                onClick={() => {
                  setShowDiagnostics((value) => !value);
                  setShowHamburgerMenu(false);
                }}
                className="ui-btn-ghost justify-start"
              >
                {showDiagnostics ? "Hide AV Diagnostics" : "Show AV Diagnostics"}
              </button>
              <button
                type="button"
                onClick={() => {
                  if (recording) stopRecording();
                  else startRecording();
                  setShowHamburgerMenu(false);
                }}
                className="ui-btn-ghost justify-start"
              >
                {recording ? "Stop Recording" : "Start Recording"}
              </button>
              <button
                type="button"
                onClick={() => {
                  setShowHamburgerMenu(false);
                  handleLeaveMeeting();
                }}
                className="ui-btn-ghost justify-start"
              >
                Leave Meeting
              </button>
              <button
                type="button"
                onClick={() => {
                  setTheme(theme === "dark" ? "light" : "dark");
                  setShowHamburgerMenu(false);
                }}
                className="ui-btn-ghost justify-start"
              >
                Switch to {theme === "dark" ? "Light" : "Dark"} Theme
              </button>
              {isHost ? (
                <>
                  <button
                    type="button"
                    onClick={() => {
                      handleHostPinForAll("");
                      setShowHamburgerMenu(false);
                    }}
                    disabled={!hostPinnedPeerId}
                    className="ui-btn-ghost justify-start"
                  >
                    {hostPinnedPeerId ? "Clear Pin For All" : "No Global Pin Set"}
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      toggleAllowAllParticipants();
                      setShowHamburgerMenu(false);
                    }}
                    className="ui-btn-ghost justify-start"
                  >
                    {allowAllParticipants ? "Disable Public Join" : "Enable Public Join"}
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setShowHamburgerMenu(false);
                      handleEndMeeting();
                    }}
                    className="ui-btn-danger justify-start"
                  >
                    End Meeting for All
                  </button>
                </>
              ) : null}
              {sharingPeerIds.length > 1 ? (
                <select
                  value={manualPinnedPeerId}
                  onChange={(event) => {
                    setTilePage(0);
                    setManualPinnedPeerId(event.target.value);
                    setShowHamburgerMenu(false);
                  }}
                  className="rounded border border-slate-300 bg-white px-2 py-2 text-sm dark:border-slate-700 dark:bg-slate-800"
                >
                  <option value="">Choose pinned share</option>
                  {sharingPeerIds.map((peerId) => {
                    const participant = participants.find((item) => item.peerId === peerId);
                    const label = peerId === socketId ? "You" : participant?.name || peerId;
                    return (
                      <option key={peerId} value={peerId}>
                        {label}
                      </option>
                    );
                  })}
                </select>
              ) : null}
            </div>
          </div>
        ) : null}
        {showDiagnostics ? (
          <div ref={diagnosticsPanelRef} className="ui-card mb-3 p-3 text-xs">
            <h3 className="mb-2 text-sm font-semibold">Audio/Video Diagnostics</h3>
            <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
              <div className="rounded border border-slate-200 p-2 dark:border-slate-700">
                <p className="font-medium">Permissions</p>
                <p>Checked: {permissionChecked ? "yes" : "no"}</p>
                <p>Granted: {mediaPermissionGranted ? "yes" : "no"}</p>
                <p>Requesting: {requestingPermissions ? "yes" : "no"}</p>
              </div>
              <div className="rounded border border-slate-200 p-2 dark:border-slate-700">
                <p className="font-medium">Local Microphone</p>
                <p>Track present: {localAudioTrack ? "yes" : "no"}</p>
                <p>Enabled: {localAudioTrack ? String(localAudioTrack.enabled) : "false"}</p>
                <p>Ready state: {localAudioReadyState}</p>
              </div>
              <div className="rounded border border-slate-200 p-2 dark:border-slate-700">
                <p className="font-medium">Local Camera</p>
                <p>Track present: {localVideoTrack ? "yes" : "no"}</p>
                <p>Enabled: {localVideoTrack ? String(localVideoTrack.enabled) : "false"}</p>
                <p>Ready state: {localVideoReadyState}</p>
              </div>
              <div className="rounded border border-slate-200 p-2 dark:border-slate-700">
                <p className="font-medium">Connections</p>
                <p>Socket connected: {socketRef.current?.connected ? "yes" : "no"}</p>
                <p>Remote peers: {remoteStreams.length}</p>
                <p>Participants: {participants.length}</p>
              </div>
            </div>
            <div className="mt-3 rounded border border-slate-200 p-2 dark:border-slate-700">
              <p className="mb-2 font-medium">Remote Streams</p>
              {remoteDiagnostics.length === 0 ? (
                <p className="text-slate-500">No remote streams yet.</p>
              ) : (
                <div className="space-y-2">
                  {remoteDiagnostics.map((item) => (
                    <div
                      key={item.peerId}
                      className="rounded border border-slate-200 p-2 dark:border-slate-700"
                    >
                      <p className="font-medium">
                        {item.userName} ({item.peerId})
                      </p>
                      <p>
                        Audio: {item.hasAudioTrack ? "present" : "missing"} | state: {item.audioState}
                      </p>
                      <p>
                        Video: {item.hasVideoTrack ? "present" : "missing"} | state: {item.videoState}
                      </p>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        ) : null}

        {error ? (
          <p className="mb-3 rounded border border-rose-500/40 bg-rose-500/10 px-3 py-2 text-sm text-rose-300">
            {error}
          </p>
        ) : null}
        {joinedCall && joinApprovalStatus === "waiting" ? (
          <div className="mb-3 rounded border border-amber-500/40 bg-amber-500/10 px-3 py-2 text-sm text-amber-200">
            Waiting for host approval. You will join automatically once admitted.
          </div>
        ) : null}
        {joinedCall && joinApprovalStatus === "denied" ? (
          <div className="mb-3 flex flex-wrap items-center gap-2 rounded border border-rose-500/40 bg-rose-500/10 px-3 py-2 text-sm text-rose-200">
            <span>Host denied your request.</span>
            <button
              type="button"
              onClick={() => {
                setJoinApprovalStatus("approved");
                setJoinedCall(false);
                socketRef.current?.disconnect();
              }}
              className="rounded border border-rose-400 px-2 py-0.5 text-xs"
            >
              Back to pre-join
            </button>
          </div>
        ) : null}
        {meetingStartedAt ? (
          <p className="mb-3 text-xs text-slate-400">
            Session started: {new Date(meetingStartedAt).toLocaleString()}
          </p>
        ) : null}

        <div className="grid gap-4 lg:grid-cols-1">
          <div
            ref={tilesContainerRef}
            onWheel={handleTilesWheel}
            className="mx-auto w-full max-w-[1240px]"
          >
            <div className={`mx-auto grid max-w-[1240px] gap-3 ${gridColsClass}`}>
              {visibleTiles.map((participant, index) => {
                const isPinned = effectivePinnedPeerId === participant.peerId;
                const isPinnedFirstTile = Boolean(effectivePinnedPeerId) && index === 0 && isPinned;
                return (
                  <div
                    key={participant.peerId === localTile.peerId ? "local-video" : participant.peerId}
                    className={isPinnedFirstTile ? "sm:col-span-2 lg:col-span-3" : ""}
                  >
                    {participant.peerId === localTile.peerId ? (
                      <VideoTile
                        title="You"
                        subtitle={isPinned ? "Pinned" : displayName || user?.name}
                        videoRef={localVideoRef}
                        muted
                        videoEnabled={localTile.videoEnabled}
                        audioEnabled={localTile.audioEnabled}
                        avatarUrl={avatarUrl}
                        canPin
                        pinned={isPinned}
                        onTogglePin={() => {
                          setTilePage(0);
                          setManualPinnedPeerId((current) =>
                            current === localTile.peerId ? "" : localTile.peerId
                          );
                        }}
                      />
                    ) : (
                      <RemoteVideo
                        peerId={participant.peerId}
                        userName={participant.userName}
                        subtitle={isPinned ? "Pinned" : participant.subtitle}
                        stream={participant.stream}
                        videoEnabled={participant.videoEnabled}
                        audioEnabled={participant.audioEnabled}
                        avatarUrl={participant.avatarUrl}
                        pinned={isPinned}
                        onTogglePin={() => {
                          setTilePage(0);
                          setManualPinnedPeerId((current) =>
                            current === participant.peerId ? "" : participant.peerId
                          );
                        }}
                      />
                    )}
                  </div>
                );
              })}
            </div>
            {totalPages > 1 ? (
              <div className="mt-3 flex items-center justify-center gap-2 text-xs">
                <button
                  type="button"
                  onClick={() => setTilePage((page) => Math.max(0, page - 1))}
                  className="rounded border border-slate-300 px-2 py-0.5 dark:border-slate-700"
                  title="Previous page"
                >
                  ◀
                </button>
                <span>
                  {currentPage + 1} / {totalPages}
                </span>
                <button
                  type="button"
                  onClick={() => setTilePage((page) => Math.min(totalPages - 1, page + 1))}
                  className="rounded border border-slate-300 px-2 py-0.5 dark:border-slate-700"
                  title="Next page"
                >
                  ▶
                </button>
              </div>
            ) : null}
          </div>
        </div>
        {showParticipantsPanel ? (
          <div
            ref={participantsPanelRef}
            className="fixed left-3 top-28 z-[60] h-[min(72vh,620px)] w-[min(300px,92vw)] overflow-auto rounded-xl border border-slate-700 bg-white p-3 shadow-xl dark:border-slate-800 dark:bg-slate-900"
          >
            <div className="mb-2 flex items-center justify-between">
              <h2 className="text-lg font-medium">People</h2>
              <button
                type="button"
                onClick={() => setShowParticipantsPanel(false)}
                className="text-xs text-slate-500 hover:text-slate-800 dark:hover:text-slate-100"
              >
                Close
              </button>
            </div>
            <input
              value={participantSearch}
              onChange={(event) => setParticipantSearch(event.target.value)}
              placeholder="Search participants"
              className="mb-3 w-full rounded border border-slate-300 bg-white px-2 py-2 text-sm outline-none focus:ring dark:border-slate-700 dark:bg-slate-800"
            />
            {isHost && !allowAllParticipants ? (
              <>
                <p className="mb-1 text-xs font-semibold text-slate-500">
                  Waiting for approval ({waitingParticipants.length})
                </p>
                <div className="mb-3 max-h-36 space-y-2 overflow-auto rounded border border-slate-300 p-2 dark:border-slate-800">
                  {waitingParticipants.length === 0 ? (
                    <p className="text-xs text-slate-400">No pending requests.</p>
                  ) : (
                    waitingParticipants.map((pending) => (
                      <div
                        key={pending.peerId}
                        className="flex items-center justify-between gap-2 rounded bg-slate-100 p-2 text-xs dark:bg-slate-800"
                      >
                        <span className="truncate">{pending.name || "Participant"}</span>
                        <div className="flex items-center gap-1">
                          <button
                            type="button"
                            onClick={() => handleHostAdmitParticipant(pending.peerId)}
                            className="rounded border border-emerald-500 px-2 py-0.5 text-emerald-600"
                            title="Admit participant"
                          >
                            Admit
                          </button>
                          <button
                            type="button"
                            onClick={() => handleHostRejectParticipant(pending.peerId)}
                            className="rounded border border-rose-500 px-2 py-0.5 text-rose-500"
                            title="Reject participant"
                          >
                            Reject
                          </button>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </>
            ) : null}
            <p className="mb-1 text-xs font-semibold text-slate-500">In this meeting</p>
            <div className="mb-3 max-h-44 space-y-2 overflow-auto rounded border border-slate-300 p-2 dark:border-slate-800">
              {searchedCurrentParticipants.map((participant) => (
                <div
                  key={participant.peerId}
                  className="rounded bg-slate-100 p-2 text-xs text-slate-700 dark:bg-slate-800 dark:text-slate-200"
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      {participant.avatarUrl ? (
                        <img
                          src={participant.avatarUrl}
                          alt={participant.name}
                          className="h-6 w-6 rounded-full object-cover"
                        />
                      ) : (
                        <div className="flex h-6 w-6 items-center justify-center rounded-full bg-slate-300 text-[10px] font-semibold text-slate-700 dark:bg-slate-700 dark:text-slate-100">
                          {(participant.name || "U").slice(0, 1).toUpperCase()}
                        </div>
                      )}
                      <p className="font-medium">
                        {participant.name} {participant.isHost ? "(Host)" : ""}
                        {hostPinnedPeerId === participant.peerId ? " (Pinned for all)" : ""}
                      </p>
                    </div>
                    <span>
                      A:{participant.audioEnabled ? "on" : "off"} V:
                      {participant.videoEnabled ? "on" : "off"}
                    </span>
                  </div>
                  {isHost && participant.peerId !== socketId ? (
                    <div className="mt-2 flex gap-1">
                      <button
                        type="button"
                        onClick={() => handleHostPinForAll(participant.peerId)}
                        className="rounded border border-indigo-400 px-2 py-1 text-indigo-500"
                        title="Pin for all participants"
                      >
                        📌
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          handleHostAction(participant.peerId, "mute-audio");
                          setShowParticipantsPanel(false);
                        }}
                        className="rounded border border-slate-300 px-2 py-1 dark:border-slate-700"
                        title="Mute participant"
                      >
                        🔇
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          handleHostAction(participant.peerId, "unmute-audio");
                          setShowParticipantsPanel(false);
                        }}
                        className="rounded border border-slate-300 px-2 py-1 dark:border-slate-700"
                        title="Unmute participant"
                      >
                        🎤
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          handleHostAction(participant.peerId, "mute-video");
                          setShowParticipantsPanel(false);
                        }}
                        className="rounded border border-slate-300 px-2 py-1 dark:border-slate-700"
                        title="Turn camera off"
                      >
                        🚫📷
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          handleHostAction(participant.peerId, "unmute-video");
                          setShowParticipantsPanel(false);
                        }}
                        className="rounded border border-slate-300 px-2 py-1 dark:border-slate-700"
                        title="Turn camera on"
                      >
                        📷
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          handleHostAction(participant.peerId, "remove");
                          setShowParticipantsPanel(false);
                        }}
                        className="rounded border border-rose-400 px-2 py-1 text-rose-500"
                        title="Remove participant"
                      >
                        ⛔
                      </button>
                    </div>
                  ) : null}
                </div>
              ))}
            </div>
            <p className="mb-1 text-xs font-semibold text-slate-500">Previous participants</p>
            <div className="max-h-56 space-y-1 overflow-auto rounded border border-slate-300 p-2 text-xs dark:border-slate-800">
              {searchedPreviousParticipants.length === 0 ? (
                <p className="text-slate-400">No previous participants.</p>
              ) : (
                searchedPreviousParticipants.map((participant) => (
                  <p key={`${participant.userId || participant.email}-${participant.joinedAt}`}>
                    {participant.name}
                    {participant.email ? ` (${participant.email})` : ""}
                  </p>
                ))
              )}
            </div>
          </div>
        ) : null}
        {showChatPanel ? (
          <div
            ref={chatPanelRef}
            className="fixed right-3 top-28 z-[60] flex h-[min(74vh,680px)] w-[min(360px,92vw)] flex-col rounded-xl border border-slate-700 bg-white p-3 shadow-xl dark:border-slate-800 dark:bg-slate-900"
          >
            <div className="mb-2 flex items-center justify-between">
              <h2 className="text-lg font-medium">Live Chat</h2>
              <button
                type="button"
                onClick={() => setShowChatPanel(false)}
                className="text-xs text-slate-500 hover:text-slate-800 dark:hover:text-slate-100"
              >
                Close
              </button>
            </div>
            <div className="h-[420px] overflow-auto rounded border border-slate-300 p-2 dark:border-slate-800">
              {chatMessages.length === 0 ? (
                <p className="text-sm text-slate-400">No messages yet.</p>
              ) : (
                <div className="space-y-2">
                  {chatMessages.map((message) => (
                    <div
                      key={message.id}
                      className="rounded bg-slate-100 p-2 text-sm dark:bg-slate-800"
                    >
                      <p className="font-medium text-indigo-400">{message.sender}</p>
                      {message.type === "code" ? (
                        <CodeMessageCard
                          messageId={message.id}
                          language={message.language}
                          code={message.code || message.text}
                          expanded={Boolean(expandedCodeMessages[message.id])}
                          onToggle={() =>
                            setExpandedCodeMessages((previous) => ({
                              ...previous,
                              [message.id]: !previous[message.id],
                            }))
                          }
                        />
                      ) : message.type === "media" ? (
                        <AttachmentList attachments={message.attachments || []} />
                      ) : (
                        <>
                          {message.text ? <p>{message.text}</p> : null}
                          {(message.attachments || []).length ? (
                            <AttachmentList attachments={message.attachments || []} />
                          ) : null}
                        </>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
            <form onSubmit={sendChatMessage} className="mt-2 flex flex-wrap gap-2">
              <input
                value={chatInput}
                onChange={(event) => setChatInput(event.target.value)}
                placeholder="Type a message (text or emoji)..."
                className="min-w-[180px] flex-1 rounded border border-slate-300 bg-white px-3 py-2 text-sm outline-none ring-indigo-500 focus:ring dark:border-slate-700 dark:bg-slate-800"
              />
              <button
                type="submit"
                className="rounded bg-indigo-500 px-3 py-2 text-sm font-medium text-white hover:bg-indigo-400"
              >
                Send
              </button>
            </form>
            <button
              type="button"
              onClick={() => {
                clearChat();
                setShowChatPanel(false);
              }}
              className="mt-2 text-left text-xs text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
            >
              Clear chat
            </button>
          </div>
        ) : null}
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
      {joinedCall && showMobileDock ? (
        <div className="fixed bottom-[max(0.75rem,env(safe-area-inset-bottom))] left-1/2 z-[90] -translate-x-1/2">
          <div className="flex items-center gap-2 rounded-2xl border border-slate-700 bg-slate-900/95 px-2 py-2 shadow-lg backdrop-blur md:gap-3 md:px-3">
            <button
              type="button"
              onClick={handleMicButtonClick}
              onTouchEnd={handleMicButtonTouchEnd}
              disabled={!mediaPermissionGranted}
              title={audioEnabled ? "Mute microphone" : "Unmute microphone"}
              className="flex h-12 w-12 items-center justify-center rounded-2xl border border-slate-700 bg-slate-800 hover:bg-slate-700 disabled:opacity-60 md:h-14 md:w-14"
            >
              {audioEnabled ? <MicOnIcon /> : <MicOffIcon />}
            </button>
            <button
              type="button"
              onClick={toggleVideo}
              disabled={!mediaPermissionGranted}
              title={videoEnabled ? "Turn camera off" : "Turn camera on"}
              className="flex h-12 w-12 items-center justify-center rounded-2xl border border-slate-700 bg-slate-800 hover:bg-slate-700 disabled:opacity-60 md:h-14 md:w-14"
            >
              {videoEnabled ? <CamOnIcon /> : <CamOffIcon />}
            </button>
            <button
              type="button"
              onClick={handleScreenShare}
              title="Share screen"
              className="flex h-12 w-12 items-center justify-center rounded-2xl border border-slate-700 bg-slate-800 hover:bg-slate-700 md:h-14 md:w-14"
            >
              <ScreenShareIcon active={sharingScreen} />
            </button>
            <button
              type="button"
              onClick={() => setShowHamburgerMenu((value) => !value)}
              title="Open meeting menu"
              className="flex h-12 w-12 items-center justify-center rounded-2xl border border-slate-700 bg-slate-800 hover:bg-slate-700 md:h-14 md:w-14"
            >
              <MenuIcon />
            </button>
            <button
              type="button"
              onClick={() => setShowEmojiPicker((value) => !value)}
              title="Open reactions"
              className="flex h-12 w-12 items-center justify-center rounded-2xl border border-slate-700 bg-slate-800 hover:bg-slate-700 md:h-14 md:w-14"
            >
              <SparkleFaceIcon />
            </button>
          </div>
        </div>
      ) : null}
      {joinedCall && !showMobileDock ? (
        <div className="pointer-events-none fixed bottom-2 left-1/2 z-[85] -translate-x-1/2 rounded-full bg-black/35 px-3 py-1 text-[11px] text-white">
          {isMobileViewport ? "Tap screen for controls" : "Move cursor to bottom for controls"}
        </div>
      ) : null}
    </div>
  );
};

const RemoteVideo = ({
  peerId,
  userName,
  subtitle,
  stream,
  avatarUrl,
  videoEnabled = true,
  audioEnabled = true,
  pinned = false,
  onTogglePin,
}) => {
  const videoRef = useRef(null);

  useEffect(() => {
    if (!videoRef.current) return;
    const videoElement = videoRef.current;
    videoElement.srcObject = stream || null;
    if (!stream) return;

    // Pin/unpin can remount tiles; ensure playback resumes reliably.
    const resumePlayback = () => {
      videoElement.play().catch(() => {});
    };
    const videoTrack = stream.getVideoTracks?.()[0];
    const onTrackUnmute = () => resumePlayback();
    if (videoTrack) {
      videoTrack.addEventListener("unmute", onTrackUnmute);
    }
    videoElement.addEventListener("loadedmetadata", resumePlayback);
    resumePlayback();
    return () => {
      if (videoTrack) {
        videoTrack.removeEventListener("unmute", onTrackUnmute);
      }
      videoElement.removeEventListener("loadedmetadata", resumePlayback);
    };
  }, [stream, pinned]);

  return (
    <VideoTile
      title={userName || "Participant"}
      subtitle={subtitle || peerId}
      videoRef={videoRef}
      videoEnabled={videoEnabled}
      audioEnabled={audioEnabled}
      avatarUrl={avatarUrl}
      canPin
      pinned={pinned}
      onTogglePin={onTogglePin}
    />
  );
};

const iconClass = "h-7 w-7 text-slate-100";

const MicOnIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className={iconClass}>
    <rect x="9" y="3.5" width="6" height="11" rx="3" />
    <path d="M5 11.5a7 7 0 0 0 14 0" />
    <path d="M12 18.5v3" />
    <path d="M8.5 21.5h7" />
  </svg>
);

const MicOffIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className={iconClass}>
    <rect x="9" y="3.5" width="6" height="11" rx="3" />
    <path d="M5 11.5a7 7 0 0 0 14 0" />
    <path d="M12 18.5v3" />
    <path d="M8.5 21.5h7" />
    <path d="M4 4l16 16" />
  </svg>
);

const CamOnIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className={iconClass}>
    <rect x="3.5" y="7" width="13" height="10" rx="2" />
    <path d="M16.5 10.5 21 8v8l-4.5-2.5" />
  </svg>
);

const CamOffIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className={iconClass}>
    <rect x="3.5" y="7" width="13" height="10" rx="2" />
    <path d="M16.5 10.5 21 8v8l-4.5-2.5" />
    <path d="M4 4l16 16" />
  </svg>
);

const ScreenShareIcon = ({ active = false }) => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className={iconClass}>
    <rect x="3.5" y="4.5" width="17" height="11" rx="2" />
    <path d="M10 19.5h4" />
    <path d="M12 15.5v4" />
    {active ? <path d="M7.5 10.5 10 8l2.5 2.5" /> : <path d="M12 8v5" />}
  </svg>
);

const MenuIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className={iconClass}>
    <path d="M4 7h16M4 12h16M4 17h16" />
  </svg>
);

const SparkleFaceIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" className={iconClass}>
    <circle cx="12" cy="12" r="7.5" />
    <path d="M9 10h.01M15 10h.01" />
    <path d="M9 14.5c1 1 2 1.5 3 1.5s2-.5 3-1.5" />
    <path d="M5 5l1-2 1 2 2 1-2 1-1 2-1-2-2-1zM18 4l.7-1.4L20 4l1.4.7L20 5.4 18.7 7 18 5.4 16.6 4.7z" />
  </svg>
);

const AttachmentList = ({ attachments }) => {
  if (!attachments?.length) return null;
  return (
    <div className="mt-2 space-y-2">
      {attachments.map((attachment, index) => {
        const key = `${attachment.url || attachment.fileName}-${index}`;
        const isPdf = (attachment.mimeType || "").includes("pdf");
        const isDoc = /(word|officedocument|msword)/i.test(attachment.mimeType || "");
        const isPpt = /(presentation|powerpoint)/i.test(attachment.mimeType || "");

        if (attachment.kind === "video") {
          return <video key={key} controls src={attachment.url} className="max-h-52 w-full rounded" />;
        }
        if (attachment.kind === "image") {
          return (
            <img
              key={key}
              src={attachment.url}
              alt={attachment.fileName || "shared"}
              className="max-h-52 w-full rounded object-cover"
            />
          );
        }
        return (
          <a
            key={key}
            href={attachment.url}
            target="_blank"
            rel="noreferrer"
            className="block rounded border border-slate-300 bg-white px-3 py-2 text-xs hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-900"
          >
            {isPdf ? "PDF" : isDoc ? "DOC" : isPpt ? "PPT" : "FILE"}:{" "}
            {attachment.fileName || "download"}
          </a>
        );
      })}
    </div>
  );
};

const CodeMessageCard = ({ messageId, language, code, expanded, onToggle }) => {
  const previewLineCount = 6;
  const lines = (code || "").split("\n");
  const preview = lines.slice(0, previewLineCount).join("\n");
  const displayCode = expanded ? code : preview;
  const canExpand = lines.length > previewLineCount;

  return (
    <div className="mt-1 rounded border border-slate-700 bg-black/85 p-2">
      <div className="mb-1 flex items-center justify-between">
        <span className="text-[10px] uppercase tracking-wide text-slate-400">
          {language || "code"} • {lines.length} lines
        </span>
        <div className="flex gap-2">
          <button
            type="button"
            className="text-[10px] text-indigo-300 hover:text-indigo-200"
            onClick={() => navigator.clipboard.writeText(code || "").catch(() => {})}
          >
            Copy
          </button>
          {canExpand ? (
            <button
              type="button"
              className="text-[10px] text-indigo-300 hover:text-indigo-200"
              onClick={onToggle}
            >
              {expanded ? "Minimize" : "Expand"}
            </button>
          ) : null}
        </div>
      </div>
      <pre
        id={`code-${messageId}`}
        className={`overflow-auto text-xs text-emerald-300 ${
          expanded ? "max-h-[420px]" : "max-h-[120px]"
        }`}
      >
        {displayCode}
      </pre>
      {!expanded && canExpand ? (
        <div className="pointer-events-none -mt-8 h-8 bg-gradient-to-t from-black/90 to-transparent" />
      ) : null}
    </div>
  );
};

export default MeetingRoomPage;
