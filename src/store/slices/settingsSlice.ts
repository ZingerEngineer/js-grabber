import { createSlice } from '@reduxjs/toolkit'
import type { PayloadAction } from '@reduxjs/toolkit'
import type { RootState } from '@/store'
import type { CaptureSettings } from '@/types'

const initialState: CaptureSettings = {
  autoCapture: true,
  includeInline: false,
  excludePatterns: ['chrome-extension://', 'devtools://'],
  maxFileSizeBytes: 10 * 1024 * 1024, // 10 MB
}

export const settingsSlice = createSlice({
  name: 'settings',
  initialState,
  reducers: {
    settingsUpdated: (state, action: PayloadAction<Partial<CaptureSettings>>) => {
      return { ...state, ...action.payload }
    },
    settingsReset: () => initialState,
  },
})

export const { settingsUpdated, settingsReset } = settingsSlice.actions

// Selectors
export const selectSettings = (state: RootState): CaptureSettings => state.settings
export const selectAutoCapture = (state: RootState): boolean => state.settings.autoCapture

export default settingsSlice.reducer
