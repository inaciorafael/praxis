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
}
export type PostitView = { record: Postit; title: string }
export type PostitList = { notes: PostitView[] }
export type PostitChange = {
  id: string
  expectedRevision: number
  title?: string
  body?: string
  pinned?: boolean
  collapsed?: boolean
  completed?: boolean
  color?: PostitColor
  remove?: boolean
}
