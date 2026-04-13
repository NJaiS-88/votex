import api from "./http";

const authHeader = () => {
  const token = localStorage.getItem("token");
  return token ? { Authorization: `Bearer ${token}` } : {};
};

export const getMyDirectThreads = () =>
  api.get("/chats/threads", { headers: authHeader() });

export const getDirectThreadById = (threadId) =>
  api.get(`/chats/threads/${threadId}`, { headers: authHeader() });

export const sendDirectMessage = (otherUserId, payload) =>
  api.post(`/chats/direct/${otherUserId}/messages`, payload, { headers: authHeader() });
