export type BoardElementKind =
  | 'text'
  | 'note'
  | 'rectangle'
  | 'ellipse'
  | 'triangle'
  | 'hexagon'
  | 'line'
  | 'frame'
  | 'arrow'
  | 'draw'
  | 'question'
  | 'decision'
  | 'task'
  | 'image'
  | 'iframe' // Legacy reference only; embedding and insertion were discontinued.

export type BoardConnectorStyle = 'straight' | 'elbow' | 'curve'
export type BoardColor = 'neutral' | 'amber' | 'sage' | 'blue' | 'rose' | 'purple'
export type BoardStrokeStyle = 'clean' | 'pencil' | 'pen'
export type BoardSketchOptions = {
  strokePattern: 'solid' | 'dashed' | 'dotted'
  roughness: number
  bowing: number
  hachureAngle: number
  hachureGap: number
}
export type BoardFillStyle = 'solid' | 'hachure' | 'cross-hatch' | 'dots' | 'zigzag'
export type BoardDrawBrush =
  | 'graphite'
  | 'fountain'
  | 'ink'
  | 'charcoal'
  | 'marker'
  | 'watercolor'
  | 'spray'
export type BoardTextFont = 'handwritten' | 'sans'
export type BoardTextHighlight = 'none' | 'yellow' | 'green' | 'pink' | 'blue'
export type BoardAnnotationType =
  | 'underline'
  | 'box'
  | 'circle'
  | 'highlight'
  | 'strike-through'
  | 'crossed-off'
  | 'bracket'
export type BoardAnnotationSide = 'top' | 'right' | 'bottom' | 'left'
export type BoardTextAnnotation = {
  type: BoardAnnotationType
  color: string
  strokeWidth: number
  padding: number | [number, number] | [number, number, number, number]
  iterations: number
  brackets: BoardAnnotationSide[]
  animate: boolean
  animationDuration: number
  animationDelay: number
  multiline: boolean
  rtl: boolean
}
export type BoardTextBackground = 'none' | 'rectangle' | 'ellipse'
export type BoardTextAlign = 'left' | 'center' | 'right'
export type BoardTextVerticalAlign = 'top' | 'middle' | 'bottom'
export type BoardPoint = { x: number; y: number; pressure?: number }
export type BoardRichRun = {
  text: string
  bold: boolean
  italic: boolean
  underline: boolean
  font: BoardTextFont
  fontSize: number
  color: string
  highlight: BoardTextHighlight
  annotation?: BoardTextAnnotation | null
}
export type BoardRichParagraph = {
  align: 'left' | 'center' | 'right'
  list: 'none' | 'bullet' | 'ordered'
  runs: BoardRichRun[]
}
export type BoardRichText = { paragraphs: BoardRichParagraph[] }

export type BoardElement = {
  id: string
  layerId?: string | null
  groupId?: string | null
  kind: BoardElementKind
  x: number
  y: number
  width: number
  height: number
  angle?: number
  strokeWidth?: number | null
  strokeColor?: string | null
  fillColor?: string | null
  fillStyle?: BoardFillStyle | null
  sketch?: BoardSketchOptions | null
  opacity?: number
  text: string
  color: BoardColor
  strokeStyle?: BoardStrokeStyle
  drawBrush?: BoardDrawBrush | null
  textFont?: BoardTextFont
  textHighlight?: BoardTextHighlight
  textAnnotation?: BoardTextAnnotation | null
  textAutoWidth?: boolean
  textBackground?: BoardTextBackground
  textAlign?: BoardTextAlign
  textVerticalAlign?: BoardTextVerticalAlign
  richText?: BoardRichText | null
  resolved: boolean
  points: BoardPoint[]
  connectorStyle?: BoardConnectorStyle
  startId: string | null
  endId: string | null
  taskId: string | null
  imageData: string | null
}

export type BoardDocumentKind = 'board' | 'paper'
export type BoardLayer = {
  id: string
  name: string
  visible: boolean
  locked: boolean
  opacity: number
}
export type PaperBackground = 'plain' | 'grid' | 'ruled' | 'dots'
export type PaperColorScheme = 'light' | 'dark'
export type PaperAppearance = {
  background: PaperBackground
  colorScheme: PaperColorScheme
}

export type BoardScene = {
  id: string
  title: string
  x: number
  y: number
  width: number
  height: number
  aspectRatio: '16:9' | '4:3' | 'free'
}

export type Board = {
  locked?: boolean
  background?: PaperBackground
  colorScheme?: PaperColorScheme
  kind?: BoardDocumentKind
  id: string
  title: string
  formatVersion: number
  revision: number
  elements: BoardElement[]
  scenes?: BoardScene[]
  layers?: BoardLayer[]
  createdAt: string
  updatedAt: string
}

export type BoardSummary = Omit<Board, 'elements' | 'scenes' | 'layers'> & {
  elementCount: number
}
export type CreateBoardInput = {
  background?: PaperBackground
  colorScheme?: PaperColorScheme
  title: string
  elements: BoardElement[]
  scenes?: BoardScene[]
  layers?: BoardLayer[]
  kind?: BoardDocumentKind
}
export type SaveBoardInput = Omit<CreateBoardInput, 'kind'> & {
  locked?: boolean
  id: string
  expectedRevision: number
}
export type BoardTaskResult = { board: Board; taskId: string }
export type BoardTaskReference = {
  boardId: string
  boardTitle: string
  elementId: string
}
