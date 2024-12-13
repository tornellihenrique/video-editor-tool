import { create } from 'zustand';

export const useEditorStore = create(set => ({
  scenes: [],

  setScenes: scenes => set({ scenes }),

  updateScene: (index, data) =>
    set(state => {
      const updatedScenes = [...state.scenes];
      updatedScenes[index] = { ...updatedScenes[index], ...data };
      return { scenes: updatedScenes };
    }),
}));
