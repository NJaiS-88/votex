import api from "./http";

const authHeader = () => {
  const token = localStorage.getItem("token");
  return token ? { Authorization: `Bearer ${token}` } : {};
};

export const startMeetingSession = (roomId) =>
  api.post(`/meetings/${roomId}/start`, {}, { headers: authHeader() });

export const endMeetingSession = (roomId) =>
  api.post(`/meetings/${roomId}/end`, {}, { headers: authHeader() });

export const saveRecordingMetadata = (roomId, payload) =>
  api.post(`/meetings/${roomId}/recordings`, payload, { headers: authHeader() });

export const getMyMeetingHistory = () =>
  api.get("/meetings/history/my", { headers: authHeader() });
