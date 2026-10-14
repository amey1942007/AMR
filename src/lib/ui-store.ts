'use client';
import { create } from 'zustand';

type Dialog = 'menu' | 'contact' | null;
interface UIState {
  dialog: Dialog;
  /** Element that opened the current dialog; focus returns here on close. */
  opener: HTMLElement | null;
  toast: { message: string; key: number } | null;
  openDialog: (d: Exclude<Dialog, null>, opener?: HTMLElement | null) => void;
  closeDialog: () => void;
  showToast: (message: string) => void;
}

export const useUI = create<UIState>((set, get) => ({
  dialog: null,
  opener: null,
  toast: null,
  openDialog: (d, opener) => set({ dialog: d, opener: opener ?? get().opener }),
  closeDialog: () => set({ dialog: null }),
  showToast: (message) => set({ toast: { message, key: Date.now() } }),
}));

/** Non-reactive element registry (focus-return targets). */
export const uiRefs: { menuButton: HTMLButtonElement | null } = { menuButton: null };
