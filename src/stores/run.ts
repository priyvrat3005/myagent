import { create } from 'zustand';
import type { Run, RunStep, StreamEvent } from '../types';

interface RunState {
  currentRun: Run | null;
  steps: RunStep[];
  totalCost: number;
  totalTokens: number;
  costCeiling: number;
  isLive: boolean;
  
  setCurrentRun: (run: Run | null) => void;
  addStep: (step: RunStep) => void;
  setSteps: (steps: RunStep[]) => void;
  updateSpend: (cost: number, tokens: number) => void;
  setLive: (live: boolean) => void;
  reset: () => void;
}

export const useRunStore = create<RunState>((set) => ({
  currentRun: null,
  steps: [],
  totalCost: 0,
  totalTokens: 0,
  costCeiling: 0.50,
  isLive: false,
  
  setCurrentRun: (run) => set({ currentRun: run }),
  addStep: (step) => set(state => ({ steps: [...state.steps, step] })),
  setSteps: (steps) => set({ steps }),
  updateSpend: (cost, tokens) => set({ totalCost: cost, totalTokens: tokens }),
  setLive: (live) => set({ isLive: live }),
  reset: () => set({ currentRun: null, steps: [], totalCost: 0, totalTokens: 0, isLive: false }),
}));
