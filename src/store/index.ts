import { configureStore } from '@reduxjs/toolkit'
import scriptsReducer from './slices/scriptsSlice'
import settingsReducer from './slices/settingsSlice'

export const store = configureStore({
  reducer: {
    scripts: scriptsReducer,
    settings: settingsReducer,
  },
  devTools: process.env.NODE_ENV !== 'production',
})

export type RootState = ReturnType<typeof store.getState>
export type AppDispatch = typeof store.dispatch
