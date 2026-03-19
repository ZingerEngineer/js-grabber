import { useDispatch, useSelector } from 'react-redux'
import type { RootState, AppDispatch } from './index'

// Typed hooks — always use these instead of raw useDispatch / useSelector.
export const useAppDispatch = useDispatch.withTypes<AppDispatch>()
export const useAppSelector = useSelector.withTypes<RootState>()
