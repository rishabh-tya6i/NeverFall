import {create} from 'zustand';

interface ProfileState {
  activeTab: string;
  setActiveTab: (tab: string) => void;
}

export const useProfileStore = create<ProfileState>((set) => ({
  activeTab: 'overview',
  setActiveTab: (tab) => set({ activeTab: tab }),
}));
