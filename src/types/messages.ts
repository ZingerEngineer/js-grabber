import type { CapturedScript, CaptureSettings } from './index'

export type ExtensionMessage =
  | { type: 'SCRIPT_CAPTURED'; payload: CapturedScript }
  | { type: 'DOWNLOAD_SCRIPT'; payload: { id: string } }
  | { type: 'DOWNLOAD_ALL' }
  | { type: 'CLEAR_SCRIPTS' }
  | { type: 'GET_SETTINGS' }
  | { type: 'UPDATE_SETTINGS'; payload: Partial<CaptureSettings> }

export type MessageResponse<T = void> =
  | { success: true; data: T }
  | { success: false; error: string }
