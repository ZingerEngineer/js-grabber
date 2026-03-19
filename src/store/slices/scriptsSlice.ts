import { createSlice } from '@reduxjs/toolkit'
import type { PayloadAction } from '@reduxjs/toolkit'
import type { RootState } from '@/store'
import type { CapturedScript } from '@/types'

interface ScriptsState {
  items: CapturedScript[]
  selectedId: string | null
  status: 'idle' | 'loading' | 'error'
  error: string | null
}

const initialState: ScriptsState = {
  items: [],
  selectedId: null,
  status: 'idle',
  error: null,
}

export const scriptsSlice = createSlice({
  name: 'scripts',
  initialState,
  reducers: {
    scriptCaptured: (state, action: PayloadAction<CapturedScript>) => {
      // Deduplicate by URL — same script can fire multiple network events
      const exists = state.items.some((s) => s.url === action.payload.url)
      if (!exists) {
        state.items.push(action.payload)
      }
    },
    scriptSelected: (state, action: PayloadAction<string | null>) => {
      state.selectedId = action.payload
    },
    scriptsCleared: (state) => {
      state.items = []
      state.selectedId = null
    },
  },
})

export const { scriptCaptured, scriptSelected, scriptsCleared } = scriptsSlice.actions

// Selectors — always use these, never access state.scripts.* directly in components.
export const selectAllScripts = (state: RootState): CapturedScript[] => state.scripts.items
export const selectSelectedId = (state: RootState): string | null => state.scripts.selectedId
export const selectScriptCount = (state: RootState): number => state.scripts.items.length
export const selectScriptById =
  (id: string) =>
  (state: RootState): CapturedScript | undefined =>
    state.scripts.items.find((s) => s.id === id)

export default scriptsSlice.reducer
