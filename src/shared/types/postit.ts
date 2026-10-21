export type PostitMode = 'micro' | 'compact' | 'expanded'
export type PostitSize = { width: number; height: number }
export type PostitGroup = { id: string; name: string; revision: number }
export type DesktopPostit = { notes: PostitView[]; group: PostitGroup | null }
export type PostitGroupChange = {
  id: string
  expectedRevision: number
  name?: string
  members?: { id: string; revision: number }[]
  ungroup?: boolean
}
export type PostitColor = 'yellow' | 'pink' | 'green' | 'blue'
export type Postit = {
  id: string
  title: string
  body: string
  revision: number
  pinned: boolean
  collapsed: boolean
  completedAt?: number | null
  archived: boolean
  color: PostitColor
  preferredMode?: PostitMode | null
  modeLocked?: boolean
  expandedSize?: PostitSize | null
  groupId?: string | null
}
export type PostitView = { record: Postit; title: string }
export type PostitList = { notes: PostitView[]; groups?: PostitGroup[] }
export type PostitChange = {
  id: string
  expectedRevision: number
  title?: string
  body?: string
  pinned?: boolean
  collapsed?: boolean
  completed?: boolean
  color?: PostitColor
  preferredMode?: PostitMode
  modeLocked?: boolean
  expandedSize?: PostitSize
  remove?: boolean
}
