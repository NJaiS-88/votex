import { useEffect, useMemo, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { getMeetingById, getMyMeetingHistory } from "../api/meetingApi";
import {
  getDirectThreadById,
  getMyDirectThreads,
  sendDirectMessage,
} from "../api/chatApi";
import { useAuthStore } from "../store/useAuthStore";

const formatDate = (value) => {
  if (!value) return "";
  return new Date(value).toLocaleString();
};

const HomeChatsPage = () => {
  const user = useAuthStore((state) => state.user);
  const [searchParams, setSearchParams] = useSearchParams();
  const [meetings, setMeetings] = useState([]);
  const [directThreads, setDirectThreads] = useState([]);
  const [selectedKind, setSelectedKind] = useState("meeting");
  const [selectedMeeting, setSelectedMeeting] = useState(null);
  const [selectedThread, setSelectedThread] = useState(null);
  const [selectedContact, setSelectedContact] = useState(null);
  const [loadingPanel, setLoadingPanel] = useState(false);
  const [dmInput, setDmInput] = useState("");
  const [sidebarFilter, setSidebarFilter] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    Promise.all([getMyMeetingHistory(), getMyDirectThreads()])
      .then(([meetingResponse, threadsResponse]) => {
        const history = meetingResponse.data.meetings || [];
        const threads = threadsResponse.data.threads || [];
        setMeetings(history);
        setDirectThreads(threads);

        const preferredMeetingId = searchParams.get("meeting");
        if (preferredMeetingId) {
          const existing = history.find((item) => item.roomId === preferredMeetingId);
          if (existing) {
            handleSelectMeeting(existing.roomId);
            return;
          }
        }
        if (history.length) handleSelectMeeting(history[0].roomId);
      })
      .catch(() => setError("Could not load chat hub data."));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const pastContacts = useMemo(() => {
    const map = new Map();
    meetings.forEach((meeting) => {
      (meeting.participantHistory || []).forEach((participant) => {
        const key = participant.userId || participant.email;
        if (!key) return;
        if (String(participant.userId) === String(user?._id || user?.id)) return;
        if (!map.has(key)) {
          map.set(key, {
            userId: participant.userId,
            name: participant.name,
            email: participant.email,
            avatarUrl: participant.avatarUrl || "",
          });
        }
      });
    });
    return Array.from(map.values());
  }, [meetings, user]);

  const filteredMeetings = useMemo(() => {
    const keyword = sidebarFilter.trim().toLowerCase();
    if (!keyword) return meetings;
    return meetings.filter((meeting) => (meeting.roomId || "").toLowerCase().includes(keyword));
  }, [meetings, sidebarFilter]);

  const filteredThreads = useMemo(() => {
    const keyword = sidebarFilter.trim().toLowerCase();
    if (!keyword) return directThreads;
    return directThreads.filter((thread) =>
      (thread.participants || []).some((participant) =>
        (participant.name || "").toLowerCase().includes(keyword)
      )
    );
  }, [directThreads, sidebarFilter]);

  const filteredContacts = useMemo(() => {
    const keyword = sidebarFilter.trim().toLowerCase();
    if (!keyword) return pastContacts;
    return pastContacts.filter((contact) =>
      `${contact.name || ""} ${contact.email || ""}`.toLowerCase().includes(keyword)
    );
  }, [pastContacts, sidebarFilter]);

  const handleSelectMeeting = async (roomId) => {
    setLoadingPanel(true);
    setSelectedKind("meeting");
    setSelectedThread(null);
    setSelectedContact(null);
    setError("");
    try {
      const response = await getMeetingById(roomId);
      setSelectedMeeting(response.data.meeting);
      setSearchParams({ meeting: roomId });
    } catch {
      setError("Could not load complete meeting chat history.");
    } finally {
      setLoadingPanel(false);
    }
  };

  const handleSelectThread = async (threadId) => {
    setLoadingPanel(true);
    setSelectedKind("dm-thread");
    setSelectedMeeting(null);
    setSelectedContact(null);
    setError("");
    try {
      const response = await getDirectThreadById(threadId);
      setSelectedThread(response.data.thread);
    } catch {
      setError("Could not load direct chat.");
    } finally {
      setLoadingPanel(false);
    }
  };

  const handleSelectContact = (contact) => {
    setSelectedKind("dm-contact");
    setSelectedMeeting(null);
    setSelectedThread(null);
    setSelectedContact(contact);
    setDmInput("");
    setError("");
  };

  const activeDmUser =
    selectedKind === "dm-thread"
      ? (selectedThread?.participants || []).find(
          (participant) => String(participant.userId) !== String(user?._id || user?.id)
        )
      : selectedContact;

  const handleSendDm = async (event) => {
    event.preventDefault();
    const text = dmInput.trim();
    if (!text || !activeDmUser?.userId) return;
    try {
      const response = await sendDirectMessage(activeDmUser.userId, { text });
      const updatedThread = response.data.thread;
      setSelectedKind("dm-thread");
      setSelectedContact(null);
      setSelectedThread(updatedThread);
      setDmInput("");
      const threadsResponse = await getMyDirectThreads();
      setDirectThreads(threadsResponse.data.threads || []);
    } catch {
      setError("Could not send direct message.");
    }
  };

  return (
    <div className="page-shell">
      <div className="ui-card h-[calc(100vh-5rem)] overflow-hidden">
        <div className="grid h-full grid-cols-1 lg:grid-cols-[340px_1fr]">
          <aside className="border-r border-slate-200 p-4 dark:border-slate-800">
            <div className="mb-3 flex items-center justify-between">
              <h1 className="text-lg font-semibold">Chats Hub</h1>
              <Link to="/" className="ui-btn-ghost px-3 py-1">
                Back
              </Link>
            </div>
            <input
              value={sidebarFilter}
              onChange={(event) => setSidebarFilter(event.target.value)}
              placeholder="Search meetings or people"
              className="ui-input mb-3"
            />

            <section className="mb-4">
              <h2 className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500">
                Past Meetings
              </h2>
              <div className="max-h-48 space-y-1 overflow-auto">
                {filteredMeetings.map((meeting) => (
                  <button
                    key={meeting._id}
                    type="button"
                    onClick={() => handleSelectMeeting(meeting.roomId)}
                    className={`w-full rounded-lg px-3 py-2 text-left text-sm ${
                      selectedKind === "meeting" && selectedMeeting?.roomId === meeting.roomId
                        ? "bg-slate-900 text-white dark:bg-slate-100 dark:text-slate-900"
                        : "bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700"
                    }`}
                  >
                    <p className="font-medium">{meeting.roomId}</p>
                    <p className="text-xs opacity-75">{meeting.status}</p>
                  </button>
                ))}
              </div>
            </section>

            <section className="mb-4">
              <h2 className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500">
                Direct Chats
              </h2>
              <div className="max-h-40 space-y-1 overflow-auto">
                {filteredThreads.map((thread) => {
                  const other = (thread.participants || []).find(
                    (participant) => String(participant.userId) !== String(user?._id || user?.id)
                  );
                  return (
                    <button
                      key={thread._id}
                      type="button"
                      onClick={() => handleSelectThread(thread._id)}
                      className={`w-full rounded-lg px-3 py-2 text-left text-sm ${
                        selectedKind === "dm-thread" && selectedThread?._id === thread._id
                          ? "bg-slate-900 text-white dark:bg-slate-100 dark:text-slate-900"
                          : "bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700"
                      }`}
                    >
                      <p className="font-medium">{other?.name || "User"}</p>
                      <p className="text-xs opacity-75">{thread.messages?.slice(-1)[0]?.text || "No messages"}</p>
                    </button>
                  );
                })}
              </div>
            </section>

            <section>
              <h2 className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500">
                People From Past Meetings
              </h2>
              <div className="max-h-40 space-y-1 overflow-auto">
                {filteredContacts.map((contact) => (
                  <button
                    key={`${contact.userId || contact.email}`}
                    type="button"
                    onClick={() => handleSelectContact(contact)}
                    className={`w-full rounded-lg px-3 py-2 text-left text-sm ${
                      selectedKind === "dm-contact" &&
                      selectedContact?.userId === contact.userId &&
                      selectedContact?.email === contact.email
                        ? "bg-slate-900 text-white dark:bg-slate-100 dark:text-slate-900"
                        : "bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700"
                    }`}
                  >
                    <p className="font-medium">{contact.name || contact.email}</p>
                    <p className="text-xs opacity-75">{contact.email}</p>
                  </button>
                ))}
              </div>
            </section>
          </aside>

          <section className="flex h-full flex-col p-4">
            {error ? (
              <p className="mb-3 rounded border border-rose-300 bg-rose-50 px-3 py-2 text-sm text-rose-500 dark:border-rose-900 dark:bg-rose-900/30">
                {error}
              </p>
            ) : null}

            {loadingPanel ? (
              <p className="ui-subtitle">Loading conversation...</p>
            ) : null}

            {selectedKind === "meeting" && selectedMeeting ? (
              <>
                <h2 className="mb-1 text-xl font-semibold">Meeting: {selectedMeeting.roomId}</h2>
                <p className="ui-subtitle mb-4">
                  Full chat history ({selectedMeeting.chatMessages?.length || 0} messages)
                </p>
                <div className="ui-card-soft flex-1 space-y-2 overflow-auto p-3">
                  {(selectedMeeting.chatMessages || []).length === 0 ? (
                    <p className="ui-subtitle">No chat messages in this meeting.</p>
                  ) : (
                    (selectedMeeting.chatMessages || []).map((message, index) => (
                      <div
                        key={`${message._id || message.id || index}-${message.createdAt}`}
                        className="rounded-lg border border-slate-200 bg-white/70 p-3 dark:border-slate-700 dark:bg-slate-900/60"
                      >
                        <div className="mb-1 flex items-center justify-between">
                          <span className="font-medium text-slate-900 dark:text-slate-100">
                            {message.sender || "User"}
                          </span>
                          <span className="text-xs text-slate-500">
                            {formatDate(message.createdAt)}
                          </span>
                        </div>
                        <p className="text-sm text-slate-700 dark:text-slate-200">
                          {message.type === "code" ? message.code || message.text : message.text}
                        </p>
                      </div>
                    ))
                  )}
                </div>
              </>
            ) : null}

            {(selectedKind === "dm-thread" || selectedKind === "dm-contact") && activeDmUser ? (
              <>
                <h2 className="mb-1 text-xl font-semibold">Direct chat: {activeDmUser.name}</h2>
                <p className="ui-subtitle mb-4">{activeDmUser.email}</p>
                <div className="ui-card-soft flex-1 space-y-2 overflow-auto p-3">
                  {selectedKind === "dm-thread" && (selectedThread?.messages || []).length ? (
                    (selectedThread.messages || []).map((message, index) => {
                      const mine = String(message.senderId) === String(user?._id || user?.id);
                      return (
                        <div
                          key={`${message._id || index}-${message.createdAt}`}
                          className={`rounded-lg p-3 text-sm ${
                            mine
                              ? "ml-10 bg-indigo-500 text-white"
                              : "mr-10 border border-slate-200 bg-white dark:border-slate-700 dark:bg-slate-900"
                          }`}
                        >
                          <p className={`text-xs ${mine ? "text-indigo-100" : "text-slate-500"}`}>
                            {message.senderName} - {formatDate(message.createdAt)}
                          </p>
                          <p className={mine ? "text-white" : "text-slate-700 dark:text-slate-200"}>
                            {message.text}
                          </p>
                        </div>
                      );
                    })
                  ) : (
                    <p className="ui-subtitle">No direct messages yet. Start the conversation.</p>
                  )}
                </div>
                <form onSubmit={handleSendDm} className="mt-3 flex gap-2">
                  <input
                    value={dmInput}
                    onChange={(event) => setDmInput(event.target.value)}
                    placeholder={`Message ${activeDmUser.name}...`}
                    className="ui-input"
                  />
                  <button type="submit" className="ui-btn-primary">
                    Send
                  </button>
                </form>
              </>
            ) : null}

            {!loadingPanel && !selectedMeeting && !activeDmUser ? (
              <p className="ui-subtitle">Choose a meeting or user from the left sidebar.</p>
            ) : null}
          </section>
        </div>
      </div>
    </div>
  );
};

export default HomeChatsPage;
