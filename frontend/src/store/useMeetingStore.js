import { create } from "zustand";

export const useMeetingStore = create((set) => ({
  chatMessages: [],
  reactions: [],

  addChatMessage: (message) =>
    set((state) => ({ chatMessages: [...state.chatMessages, message] })),

  clearChat: () => set({ chatMessages: [] }),

  addReaction: (reaction) =>
    set((state) => ({
      reactions: [
        ...state.reactions,
        { ...reaction, id: reaction.id || crypto.randomUUID() },
      ],
    })),

  removeReaction: (reactionId) =>
    set((state) => ({
      reactions: state.reactions.filter((reaction) => reaction.id !== reactionId),
    })),

  clearMeetingState: () => set({ chatMessages: [], reactions: [] }),
}));
