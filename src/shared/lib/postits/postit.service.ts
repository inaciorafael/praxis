import { invoke, isTauri } from '@tauri-apps/api/core'
import { listen } from '@tauri-apps/api/event'
import type { AppConfig } from '@/shared/types/app'
import type {
  PostitChange,
  PostitList,
  DesktopPostit,
  PostitMode,
  PostitSize,
  PostitGroupChange,
} from '@/shared/types/postit'

export const listPostits = () => invoke<PostitList>('list_postits')
export const changePostit = (change: PostitChange) =>
  invoke<void>('change_postit', { change })
export const getPostitWindow = () =>
  invoke<[DesktopPostit, AppConfig]>('get_postit_window')
export const openPostit = (id: string) => invoke<void>('open_postit', { id })
export const dragPostit = () => invoke<void>('drag_postit')
export const syncPostits = () =>
  isTauri() ? invoke<void>('sync_postits') : Promise.resolve()
export const onPostitsChanged = (callback: () => void) =>
  isTauri() ? listen('praxis://postits-changed', callback) : Promise.resolve(() => {})

export const onPostitError = (callback: (message: string) => void) =>
  isTauri()
    ? listen<string>('praxis://postits-error', (event) => callback(event.payload))
    : Promise.resolve(() => {})

export const presentPostit = (
  mode: PostitMode | null,
  editing = false,
  id: string | null = null
) => invoke<void>('present_postit', { mode, editing, id })
export const resizePostit = (id: string, size: PostitSize) =>
  invoke<void>('resize_postit', { id, ...size })
export const previewPostitSize = (size: PostitSize) =>
  invoke<void>('preview_postit_size', size)
export const changePostitGroup = (change: PostitGroupChange) =>
  invoke<void>('change_postit_group', { change })

export const onPostitFinishRequested = (callback: () => void) =>
  isTauri() ? listen('praxis://postit-finish', callback) : Promise.resolve(() => {})
