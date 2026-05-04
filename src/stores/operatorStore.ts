// src/stores/operatorStore.ts
import { create } from 'zustand'
import type { PendingConfirmation, WaitingEntry } from '@/types'

type SuccessData = {
  type:         'entry' | 'return'
  tokenNumber:  string
  plate:        string
  loadedKg?:    number
  emptyKg?:     number
  netLoadKg?:   number
  weightKg?:    number
}

interface OperatorStore {
  activePending:      PendingConfirmation | null
  setActivePending:   (p: PendingConfirmation | null) => void

  showReturnModal:    boolean
  openReturnModal:    () => void
  closeReturnModal:   () => void

  showDismissModal:   boolean
  setShowDismissModal:(v: boolean) => void

  selectedEntry:      WaitingEntry | null
  setSelectedEntry:   (e: WaitingEntry | null) => void

  successData:        SuccessData | null
  showSuccess:        (data: SuccessData) => void
  clearSuccess:       () => void

  editedPlate:        string
  editedWeight:       string
  setEditedPlate:     (v: string) => void
  setEditedWeight:    (v: string) => void
  resetEdits:         () => void
}

export const useOperatorStore = create<OperatorStore>((set) => ({
  activePending:      null,
  setActivePending:   (p) => set({ activePending: p }),

  showReturnModal:    false,
  openReturnModal:    () => set({ showReturnModal: true }),
  closeReturnModal:   () => set({ showReturnModal: false, selectedEntry: null }),

  showDismissModal:   false,
  setShowDismissModal: (v) => set({ showDismissModal: v }),

  selectedEntry:      null,
  setSelectedEntry:   (e) => set({ selectedEntry: e }),

  successData:        null,
  showSuccess:        (data) => set({ successData: data }),
  clearSuccess:       () => set({ successData: null }),

  editedPlate:        '',
  editedWeight:       '',
  setEditedPlate:     (v) => set({ editedPlate: v }),
  setEditedWeight:    (v) => set({ editedWeight: v }),
  resetEdits:         () => set({ editedPlate: '', editedWeight: '' }),
}))