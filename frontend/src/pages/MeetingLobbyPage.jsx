import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAuthStore } from "../store/useAuthStore";
import { getMyMeetingHistory } from "../api/meetingApi";

const MeetingLobbyPage = () => {
  const user = useAuthStore((state) => state.user);
  const logout = useAuthStore((state) => state.logout);
  const navigate = useNavigate();
  const [meetingId, setMeetingId] = useState("");
  const [history, setHistory] = useState([]);

  const handleCreateMeeting = () => {
    const generatedId = `meet-${crypto.randomUUID().slice(0, 8)}`;
    navigate(`/meet/${generatedId}`);
  };

  const handleJoinMeeting = (event) => {
    event.preventDefault();
    if (!meetingId.trim()) return;
    navigate(`/meet/${meetingId.trim()}`);
  };

  useEffect(() => {
    getMyMeetingHistory()
      .then((response) => setHistory(response.data.meetings || []))
      .catch(() => setHistory([]));
  }, []);

  const handleLogout = () => {
    logout();
    navigate("/login");
  };

  return (
    <div className="page-shell flex min-h-screen items-center">
      <div className="ui-card w-full p-8">
        <h1 className="ui-title">Meeting Lobby</h1>
        <p className="ui-subtitle mt-2">
          Signed in as <span className="font-medium">{user?.email}</span>
        </p>
        <button
          type="button"
          onClick={handleLogout}
          className="ui-btn-danger mt-4"
        >
          Logout
        </button>
        <Link to="/" className="ui-btn-ghost mt-4 ml-2">
          Go to Main Page
        </Link>

        <div className="ui-card-soft mt-6 p-5">
          <h2 className="text-lg font-medium">Create New Meeting</h2>
          <p className="ui-subtitle mt-1">
            A meeting ID is generated automatically when you create.
          </p>
          <button
            type="button"
            onClick={handleCreateMeeting}
            className="ui-btn-primary mt-4"
          >
            Create & Join
          </button>
        </div>

        <form onSubmit={handleJoinMeeting} className="ui-card-soft mt-4 p-5">
          <h2 className="text-lg font-medium">Join Existing Meeting</h2>
          <input
            value={meetingId}
            onChange={(event) => setMeetingId(event.target.value)}
            placeholder="Enter meeting ID"
            className="ui-input mt-3"
          />
          <button
            type="submit"
            className="ui-btn-success mt-4"
          >
            Join Meeting
          </button>
        </form>

        <div className="ui-card-soft mt-4 p-5">
          <h2 className="text-lg font-medium">Recent Meetings</h2>
          <p className="ui-subtitle mt-1">
            Rejoin old meetings from the dedicated History page.
          </p>
          <div className="mt-3 space-y-2">
            {history.length === 0 ? (
              <p className="ui-subtitle">No recent meetings found.</p>
            ) : (
              history.map((meeting) => (
                <div key={meeting._id} className="rounded-xl border border-slate-200 bg-white/80 p-3 text-sm dark:border-slate-700 dark:bg-slate-800/80">
                  <p className="font-medium text-indigo-500 dark:text-indigo-300">{meeting.roomId}</p>
                  <p className="text-slate-600 dark:text-slate-300">
                    Status: {meeting.status} | Duration: {meeting.replayMetadata?.durationSec || 0}s
                  </p>
                  <p className="text-slate-500 dark:text-slate-400">
                    Participants: {meeting.replayMetadata?.totalParticipants || 0} | Messages:{" "}
                    {meeting.replayMetadata?.totalMessages || 0} | Reactions:{" "}
                    {meeting.replayMetadata?.totalReactions || 0} | Recordings:{" "}
                    {meeting.replayMetadata?.totalRecordings || 0}
                  </p>
                  {(meeting.chatMessages || []).length ? (
                    <div className="mt-2 rounded border border-slate-200 bg-slate-50 p-2 dark:border-slate-700 dark:bg-slate-900">
                      <p className="mb-1 text-xs font-semibold text-slate-600 dark:text-slate-300">Notes</p>
                      {(meeting.chatMessages || []).slice(-3).map((message) => (
                        <div key={message._id || message.id} className="mb-1 text-xs text-slate-500 dark:text-slate-400">
                          <span className="font-medium text-slate-700 dark:text-slate-200">{message.sender}:</span>{" "}
                          {message.type === "media"
                            ? `Shared ${(message.attachments || []).length} media item(s)`
                            : message.code || message.text}
                        </div>
                      ))}
                    </div>
                  ) : null}
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default MeetingLobbyPage;
