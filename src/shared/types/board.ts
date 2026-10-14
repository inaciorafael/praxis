export type BoardElementKind =
  | 'text'
  | 'note'
  | 'rectangle'
  | 'ellipse'
  | 'frame'
  | 'arrow'
  | 'draw'
  | 'question'
  | 'decision'
  | 'task'
  | 'image'

export type BoardColor = 'neutral' | 'amber' | 'sage' | 'blue' | 'rose' | 'purple'
export type BoardStrokeStyle = 'clean' | 'pencil' | 'pen'
export type BoardTextFont = 'handwritten' | 'sans'
export type BoardTextHighlight = 'none' | 'yellow' | 'green' | 'pink' | 'blue'
export type BoardTextBackground = 'none' | 'rectangle' | 'ellipse'
export type BoardTextAlign = 'left' | 'center' | 'right'
export type BoardTextVerticalAlign = 'top' | 'middle' | 'bottom'
export type BoardPoint = { x: number; y: number }
export type BoardRichRun = {
  text: string
  bold: boolean
  italic: boolean
  underline: boolean
  font: BoardTextFont
  fontSize: number
  color: string
  highlight: BoardTextHighlight
}
export type BoardRichParagraph = {
  align: 'left' | 'center' | 'right'
  list: 'none' | 'bullet' | 'ordered'
  runs: BoardRichRun[]
}
export type BoardRichText = { paragraphs: BoardRichParagraph[] }

export type BoardElement = {
  id: string
  kind: BoardElementKind
  x: number
  y: number
  width: number
  height: number
  angle?: number
  strokeWidth?: number | null
  strokeColor?: string | null
  opacity?: number
  text: string
  color: BoardColor
  strokeStyle?: BoardStrokeStyle
  textFont?: BoardTextFont
  textHighlight?: BoardTextHighlight
  textAutoWidth?: boolean
  textBackground?: BoardTextBackground
  textAlign?: BoardTextAlign
  textVerticalAlign?: BoardTextVerticalAlign
  richText?: BoardRichText | null
  resolved: boolean
  points: BoardPoint[]
  startId: string | null
  endId: string | null
  taskId: string | null
  imageData: string | null
}

export type BoardDocumentKind = 'board' | 'paper'

export type Board = {
  kind?: BoardDocumentKind
  id: string
  title: string
  formatVersion: number
  revision: number
  elements: BoardElement[]
  createdAt: string
  updatedAt: string
}

export type BoardSummary = Omit<Board, 'elements'> & { elementCount: number }
export type CreateBoardInput = {
  title: string
  elements: BoardElement[]
  kind?: BoardDocumentKind
}
export type SaveBoardInput = Omit<CreateBoardInput, 'kind'> & {
  id: string
  expectedRevision: number
}
export type BoardTaskResult = { board: Board; taskId: string }
export type BoardTaskReference = {
  boardId: string
  boardTitle: string
  elementId: string
}
