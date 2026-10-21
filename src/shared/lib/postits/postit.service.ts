import { invoke, isTauri } from '@tauri-apps/api/core'
import { listen } from '@tauri-apps/api/event'
import type { AppConfig } from '@/shared/types/app'
import type { PostitChange, PostitList, PostitView } from '@/shared/types/postit'

export const listPostits = () => invoke<PostitList>('list_postits')
export const changePostit = (change: PostitChange) =>
  invoke<void>('change_postit', { change })
export const getPostitWindow = () => invoke<[PostitView, AppConfig]>('get_postit_window')
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
