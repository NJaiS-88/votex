import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { getMyMeetingHistory } from "../api/meetingApi";

const MeetingHistoryPage = () => {
  const navigate = useNavigate();
  const [history, setHistory] = useState([]);
  const [query, setQuery] = useState("");

  useEffect(() => {
    getMyMeetingHistory()
      .then((response) => setHistory(response.data.meetings || []))
      .catch(() => setHistory([]));
  }, []);

  const filtered = useMemo(() => {
    const keyword = query.trim().toLowerCase();
    if (!keyword) return history;
    return history.filter((meeting) => {
      if ((meeting.roomId || "").toLowerCase().includes(keyword)) return true;
      return (meeting.participantHistory || []).some((participant) =>
        (participant.name || "").toLowerCase().includes(keyword)
      );
    });
  }, [history, query]);

  return (
    <div className="page-shell">
      <div className="ui-card p-6">
        <div className="mb-4 flex items-center justify-between">
          <h1 className="ui-title">Meet History</h1>
          <Link to="/" className="ui-btn-ghost">
            Back
          </Link>
        </div>
        <input
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="Search meeting ID or previous participants"
          className="ui-input mb-4"
        />

        <div className="space-y-3">
          {filtered.length === 0 ? (
            <p className="ui-subtitle">No meetings found.</p>
          ) : (
            filtered.map((meeting) => {
              const previousParticipants = Array.from(
                new Set((meeting.participantHistory || []).map((participant) => participant.name))
              )
                .filter(Boolean)
                .slice(0, 8);
              return (
                <div
                  key={meeting._id}
                  className="ui-card-soft p-4 text-sm"
                >
                  <p className="font-semibold text-slate-900 dark:text-slate-100">{meeting.roomId}</p>
                  <p className="text-slate-500 dark:text-slate-400">
                    Status: {meeting.status} | Duration: {meeting.replayMetadata?.durationSec || 0}s
                  </p>
                  {previousParticipants.length ? (
                    <p className="mt-1 text-slate-500 dark:text-slate-400">
                      Previous participants: {previousParticipants.join(", ")}
                    </p>
                  ) : null}
                  <div className="mt-3 flex gap-2">
                    <button
                      type="button"
                      onClick={() => navigate(`/meet/${meeting.roomId}`)}
                      className="ui-btn-success px-3 py-1 text-xs"
                    >
                      Rejoin
                    </button>
                    <button
                      type="button"
                      onClick={() => navigate(`/meet/${meeting.roomId}`)}
                      className="ui-btn-primary px-3 py-1 text-xs"
                    >
                      Start with previous participants
                    </button>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
};

export default MeetingHistoryPage;
