import type { ReactElement } from 'react'
import { render } from '@testing-library/react'
import { Provider } from 'react-redux'
import { configureStore } from '@reduxjs/toolkit'
import scriptsReducer from '@/store/slices/scriptsSlice'
import settingsReducer from '@/store/slices/settingsSlice'
import type { RootState } from '@/store'

function renderWithProviders(
  ui: ReactElement,
  { preloadedState }: { preloadedState?: Partial<RootState> } = {},
) {
  const store = configureStore({
    reducer: {
      scripts: scriptsReducer,
      settings: settingsReducer,
    },
    preloadedState,
  })

  return {
    ...render(<Provider store={store}>{ui}</Provider>),
    store,
  }
}

export { renderWithProviders }
