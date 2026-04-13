import { create } from "zustand";

export const useMeetingStore = create((set) => ({
  chatMessages: [],
  reactions: [],

  addChatMessage: (message) =>
    set((state) => ({ chatMessages: [...state.chatMessages, message] })),

  setChatMessages: (messages) => set({ chatMessages: messages || [] }),

  clearChat: () => set({ chatMessages: [] }),

  addReaction: (reaction) =>
    set((state) => ({
      reactions: [
        ...state.reactions,
        {
          ...reaction,
          id: reaction.id || crypto.randomUUID(),
          createdAt: reaction.createdAt || new Date().toISOString(),
        },
      ],
    })),

  removeReaction: (reactionId) =>
    set((state) => ({
      reactions: state.reactions.filter((reaction) => reaction.id !== reactionId),
    })),

  pruneOldReactions: (ttlMs = 7000) =>
    set((state) => ({
      reactions: state.reactions.filter((reaction) => {
        const createdAt = new Date(reaction.createdAt || Date.now()).getTime();
        return Date.now() - createdAt < ttlMs;
      }),
    })),

  clearMeetingState: () => set({ chatMessages: [], reactions: [] }),
}));
