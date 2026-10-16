import { mount } from '@vue/test-utils'
import { createI18n } from 'vue-i18n'
import { nextTick } from 'vue'
import { describe, expect, it, vi } from 'vitest'
import BoardCanvas from './BoardCanvas.vue'
import BoardRichTextEditor from './BoardRichTextEditor.vue'
import { plainToRich } from '../lib/rich-text'
import { defaultAnnotation } from '../lib/notation'
import type { BoardElement } from '@/shared/types/board'
vi.mock('@/shared/lib/boards/board-export.service', () => ({ saveBoardPng: vi.fn() }))
vi.mock('../lib/artistic-brush', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../lib/artistic-brush')>()),
  renderArtisticBrush: vi.fn(async () => null),
  cachedArtisticBrush: vi.fn(() => undefined),
  releaseArtisticBrushes: vi.fn(),
}))
async function pointer(
  element: Element,
  type: string,
  pointerId: number,
  clientX: number,
  clientY: number,
  modifiers: MouseEventInit & { pressure?: number; pointerType?: string } = {}
) {
  const event = new MouseEvent(type, {
    bubbles: true,
    button: 0,
    clientX,
    clientY,
    ...modifiers,
  })
  Object.defineProperty(event, 'pointerId', { value: pointerId })
  if (modifiers.pressure !== undefined)
    Object.defineProperty(event, 'pressure', { value: modifiers.pressure })
  if (modifiers.pointerType !== undefined)
    Object.defineProperty(event, 'pointerType', { value: modifiers.pointerType })
  element.dispatchEvent(event)
  await nextTick()
}

const mountCanvas = (elements: BoardElement[] = []) =>
  mount(BoardCanvas, {
    props: { elements },
    global: {
      plugins: [
        createI18n({
          legacy: false,
          locale: 'en',
          missingWarn: false,
          fallbackWarn: false,
          messages: { en: {} },
        }),
      ],
    },
  })
const note: BoardElement = {
  id: 'note',
  kind: 'note',
  x: 10,
  y: 10,
  width: 180,
  height: 120,
  text: 'Before',
  color: 'neutral',
  resolved: false,
  points: [],
  startId: null,
  endId: null,
  taskId: null,
  imageData: null,
}
describe('board canvas interactions', () => {
  it('undoes and redoes a completed text edit from a reopened editor', async () => {
    const wrapper = mountCanvas([note])
    document.body.appendChild(wrapper.element)
    await wrapper.get('[data-element-id]').trigger('dblclick')
    wrapper
      .getComponent(BoardRichTextEditor)
      .vm.$emit('update:modelValue', plainToRich('After', note))
    wrapper.getComponent(BoardRichTextEditor).vm.$emit('finish')
    await nextTick()
    await wrapper.get('[data-element-id]').trigger('dblclick')
    const undo = wrapper.get('button[aria-label="boards.undo"]')
    expect(undo.attributes('disabled')).toBeUndefined()
    await undo.trigger('click')
    expect(wrapper.findComponent(BoardRichTextEditor).exists()).toBe(false)
    expect(document.activeElement).toBe(wrapper.get('.board-viewport').element)
    expect((wrapper.emitted('change')!.slice(-1)[0]![0] as BoardElement[])[0]!.text).toBe(
      'Before'
    )
    await wrapper.get('[data-element-id]').trigger('dblclick')
    expect(
      wrapper.get('button[aria-label="boards.redo"]').attributes('disabled')
    ).toBeUndefined()
    await wrapper
      .get('[contenteditable]')
      .trigger('keydown', { key: 'z', ctrlKey: true, shiftKey: true })
    expect(wrapper.findComponent(BoardRichTextEditor).exists()).toBe(false)
    expect((wrapper.emitted('change')!.slice(-1)[0]![0] as BoardElement[])[0]!.text).toBe(
      'After'
    )
    wrapper.unmount()
  })
  it('retains undo and redo after an autosave echo with floating-point roundoff', async () => {
    const wrapper = mountCanvas()
    await wrapper.get('[data-tool="draw"]').trigger('click')
    const viewport = wrapper.get('.board-viewport')
    await pointer(viewport.element, 'pointerdown', 1, 123.456789, 98.7654321)
    await pointer(viewport.element, 'pointermove', 1, 254.1234567, 186.9876543)
    await pointer(viewport.element, 'pointerup', 1, 254.1234567, 186.9876543)
    const created = wrapper.emitted('change')!.slice(-1)[0]![0] as BoardElement[]
    const saved = JSON.parse(JSON.stringify(created)) as BoardElement[]
    saved[0]!.x += Number.EPSILON * Math.max(1, Math.abs(saved[0]!.x))
    saved[0]!.points[0]!.x += Number.EPSILON
    await wrapper.setProps({ elements: saved })
    expect(wrapper.get('[data-board-undo]').attributes('disabled')).toBeUndefined()
    await wrapper.get('[data-board-undo]').trigger('click')
    expect(wrapper.findAll('[data-element-id]')).toHaveLength(0)
    await wrapper.setProps({ elements: [] })
    expect(wrapper.get('[data-board-redo]').attributes('disabled')).toBeUndefined()
    await viewport.trigger('keydown', { key: 'z', ctrlKey: true, shiftKey: true })
    expect(wrapper.findAll('[data-element-id]')).toHaveLength(1)
    wrapper.unmount()
  })
  it('separates instrument choice from settings and dismisses panels on selection, Escape and drawing', async () => {
    const wrapper = mountCanvas()
    await wrapper.get('[data-tool="pan"]').trigger('click')
    await wrapper.get('[data-brush-library]').trigger('click')
    expect(wrapper.get('[data-tool="pan"]').attributes('aria-pressed')).toBe('true')
    expect(wrapper.find('[data-brush-width]').exists()).toBe(false)
    await wrapper.get('[data-paper-brush="ink"]').trigger('click')
    expect(wrapper.get('.board-style-panel').isVisible()).toBe(false)
    expect(wrapper.get('[data-brush-library]').attributes('aria-expanded')).toBe('false')
    await wrapper.get('[data-tool-settings]').trigger('click')
    expect(wrapper.get('.board-style-panel').attributes('style')).not.toContain(
      'display: none'
    )
    expect(wrapper.find('[data-brush-width]').exists()).toBe(true)
    expect(wrapper.find('[data-paper-brush]').exists()).toBe(false)
    expect(wrapper.find('[data-stroke-style]').exists()).toBe(false)
    await wrapper.get('.board-style-panel').trigger('keydown', { key: 'Escape' })
    expect(wrapper.get('.board-style-panel').isVisible()).toBe(false)
    await wrapper.get('[data-brush-library]').trigger('click')
    await wrapper.get('[data-base-tool="draw"]').trigger('click')
    expect(wrapper.get('[data-tool="draw"]').attributes('aria-pressed')).toBe('true')
    expect(wrapper.get('.board-style-panel').isVisible()).toBe(false)
    await wrapper.get('[data-tool-settings]').trigger('click')
    const viewport = wrapper.get('.board-viewport')
    await pointer(viewport.element, 'pointerdown', 1, 300, 300)
    expect(wrapper.get('.board-style-panel').isVisible()).toBe(false)
    await pointer(viewport.element, 'pointermove', 1, 360, 340)
    await pointer(viewport.element, 'pointerup', 1, 360, 340)
    expect(wrapper.emitted('interact')).toHaveLength(1)
    await wrapper.get('[data-tool-settings]').trigger('click')
    document.dispatchEvent(new Event('pointerdown', { bubbles: true }))
    await nextTick()
    expect(wrapper.get('.board-style-panel').isVisible()).toBe(false)
    wrapper.unmount()
  })
  it('treats a new text box and its first text as one undoable action without restoring empty boxes', async () => {
    const wrapper = mountCanvas()
    const viewport = wrapper.get('.board-viewport')
    await wrapper.get('[data-tool="text"]').trigger('click')
    await pointer(viewport.element, 'pointerdown', 1, 300, 250)
    await pointer(viewport.element, 'pointerup', 1, 300, 250)
    expect(wrapper.emitted('change')).toBeUndefined()
    expect(wrapper.find('.board-history').exists()).toBe(false)
    wrapper
      .getComponent(BoardRichTextEditor)
      .vm.$emit('update:modelValue', plainToRich('First idea', note))
    wrapper.getComponent(BoardRichTextEditor).vm.$emit('finish')
    await nextTick()
    expect(wrapper.findAll('[data-element-id]')).toHaveLength(1)
    await wrapper.get('[data-board-undo]').trigger('click')
    expect(wrapper.findAll('[data-element-id]')).toHaveLength(0)
    expect(wrapper.get('[data-board-undo]').attributes('disabled')).toBeDefined()
    await wrapper.get('[data-board-redo]').trigger('click')
    expect((wrapper.emitted('change')!.slice(-1)[0]![0] as BoardElement[])[0]!.text).toBe(
      'First idea'
    )
    wrapper.unmount()
  })
  it('cancels an empty new text draft without adding an undo step', async () => {
    const wrapper = mountCanvas()
    const viewport = wrapper.get('.board-viewport')
    await wrapper.get('[data-tool="text"]').trigger('click')
    await pointer(viewport.element, 'pointerdown', 1, 300, 250)
    await pointer(viewport.element, 'pointerup', 1, 300, 250)
    wrapper.getComponent(BoardRichTextEditor).vm.$emit('cancel')
    await nextTick()
    expect(wrapper.findAll('[data-element-id]')).toHaveLength(0)
    expect(wrapper.emitted('change')).toBeUndefined()
    expect(wrapper.get('[data-board-undo]').attributes('disabled')).toBeDefined()
    wrapper.unmount()
  })
  it('keeps undo and redo after a save acknowledgement with Rust defaults and reordered properties', async () => {
    const wrapper = mountCanvas([{ ...note, kind: 'rectangle' }])
    const viewport = wrapper.get('.board-viewport')
    await pointer(wrapper.get('[data-element-id]').element, 'pointerdown', 1, 70, 70)
    await pointer(viewport.element, 'pointerup', 1, 70, 70)
    await wrapper.get('[data-fill-preset="#d8eaff"]').trigger('click')
    const saved = (wrapper.emitted('change')!.slice(-1)[0]![0] as BoardElement[]).map(
      (element) =>
        ({
          angle: 0,
          opacity: 1,
          strokeStyle: 'clean' as const,
          textFont: 'sans' as const,
          textHighlight: 'none' as const,
          textBackground: 'none' as const,
          textAlign: 'left' as const,
          textVerticalAlign: 'top' as const,
          textAutoWidth: false,
          ...Object.fromEntries(Object.entries(element).reverse()),
        }) as BoardElement
    )
    await wrapper.setProps({ elements: saved })
    expect(wrapper.get('[data-board-undo]').attributes('disabled')).toBeUndefined()
    await wrapper.get('[data-board-undo]').trigger('click')
    expect(
      (wrapper.emitted('change')!.slice(-1)[0]![0] as BoardElement[])[0]!.fillColor
    ).toBeUndefined()
    await wrapper.get('[data-board-redo]').trigger('click')
    expect(
      (wrapper.emitted('change')!.slice(-1)[0]![0] as BoardElement[])[0]!.fillColor
    ).toBe('#d8eaff')
    await wrapper.setProps({
      elements: saved.map((element) => ({ ...element, text: 'External edit' })),
    })
    expect(wrapper.get('[data-board-undo]').attributes('disabled')).toBeDefined()
    expect(wrapper.get('[data-board-redo]').attributes('disabled')).toBeDefined()
    wrapper.unmount()
  })
  it('restores nested font and highlight changes, redoes them, and drops redo after a new edit', async () => {
    const richText = plainToRich('Before', note)
    richText.paragraphs[0]!.runs[0]!.highlight = 'pink'
    const wrapper = mountCanvas([{ ...note, richText }])
    const viewport = wrapper.get('.board-viewport')
    const selectNote = async () => {
      await pointer(wrapper.get('[data-element-id]').element, 'pointerdown', 1, 70, 70)
      await pointer(viewport.element, 'pointerup', 1, 70, 70)
    }
    const last = () => (wrapper.emitted('change')!.slice(-1)[0]![0] as BoardElement[])[0]!
    expect(wrapper.get('[data-board-undo]').attributes('disabled')).toBeDefined()
    expect(wrapper.get('[data-board-redo]').attributes('disabled')).toBeDefined()
    await selectNote()
    await wrapper.get('[data-text-font="handwritten"]').trigger('click')
    expect(last().richText!.paragraphs[0]!.runs[0]!.font).toBe('handwritten')
    expect(richText.paragraphs[0]!.runs[0]!.font).toBe('sans')
    await wrapper.get('[data-board-undo]').trigger('click')
    expect(last().richText!.paragraphs[0]!.runs[0]!.font).toBe('sans')
    expect(wrapper.get('[data-board-redo]').attributes('disabled')).toBeUndefined()
    await wrapper.get('[data-board-redo]').trigger('click')
    expect(last().richText!.paragraphs[0]!.runs[0]!.font).toBe('handwritten')
    await selectNote()
    wrapper
      .findComponent({ name: 'BoardAnnotationControls' })
      .vm.$emit('update:modelValue', defaultAnnotation('highlight'))
    await nextTick()
    expect(last().richText!.paragraphs[0]!.runs[0]!.highlight).toBe('none')
    await wrapper.get('[data-board-undo]').trigger('click')
    expect(last().richText!.paragraphs[0]!.runs[0]!.highlight).toBe('pink')
    await selectNote()
    await wrapper.get('[data-text-font="sans"]').trigger('click')
    expect(wrapper.get('[data-board-redo]').attributes('disabled')).toBeDefined()
    const count = wrapper.emitted('change')!.length
    await viewport.trigger('keydown', { key: 'y', ctrlKey: true })
    expect(wrapper.emitted('change')).toHaveLength(count)
    wrapper.unmount()
  })
  it('handles undo and redo while the tool palette has focus', async () => {
    const wrapper = mountCanvas()
    const viewport = wrapper.get('.board-viewport')
    await wrapper.get('[data-tool="rectangle"]').trigger('click')
    await pointer(viewport.element, 'pointerdown', 1, 250, 250)
    await pointer(viewport.element, 'pointermove', 1, 400, 350)
    await pointer(viewport.element, 'pointerup', 1, 400, 350)
    expect(wrapper.findAll('[data-element-id]')).toHaveLength(1)
    await wrapper
      .get('[data-tool="select"]')
      .trigger('keydown', { key: 'z', ctrlKey: true })
    expect(wrapper.findAll('[data-element-id]')).toHaveLength(0)
    await wrapper
      .get('[data-tool="select"]')
      .trigger('keydown', { key: 'z', ctrlKey: true, shiftKey: true })
    expect(wrapper.findAll('[data-element-id]')).toHaveLength(1)
    wrapper.unmount()
  })
  it('requests the whole Paper lock from the tool palette', async () => {
    const wrapper = mountCanvas([note])
    await wrapper.get('[data-lock-paper]').trigger('click')
    expect(wrapper.emitted('lockPaper')).toHaveLength(1)
    expect(wrapper.emitted('change')).toBeUndefined()
    wrapper.unmount()
  })
  it('keeps locked content unchanged through drags, editing commands and shortcuts while allowing camera movement', async () => {
    const wrapper = mountCanvas([note])
    await wrapper.setProps({ readOnly: true })
    const viewport = wrapper.get('.board-viewport')
    expect(wrapper.find('[data-tool]').exists()).toBe(false)
    expect(wrapper.find('[data-resize]').exists()).toBe(false)
    expect(wrapper.find('[data-rotate]').exists()).toBe(false)
    expect(wrapper.find('.board-lock-hint').exists()).toBe(true)
    const before = wrapper.get('[data-scene]').attributes('transform')
    await pointer(wrapper.get('[data-element-id]').element, 'pointerdown', 1, 100, 100)
    await pointer(viewport.element, 'pointermove', 1, 150, 160)
    await pointer(viewport.element, 'pointerup', 1, 150, 160)
    expect(wrapper.get('[data-scene]').attributes('transform')).not.toBe(before)
    await wrapper.get('[data-element-id]').trigger('dblclick')
    wrapper.vm.editText(note.id)
    await nextTick()
    expect(wrapper.findComponent(BoardRichTextEditor).exists()).toBe(false)
    for (const key of ['Delete', 'Backspace', 'ArrowRight', 'Enter', 'p', 't'])
      await viewport.trigger('keydown', { key })
    for (const key of ['a', 'd', 'z', 'y'])
      await viewport.trigger('keydown', { key, ctrlKey: true })
    expect(wrapper.findAll('[data-element-id]')).toHaveLength(1)
    expect(wrapper.emitted('change')).toBeUndefined()
    const panned = wrapper.get('[data-scene]').attributes('transform')
    await viewport.trigger('keydown', { key: '+', ctrlKey: true })
    expect(wrapper.get('[data-scene]').attributes('transform')).not.toBe(panned)
    wrapper.unmount()
  })
  it('cancels an unfinished gesture when locking and resumes editing after unlock', async () => {
    const wrapper = mountCanvas([note])
    const viewport = wrapper.get('.board-viewport')
    await wrapper.get('[data-tool="pen"]').trigger('click')
    await pointer(viewport.element, 'pointerdown', 1, 300, 300)
    await pointer(viewport.element, 'pointermove', 1, 360, 340)
    expect(wrapper.findAll('[data-element-id]')).toHaveLength(2)
    await wrapper.setProps({ readOnly: true })
    await pointer(viewport.element, 'pointerup', 1, 360, 340)
    expect(wrapper.findAll('[data-element-id]')).toHaveLength(1)
    expect(wrapper.emitted('change')).toBeUndefined()
    await wrapper.setProps({ readOnly: false })
    await wrapper.get('[data-tool="pen"]').trigger('click')
    await pointer(viewport.element, 'pointerdown', 2, 300, 300)
    await pointer(viewport.element, 'pointermove', 2, 360, 340)
    await pointer(viewport.element, 'pointerup', 2, 360, 340)
    expect(wrapper.emitted('change')![0]![0] as BoardElement[]).toHaveLength(2)
    wrapper.unmount()
  })
  it.each(['draw', 'pen', 'graphite', 'fountain', 'ink'])(
    'keeps resize and rotation handles out of the way while drawing with %s',
    async (material) => {
      const wrapper = mountCanvas()
      if (['graphite', 'fountain', 'ink'].includes(material)) {
        await wrapper.get('[data-brush-library]').trigger('click')
        await wrapper.get(`[data-paper-brush="${material}"]`).trigger('click')
      } else await wrapper.get(`[data-tool="${material}"]`).trigger('click')
      const viewport = wrapper.get('.board-viewport')
      await pointer(viewport.element, 'pointerdown', 1, 300, 300)
      await pointer(viewport.element, 'pointermove', 1, 360, 340)
      expect(wrapper.find('[data-resize]').exists()).toBe(false)
      expect(wrapper.find('[data-rotate]').exists()).toBe(false)
      await pointer(viewport.element, 'pointerup', 1, 360, 340)
      expect(wrapper.find('.paper-element-controls').exists()).toBe(false)
      expect(wrapper.find('.paper-selection-bar').exists()).toBe(false)
      const first = structuredClone(
        (wrapper.emitted('change')!.slice(-1)[0]![0] as BoardElement[])[0]!
      )
      expect(wrapper.find('[data-resize]').exists()).toBe(false)
      expect(wrapper.find('[data-rotate]').exists()).toBe(false)
      // Begin the next stroke exactly where the previous corner handle would be.
      await pointer(viewport.element, 'pointerdown', 2, 360, 340)
      await pointer(viewport.element, 'pointermove', 2, 400, 370)
      await pointer(viewport.element, 'pointerup', 2, 400, 370)
      const scene = wrapper.emitted('change')!.slice(-1)[0]![0] as BoardElement[]
      expect(scene).toHaveLength(2)
      expect(scene[0]).toEqual(first)
      await wrapper.get('[data-tool="select"]').trigger('click')
      expect(wrapper.find('[data-resize]').exists()).toBe(true)
      expect(wrapper.find('[data-rotate]').exists()).toBe(true)
      wrapper.unmount()
    }
  )
  it('scales text fonts through corner handles, commits once, and restores them with undo', async () => {
    const richText = plainToRich('Before', note)
    richText.paragraphs[0]!.runs[0]!.fontSize = 22
    const wrapper = mountCanvas([
      { ...note, kind: 'text', richText, textAutoWidth: false },
    ])
    const viewport = wrapper.get('.board-viewport')
    await pointer(wrapper.get('[data-element-id]').element, 'pointerdown', 1, 70, 70)
    await pointer(viewport.element, 'pointerup', 1, 70, 70)
    const transform = wrapper
      .get('[data-scene]')
      .attributes('transform')!
      .match(/-?\d+(?:\.\d+)?/g)!
      .map(Number)
    const screen = (x: number, y: number) =>
      [x * transform[2]! + transform[0]!, y * transform[2]! + transform[1]!] as const
    const start = screen(190, 130),
      end = screen(280, 190)
    await pointer(
      wrapper.get('[data-resize-handle="se"]').element,
      'pointerdown',
      2,
      ...start
    )
    await pointer(viewport.element, 'pointermove', 2, ...end)
    expect(wrapper.emitted('change')).toBeUndefined()
    expect(wrapper.get('[data-element-id] text').attributes('font-size')).toBe('33')
    await pointer(viewport.element, 'pointerup', 2, ...end)
    const resized = (wrapper.emitted('change')![0]![0] as BoardElement[])[0]!
    expect(resized.richText!.paragraphs[0]!.runs[0]!.fontSize).toBe(33)
    expect(resized.width).toBe(270)
    await viewport.trigger('keydown', { key: 'z', ctrlKey: true })
    expect(
      (wrapper.emitted('change')!.slice(-1)[0]![0] as BoardElement[])[0]!.richText!
        .paragraphs[0]!.runs[0]!.fontSize
    ).toBe(22)
    wrapper.unmount()
  })
  it('shows fountain ink before release and consumes coalesced pen samples without changing the finish', async () => {
    const wrapper = mountCanvas()
    await wrapper.get('[data-brush-library]').trigger('click')
    await wrapper.get('[data-paper-brush="fountain"]').trigger('click')
    const viewport = wrapper.get('.board-viewport')
    await pointer(viewport.element, 'pointerdown', 1, 300, 300, {
      pointerType: 'pen',
      pressure: 0.2,
    })
    const move = new MouseEvent('pointermove', {
      bubbles: true,
      clientX: 360,
      clientY: 340,
    })
    Object.defineProperty(move, 'pointerId', { value: 1 })
    Object.defineProperty(move, 'getCoalescedEvents', {
      value: () => [
        { clientX: 330, clientY: 320, pointerType: 'pen', pressure: 0.45 },
        { clientX: 360, clientY: 340, pointerType: 'pen', pressure: 0.9 },
      ],
    })
    viewport.element.dispatchEvent(move)
    await nextTick()
    const paths = wrapper
      .findAll('[data-writing-ink]')
      .map((path) => path.attributes('d'))
    expect(paths.length).toBeGreaterThan(0)
    expect(wrapper.emitted('change')).toBeUndefined()
    await pointer(viewport.element, 'pointerup', 1, 360, 340, {
      pointerType: 'pen',
      pressure: 0,
    })
    expect(
      wrapper.findAll('[data-writing-ink]').map((path) => path.attributes('d'))
    ).toEqual(paths)
    const drawn = (wrapper.emitted('change')!.slice(-1)[0]![0] as BoardElement[])[0]!
    expect(drawn.points.map((point) => point.pressure)).toEqual([0.2, 0.45, 0.9])
    expect(drawn).toMatchObject({ drawBrush: 'fountain', strokeWidth: 2.4, opacity: 1 })
    wrapper.unmount()
  })
  it('keeps text colors independent of the outline in a free text block with a shape background', async () => {
    const richText = plainToRich('Before', note)
    richText.paragraphs[0]!.runs[0]!.color = '#b13f60'
    const wrapper = mountCanvas([
      { ...note, kind: 'text', textBackground: 'rectangle', richText },
    ])
    await pointer(wrapper.get('[data-element-id]').element, 'pointerdown', 1, 70, 70)
    await pointer(wrapper.get('.board-viewport').element, 'pointerup', 1, 70, 70)
    await wrapper.get('[data-element-stroke-color]').setValue('#397349')
    const changed = (wrapper.emitted('change')!.slice(-1)[0]![0] as BoardElement[])[0]!
    expect(changed.strokeColor).toBe('#397349')
    expect(changed.richText!.paragraphs[0]!.runs[0]!.color).toBe('#b13f60')
    expect(wrapper.find('[data-element-id] g[clip-path]').exists()).toBe(false)
    wrapper.unmount()
  })
  it('changes shape fill, outline and text independently, preserves geometry, and undoes a font edit', async () => {
    const richText = plainToRich('Before', note)
    richText.paragraphs[0]!.runs[0]!.color = '#b13f60'
    const wrapper = mountCanvas([{ ...note, kind: 'rectangle', richText }])
    await pointer(wrapper.get('[data-element-id]').element, 'pointerdown', 1, 70, 70)
    await pointer(wrapper.get('.board-viewport').element, 'pointerup', 1, 70, 70)
    expect(wrapper.find('.paper-element-controls').exists()).toBe(true)
    await wrapper.get('[data-fill-preset="#d8eaff"]').trigger('click')
    await wrapper.get('[data-element-stroke-color]').setValue('#397349')
    await wrapper.get('[data-element-font-size]').setValue('31')
    const last = (wrapper.emitted('change')!.slice(-1)[0]![0] as BoardElement[])[0]!
    expect(last).toMatchObject({
      fillColor: '#d8eaff',
      strokeColor: '#397349',
      width: 180,
      height: 120,
    })
    expect(last.richText!.paragraphs[0]!.runs[0]).toMatchObject({
      color: '#b13f60',
      fontSize: 31,
    })
    await wrapper.get('[data-text-position="middle-center"]').trigger('click')
    expect(
      (wrapper.emitted('change')!.slice(-1)[0]![0] as BoardElement[])[0]
    ).toMatchObject({
      textAlign: 'center',
      textVerticalAlign: 'middle',
    })
    await wrapper.get('.board-viewport').trigger('keydown', { key: 'z', ctrlKey: true })
    await wrapper.get('.board-viewport').trigger('keydown', { key: 'z', ctrlKey: true })
    expect(
      (wrapper.emitted('change')!.slice(-1)[0]![0] as BoardElement[])[0]!.richText!
        .paragraphs[0]!.runs[0]!.fontSize
    ).toBe(14)
    wrapper.unmount()
  })
  it('shows mixed font sizes for a multiselection and applies one size without resizing its shapes', async () => {
    const first = {
      ...note,
      kind: 'rectangle' as const,
      richText: plainToRich('Before', note),
    }
    const second = {
      ...first,
      id: 'second',
      x: 240,
      richText: plainToRich('Second', note),
    }
    second.text = 'Second'
    second.richText.paragraphs[0]!.runs[0]!.fontSize = 36
    const wrapper = mountCanvas([first, second])
    await wrapper.get('.board-viewport').trigger('keydown', { key: 'a', ctrlKey: true })
    expect(
      (wrapper.get('[data-element-font-size]').element as HTMLInputElement).value
    ).toBe('')
    await wrapper.get('[data-element-size-preset="22"]').trigger('click')
    const changed = wrapper.emitted('change')!.slice(-1)[0]![0] as BoardElement[]
    expect(changed.map((e) => e.richText!.paragraphs[0]!.runs[0]!.fontSize)).toEqual([
      22, 22,
    ])
    expect(changed.map((e) => [e.width, e.height])).toEqual([
      [180, 120],
      [180, 120],
    ])
    await wrapper.get('[data-arrange="left"]').trigger('click')
    expect(
      (wrapper.emitted('change')!.slice(-1)[0]![0] as BoardElement[]).map((e) => e.x)
    ).toEqual([10, 10])
    wrapper.unmount()
  })
  it('offers the rich editor inside a shape and keeps its chosen fill and dimensions after editing', async () => {
    const wrapper = mountCanvas([{ ...note, kind: 'ellipse', fillColor: '#fff0b3' }])
    await wrapper.get('[data-element-id]').trigger('dblclick')
    const editor = wrapper.getComponent(BoardRichTextEditor)
    const document = plainToRich('Formatted shape', note)
    document.paragraphs[0]!.runs[0]!.bold = true
    document.paragraphs[0]!.runs[0]!.fontSize = 36
    editor.vm.$emit('update:modelValue', document)
    await nextTick()
    editor.vm.$emit('finish')
    await nextTick()
    const changed = (wrapper.emitted('change')!.slice(-1)[0]![0] as BoardElement[])[0]!
    expect(changed).toMatchObject({
      kind: 'ellipse',
      fillColor: '#fff0b3',
      width: 180,
      height: 120,
      text: 'Formatted shape',
    })
    expect(changed.richText!.paragraphs[0]!.runs[0]).toMatchObject({
      bold: true,
      fontSize: 36,
    })
    expect(wrapper.get('[data-element-id] g[clip-path]').attributes('clip-path')).toMatch(
      /^url\(#board-rich-label-/
    )
    expect(wrapper.get('[data-element-id] defs rect').attributes('height')).toBe('120')
    wrapper.unmount()
  })
  it('chooses subtle graphite defaults and retains a custom width when reselecting the material', async () => {
    const wrapper = mountCanvas()
    await wrapper.get('[data-brush-library]').trigger('click')
    await wrapper.get('[data-paper-brush="graphite"]').trigger('click')
    const viewport = wrapper.get('.board-viewport')
    await pointer(viewport.element, 'pointerdown', 1, 300, 300)
    await pointer(viewport.element, 'pointermove', 1, 360, 340)
    await pointer(viewport.element, 'pointerup', 1, 360, 340)
    const first = (wrapper.emitted('change')!.slice(-1)[0]![0] as BoardElement[])[0]!
    expect(first).toMatchObject({
      kind: 'draw',
      drawBrush: 'graphite',
      strokeWidth: 1.8,
      opacity: 1,
    })
    await wrapper.get('[data-tool-settings]').trigger('click')
    await wrapper.get('[data-brush-width]').setValue('9')
    await wrapper
      .get('.board-style-panel .board-swatch[aria-label="boards.colors.blue"]')
      .trigger('click')
    await wrapper.get('[data-brush-library]').trigger('click')
    await wrapper.get('[data-paper-brush="graphite"]').trigger('click')
    await pointer(viewport.element, 'pointerdown', 2, 400, 400)
    await pointer(viewport.element, 'pointermove', 2, 460, 440)
    await pointer(viewport.element, 'pointerup', 2, 460, 440)
    expect(
      (wrapper.emitted('change')!.slice(-1)[0]![0] as BoardElement[])[1]
    ).toMatchObject({ drawBrush: 'graphite', strokeWidth: 9, color: 'blue' })
    expect((wrapper.emitted('change')!.slice(-1)[0]![0] as BoardElement[])[0]).toEqual(
      first
    )
    wrapper.unmount()
  })

  it('switches future drawing material without rewriting a completed stroke, and pen clears artistic material', async () => {
    const wrapper = mountCanvas()
    await wrapper.get('[data-brush-library]').trigger('click')
    await wrapper.get('[data-paper-brush="graphite"]').trigger('click')
    const viewport = wrapper.get('.board-viewport')
    await pointer(viewport.element, 'pointerdown', 1, 300, 300)
    await pointer(viewport.element, 'pointermove', 1, 360, 340)
    await pointer(viewport.element, 'pointerup', 1, 360, 340)
    const first = structuredClone(
      (wrapper.emitted('change')!.slice(-1)[0]![0] as BoardElement[])[0]
    )
    await wrapper.get('[data-brush-library]').trigger('click')
    await wrapper.get('[data-paper-brush="fountain"]').trigger('click')
    await pointer(viewport.element, 'pointerdown', 2, 400, 400)
    await pointer(viewport.element, 'pointermove', 2, 460, 440)
    await pointer(viewport.element, 'pointerup', 2, 460, 440)
    const drawings = wrapper.emitted('change')!.slice(-1)[0]![0] as BoardElement[]
    expect(drawings[0]).toEqual(first)
    expect(drawings[1]?.drawBrush).toBe('fountain')
    await wrapper.get('[data-tool="pen"]').trigger('click')
    await pointer(viewport.element, 'pointerdown', 3, 500, 500)
    await pointer(viewport.element, 'pointermove', 3, 560, 540)
    await pointer(viewport.element, 'pointerup', 3, 560, 540)
    expect(
      (wrapper.emitted('change')!.slice(-1)[0]![0] as BoardElement[])[2]?.drawBrush
    ).toBeUndefined()
    wrapper.unmount()
  })

  it('changes an explicitly selected drawing material and restores it with undo', async () => {
    const drawing: BoardElement = {
      ...note,
      kind: 'draw',
      drawBrush: 'graphite',
      points: [
        { x: 10, y: 10 },
        { x: 190, y: 130 },
      ],
    }
    const wrapper = mountCanvas([drawing])
    await wrapper.get('[data-tool="select"]').trigger('click')
    const viewport = wrapper.get('.board-viewport')
    await pointer(wrapper.get('[data-element-id]').element, 'pointerdown', 1, 70, 70)
    await pointer(viewport.element, 'pointerup', 1, 70, 70)
    await wrapper.get('[data-brush-library]').trigger('click')
    await wrapper.get('[data-paper-brush="fountain"]').trigger('click')
    expect(
      (wrapper.emitted('change')!.slice(-1)[0]![0] as BoardElement[])[0]?.drawBrush
    ).toBe('fountain')
    await viewport.trigger('keydown', { key: 'z', ctrlKey: true })
    expect(
      (wrapper.emitted('change')!.slice(-1)[0]![0] as BoardElement[])[0]?.drawBrush
    ).toBe('graphite')
    wrapper.unmount()
  })

  it('captures pen pressure and preserves it when resizing the artistic drawing', async () => {
    const wrapper = mountCanvas()
    await wrapper.get('[data-brush-library]').trigger('click')
    await wrapper.get('[data-paper-brush="graphite"]').trigger('click')
    const viewport = wrapper.get('.board-viewport')
    await pointer(viewport.element, 'pointerdown', 1, 300, 300, {
      pointerType: 'pen',
      pressure: 0.2,
    })
    await pointer(viewport.element, 'pointermove', 1, 360, 340, {
      pointerType: 'pen',
      pressure: 0.9,
    })
    await pointer(viewport.element, 'pointerup', 1, 360, 340, {
      pointerType: 'pen',
      pressure: 0,
    })
    const drawn = (wrapper.emitted('change')!.slice(-1)[0]![0] as BoardElement[])[0]!
    expect(drawn.points.map((point) => point.pressure)).toEqual([0.2, 0.9])
    await wrapper.get('[data-tool="select"]').trigger('click')
    await pointer(wrapper.get('[data-element-id]').element, 'pointerdown', 2, 330, 320)
    await pointer(viewport.element, 'pointerup', 2, 330, 320)
    await pointer(
      wrapper.get('[data-resize-handle="se"]').element,
      'pointerdown',
      3,
      360,
      340
    )
    await pointer(viewport.element, 'pointermove', 3, 420, 380)
    await pointer(viewport.element, 'pointerup', 3, 420, 380)
    const resized = (wrapper.emitted('change')!.slice(-1)[0]![0] as BoardElement[])[0]!
    expect(resized.points.map((point) => point.pressure)).toEqual([0.2, 0.9])
    expect(resized.width).not.toBe(drawn.width)
    wrapper.unmount()
  })
  it('changes Paper appearance without emitting document element edits', async () => {
    const wrapper = mountCanvas([note])
    await wrapper.setProps({ background: 'ruled', colorScheme: 'dark' })
    expect(wrapper.get('.board-viewport').attributes('style')).toContain(
      'background-color: rgb(32, 36, 44)'
    )
    expect(wrapper.get('.board-viewport').attributes('style')).toContain(
      'linear-gradient'
    )
    expect(wrapper.emitted('change')).toBeUndefined()
    expect(wrapper.props('elements')).toEqual([note])
    wrapper.unmount()
  })
  it('applies quick widths and keeps the chosen width when reselecting the same pencil', async () => {
    const wrapper = mountCanvas()
    await wrapper.get('[data-tool-settings]').trigger('click')
    await wrapper.get('[data-brush-preset="4"]').trigger('click')
    expect(wrapper.get('[data-brush-width]').element).toHaveProperty('value', '4')
    await wrapper.get('[data-tool="draw"]').trigger('click')
    const viewport = wrapper.get('.board-viewport')
    await pointer(viewport.element, 'pointerdown', 1, 300, 300)
    await pointer(viewport.element, 'pointermove', 1, 360, 340)
    await pointer(viewport.element, 'pointerup', 1, 360, 340)
    expect(
      (wrapper.emitted('change')!.slice(-1)[0]![0] as BoardElement[])[0]?.strokeWidth
    ).toBe(4)
    wrapper.unmount()
  })
  it('starts with a pencil and persists customized brush presets on a new stroke', async () => {
    const wrapper = mountCanvas()
    expect(wrapper.get('[data-tool="draw"]').attributes('aria-pressed')).toBe('true')
    await wrapper.get('[data-tool-settings]').trigger('click')
    await wrapper.get('[data-brush-width]').setValue('6')
    await wrapper.get('[data-brush-opacity]').setValue('45')
    await wrapper.get('[data-brush-color]').setValue('#336699')
    expect(wrapper.emitted('change')).toBeUndefined()
    const viewport = wrapper.get('.board-viewport')
    await pointer(viewport.element, 'pointerdown', 1, 300, 300)
    await pointer(viewport.element, 'pointermove', 1, 360, 340)
    await pointer(viewport.element, 'pointerup', 1, 360, 340)
    expect(
      (wrapper.emitted('change')!.slice(-1)[0]![0] as BoardElement[])[0]
    ).toMatchObject({
      kind: 'draw',
      strokeStyle: 'pencil',
      strokeWidth: 6,
      opacity: 0.45,
      strokeColor: '#336699',
    })
    wrapper.unmount()
  })

  it('updates brush properties on the selection and restores each property through undo', async () => {
    const wrapper = mountCanvas([
      { ...note, kind: 'rectangle', strokeWidth: 2, opacity: 1, strokeColor: '#000000' },
    ])
    const viewport = wrapper.get('.board-viewport')
    await pointer(wrapper.get('[data-element-id]').element, 'pointerdown', 1, 70, 70)
    await pointer(viewport.element, 'pointerup', 1, 70, 70)
    await wrapper.get('[data-tool-settings]').trigger('click')
    await wrapper.get('[data-brush-width]').setValue('8')
    await wrapper.get('[data-brush-opacity]').setValue('30')
    await wrapper.get('[data-brush-color]').setValue('#996633')
    expect(
      (wrapper.emitted('change')!.slice(-1)[0]![0] as BoardElement[])[0]
    ).toMatchObject({ strokeWidth: 8, opacity: 0.3, strokeColor: '#996633' })
    await viewport.trigger('keydown', { key: 'z', ctrlKey: true })
    expect(
      (wrapper.emitted('change')!.slice(-1)[0]![0] as BoardElement[])[0]
    ).toMatchObject({ strokeWidth: 8, opacity: 0.3, strokeColor: '#000000' })
    await viewport.trigger('keydown', { key: 'z', ctrlKey: true })
    await viewport.trigger('keydown', { key: 'z', ctrlKey: true })
    expect(
      (wrapper.emitted('change')!.slice(-1)[0]![0] as BoardElement[])[0]
    ).toMatchObject({ strokeWidth: 2, opacity: 1, strokeColor: '#000000' })
    wrapper.unmount()
  })

  it('keeps the pen active across strokes and allows switching to selection for editing', async () => {
    const wrapper = mountCanvas()
    const viewport = wrapper.get('.board-viewport')
    await viewport.trigger('keydown', { key: 'b' })
    for (const [pointerId, x] of [
      [1, 300],
      [2, 420],
    ]) {
      await pointer(viewport.element, 'pointerdown', pointerId!, x!, 300)
      await pointer(viewport.element, 'pointermove', pointerId!, x! + 60, 340)
      await pointer(viewport.element, 'pointerup', pointerId!, x! + 60, 340)
      expect(wrapper.get('[data-tool="pen"]').attributes('aria-pressed')).toBe('true')
    }
    expect(wrapper.emitted('change')!.slice(-1)[0]![0] as BoardElement[]).toHaveLength(2)
    await viewport.trigger('keydown', { key: 'v' })
    expect(wrapper.get('[data-tool="select"]').attributes('aria-pressed')).toBe('true')
    await pointer(wrapper.get('[data-element-id]').element, 'pointerdown', 3, 330, 320)
    await pointer(viewport.element, 'pointerup', 3, 330, 320)
    expect(wrapper.find('[data-resize-handle="se"]').exists()).toBe(true)
    wrapper.unmount()
  })

  it('hides floating controls without remounting the canvas or changing persisted elements', async () => {
    const wrapper = mountCanvas([note])
    const viewport = wrapper.get('.board-viewport').element
    const scene = wrapper.get('[data-scene]').element
    expect(wrapper.findAll('.board-floating').length).toBeGreaterThan(0)
    await wrapper.setProps({ distractionFree: true })
    expect(wrapper.findAll('.board-floating')).toHaveLength(0)
    expect(wrapper.get('.board-viewport').element).toBe(viewport)
    expect(wrapper.get('[data-scene]').element).toBe(scene)
    expect(wrapper.get('.board-editor').classes()).toContain('board-distraction-free')
    expect(wrapper.emitted('change')).toBeUndefined()
    await wrapper.setProps({ distractionFree: false })
    expect(wrapper.findAll('.board-floating').length).toBeGreaterThan(0)
    expect(wrapper.get('[data-scene]').element).toBe(scene)
    wrapper.unmount()
  })

  it('keeps pen shortcuts, gestures and inline editing functional with controls hidden', async () => {
    const wrapper = mountCanvas([{ ...note, kind: 'rectangle' }])
    await wrapper.setProps({ distractionFree: true })
    const viewport = wrapper.get('.board-viewport')
    expect(wrapper.vm.isInteracting()).toBe(false)
    await viewport.trigger('keydown', { key: 'b' })
    await pointer(viewport.element, 'pointerdown', 1, 300, 300)
    expect(wrapper.vm.isInteracting()).toBe(true)
    await pointer(viewport.element, 'pointermove', 1, 360, 340)
    await pointer(viewport.element, 'pointerup', 1, 360, 340)
    expect(wrapper.vm.isInteracting()).toBe(false)
    expect(
      (wrapper.emitted('change')!.slice(-1)[0]![0] as BoardElement[])[1]
    ).toMatchObject({ kind: 'draw', strokeStyle: 'pen' })
    await wrapper.get('[data-element-id="note"]').trigger('dblclick')
    expect(wrapper.vm.isInteracting()).toBe(true)
    expect(wrapper.findComponent(BoardRichTextEditor).exists()).toBe(true)
    wrapper
      .getComponent(BoardRichTextEditor)
      .vm.$emit('update:modelValue', plainToRich('Hidden controls, working editor', note))
    await nextTick()
    window.dispatchEvent(new Event('praxis:commit-board-edit'))
    expect(wrapper.vm.isInteracting()).toBe(false)
    expect((wrapper.emitted('change')!.slice(-1)[0]![0] as BoardElement[])[0]?.text).toBe(
      'Hidden controls, working editor'
    )
    expect(wrapper.findAll('.board-floating')).toHaveLength(0)
    wrapper.unmount()
  })

  it('shows a clean blank canvas without its empty hint in distraction-free mode', async () => {
    const wrapper = mountCanvas()
    expect(wrapper.find('.board-empty').exists()).toBe(true)
    await wrapper.setProps({ distractionFree: true })
    expect(wrapper.find('.board-empty').exists()).toBe(false)
    expect(wrapper.find('.board-viewport').exists()).toBe(true)
    expect(typeof wrapper.vm.focusCanvas).toBe('function')
    wrapper.unmount()
  })

  it('offers explicit pen and pencil tools with distinct keyboard shortcuts and stroke defaults', async () => {
    for (const [key, tool, strokeStyle] of [
      ['b', 'pen', 'pen'],
      ['p', 'draw', 'pencil'],
    ]) {
      const wrapper = mountCanvas()
      const viewport = wrapper.get('.board-viewport')
      await viewport.trigger('keydown', { key })
      expect(wrapper.get(`[data-tool="${tool}"]`).attributes('aria-pressed')).toBe('true')
      await pointer(viewport.element, 'pointerdown', 1, 100, 100)
      await pointer(viewport.element, 'pointermove', 1, 160, 140)
      await pointer(viewport.element, 'pointerup', 1, 160, 140)
      expect((wrapper.emitted('change')![0]![0] as BoardElement[])[0]).toMatchObject({
        kind: 'draw',
        strokeStyle,
      })
      wrapper.unmount()
    }
  })

  it.each(['shiftKey', 'ctrlKey'] as const)(
    'shows four corner handles and preserves aspect ratio with %s',
    async (modifier) => {
      const wrapper = mountCanvas([{ ...note, kind: 'rectangle' }])
      const viewport = wrapper.get('.board-viewport')
      await pointer(wrapper.get('[data-element-id]').element, 'pointerdown', 1, 70, 70)
      await pointer(viewport.element, 'pointerup', 1, 70, 70)
      expect(
        wrapper
          .findAll('[data-resize-handle]')
          .map((handle) => handle.attributes('data-resize-handle'))
          .sort()
      ).toEqual(['ne', 'nw', 'se', 'sw'])
      await pointer(
        wrapper.get('[data-resize-handle="se"]').element,
        'pointerdown',
        2,
        230,
        170
      )
      await pointer(viewport.element, 'pointermove', 2, 410, 200, { [modifier]: true })
      await pointer(viewport.element, 'pointerup', 2, 410, 200, { [modifier]: true })
      const resized = (wrapper.emitted('change')!.slice(-1)[0]![0] as BoardElement[])[0]!
      expect(resized.width / resized.height).toBeCloseTo(1.5)
      expect(resized.width).not.toBe(note.width)
      wrapper.unmount()
    }
  )

  it('resizes from the center with Alt and restores geometry with undo', async () => {
    const wrapper = mountCanvas([{ ...note, kind: 'rectangle' }])
    const viewport = wrapper.get('.board-viewport')
    await pointer(wrapper.get('[data-element-id]').element, 'pointerdown', 1, 70, 70)
    await pointer(viewport.element, 'pointerup', 1, 70, 70)
    await pointer(
      wrapper.get('[data-resize-handle="se"]').element,
      'pointerdown',
      2,
      230,
      170
    )
    await pointer(viewport.element, 'pointermove', 2, 290, 210, { altKey: true })
    await pointer(viewport.element, 'pointerup', 2, 290, 210, { altKey: true })
    const resized = (wrapper.emitted('change')!.slice(-1)[0]![0] as BoardElement[])[0]!
    expect(resized.x + resized.width / 2).toBeCloseTo(100)
    expect(resized.y + resized.height / 2).toBeCloseTo(70)
    await viewport.trigger('keydown', { key: 'z', ctrlKey: true })
    expect(
      (wrapper.emitted('change')!.slice(-1)[0]![0] as BoardElement[])[0]
    ).toMatchObject({ x: 10, y: 10, width: 180, height: 120 })
    wrapper.unmount()
  })

  it('snaps handle rotation to fifteen degrees and supports keyboard rotation with undo', async () => {
    const wrapper = mountCanvas([{ ...note, kind: 'rectangle' }])
    const viewport = wrapper.get('.board-viewport')
    await pointer(wrapper.get('[data-element-id]').element, 'pointerdown', 1, 70, 70)
    await pointer(viewport.element, 'pointerup', 1, 70, 70)
    const [cameraX, cameraY, zoom] = wrapper
      .get('[data-scene]')
      .attributes('transform')!
      .match(/-?\d+(?:\.\d+)?/g)!
      .map(Number)
    const handle = wrapper.get('[data-rotate]')
    const startX = cameraX! + Number(handle.attributes('cx')) * zoom!
    const startY = cameraY! + Number(handle.attributes('cy')) * zoom!
    const endX = cameraX! + 200 * zoom!
    const endY = cameraY! + 70 * zoom!
    await pointer(handle.element, 'pointerdown', 2, startX, startY)
    await pointer(viewport.element, 'pointermove', 2, endX, endY, { shiftKey: true })
    await pointer(viewport.element, 'pointerup', 2, endX, endY, { shiftKey: true })
    const angle = (wrapper.emitted('change')!.slice(-1)[0]![0] as BoardElement[])[0]!
      .angle!
    expect(angle / (Math.PI / 12)).toBeCloseTo(Math.round(angle / (Math.PI / 12)))
    expect(Math.abs(angle)).toBeGreaterThan(0)
    await viewport.trigger('keydown', { key: 'ArrowRight', altKey: true })
    const turned = (wrapper.emitted('change')!.slice(-1)[0]![0] as BoardElement[])[0]!
    expect(turned.angle).toBeCloseTo(angle + Math.PI / 12)
    await viewport.trigger('keydown', { key: 'z', ctrlKey: true })
    expect(
      (wrapper.emitted('change')!.slice(-1)[0]![0] as BoardElement[])[0]!.angle
    ).toBeCloseTo(angle)
    wrapper.unmount()
  })

  it('constrains shape creation to a square while Shift is pressed', async () => {
    const wrapper = mountCanvas()
    await wrapper.get('[data-tool="rectangle"]').trigger('click')
    const viewport = wrapper.get('.board-viewport')
    await pointer(viewport.element, 'pointerdown', 1, 100, 100)
    await pointer(viewport.element, 'pointermove', 1, 260, 160, { shiftKey: true })
    await pointer(viewport.element, 'pointerup', 1, 260, 160, { shiftKey: true })
    const created = (wrapper.emitted('change')![0]![0] as BoardElement[])[0]!
    expect(created.width).toBe(160)
    expect(created.height).toBe(160)
    wrapper.unmount()
  })

  it('does not activate drawing shortcuts while entering plain or rich text', async () => {
    const wrapper = mountCanvas()
    const viewport = wrapper.get('.board-viewport')
    for (const tag of ['input', 'div']) {
      const editable = document.createElement(tag)
      if (tag === 'div') editable.setAttribute('contenteditable', 'true')
      viewport.element.appendChild(editable)
      editable.dispatchEvent(new KeyboardEvent('keydown', { key: 'b', bubbles: true }))
      await nextTick()
      expect(wrapper.get('[data-tool="draw"]').attributes('aria-pressed')).toBe('true')
      editable.remove()
    }
    wrapper.unmount()
  })

  it('edits existing text with the Text tool without creating another element', async () => {
    const wrapper = mountCanvas([{ ...note, kind: 'text' }])
    await wrapper.get('[data-tool="text"]').trigger('click')
    await pointer(wrapper.get('[data-element-id]').element, 'pointerdown', 1, 70, 70)
    await pointer(wrapper.get('.board-viewport').element, 'pointerup', 1, 70, 70)
    expect(wrapper.findAll('[data-element-id]')).toHaveLength(1)
    expect(wrapper.findComponent(BoardRichTextEditor).exists()).toBe(true)
    expect(wrapper.emitted('change')).toBeUndefined()
    wrapper.unmount()
  })
  it('opens existing rich text when pointer capture retargets double click to the viewport', async () => {
    const wrapper = mountCanvas([{ ...note, kind: 'text', textAutoWidth: true }])
    await wrapper
      .get('.board-viewport')
      .trigger('dblclick', { clientX: 70, clientY: 70, button: 0 })
    expect(wrapper.findComponent(BoardRichTextEditor).exists()).toBe(true)
    expect(
      wrapper.findComponent(BoardRichTextEditor).props('modelValue').paragraphs[0].runs[0]
        .text
    ).toBe('Before')
    wrapper.unmount()
  })
  it('offers a visible edit action for a selected shape label', async () => {
    const wrapper = mountCanvas([{ ...note, kind: 'rectangle' }])
    await pointer(wrapper.get('[data-element-id]').element, 'pointerdown', 1, 70, 70)
    await pointer(wrapper.get('.board-viewport').element, 'pointerup', 1, 70, 70)
    await wrapper.get('[data-edit-text]').trigger('click')
    expect(
      wrapper.getComponent(BoardRichTextEditor).props('modelValue').paragraphs[0]!
        .runs[0]!.text
    ).toBe('Before')
    wrapper
      .getComponent(BoardRichTextEditor)
      .vm.$emit('update:modelValue', plainToRich('Edited shape', note))
    await nextTick()
    wrapper.getComponent(BoardRichTextEditor).vm.$emit('finish')
    await nextTick()
    expect((wrapper.emitted('change')!.slice(-1)[0]![0] as BoardElement[])[0]!.text).toBe(
      'Edited shape'
    )
    wrapper.unmount()
  })
  it('keeps text transparent until a background shape is explicitly selected, and undoes that choice', async () => {
    const wrapper = mountCanvas([{ ...note, kind: 'text', strokeStyle: 'pencil' }])
    expect(wrapper.findAll('[data-element-id] path')).toHaveLength(0)
    const viewport = wrapper.find('.board-viewport')
    await pointer(wrapper.find('[data-element-id]').element, 'pointerdown', 1, 70, 70)
    await pointer(viewport.element, 'pointerup', 1, 70, 70)
    expect(wrapper.find('[data-text-background="none"]').attributes('aria-pressed')).toBe(
      'true'
    )
    await wrapper.find('[data-text-background="rectangle"]').trigger('click')
    expect(
      (wrapper.emitted('change')!.slice(-1)[0]![0] as BoardElement[])[0]
    ).toMatchObject({
      textBackground: 'rectangle',
      textAutoWidth: false,
      strokeStyle: 'pencil',
    })
    expect(wrapper.findAll('[data-element-id] path').length).toBeGreaterThan(0)
    await wrapper.find('[data-text-background="ellipse"]').trigger('click')
    expect(
      (wrapper.emitted('change')!.slice(-1)[0]![0] as BoardElement[])[0]?.textBackground
    ).toBe('ellipse')
    await viewport.trigger('keydown', { key: 'z', ctrlKey: true })
    expect(
      (wrapper.emitted('change')!.slice(-1)[0]![0] as BoardElement[])[0]?.textBackground
    ).toBe('rectangle')
    await viewport.trigger('keydown', { key: 'z', ctrlKey: true })
    expect(wrapper.findAll('[data-element-id] path')).toHaveLength(0)
    wrapper.unmount()
  })

  it('sets horizontal and vertical shape text alignment independently and preserves them through undo', async () => {
    const wrapper = mountCanvas([{ ...note, kind: 'rectangle' }])
    const viewport = wrapper.find('.board-viewport')
    await pointer(wrapper.find('[data-element-id]').element, 'pointerdown', 1, 70, 70)
    await pointer(viewport.element, 'pointerup', 1, 70, 70)
    await wrapper.find('[data-text-align="center"]').trigger('click')
    await wrapper.find('[data-text-vertical-align="middle"]').trigger('click')
    expect(
      (wrapper.emitted('change')!.slice(-1)[0]![0] as BoardElement[])[0]
    ).toMatchObject({ textAlign: 'center', textVerticalAlign: 'middle' })
    await wrapper.find('[data-text-vertical-align="bottom"]').trigger('click')
    await viewport.trigger('keydown', { key: 'z', ctrlKey: true })
    expect(
      (wrapper.emitted('change')!.slice(-1)[0]![0] as BoardElement[])[0]
    ).toMatchObject({ textAlign: 'center', textVerticalAlign: 'middle' })
    wrapper.unmount()
  })

  it('updates alignment on every rich text paragraph when using canvas alignment controls', async () => {
    const element: BoardElement = {
      ...note,
      kind: 'text',
      richText: plainToRich('First\nSecond', { ...note, kind: 'text' }),
    }
    const wrapper = mountCanvas([element])
    const viewport = wrapper.find('.board-viewport')
    await pointer(wrapper.find('[data-element-id]').element, 'pointerdown', 1, 70, 70)
    await pointer(viewport.element, 'pointerup', 1, 70, 70)
    await wrapper.find('[data-text-align="right"]').trigger('click')
    const updated = (wrapper.emitted('change')!.slice(-1)[0]![0] as BoardElement[])[0]!
    expect(updated.textAlign).toBe('right')
    expect(updated.richText?.paragraphs.map((paragraph) => paragraph.align)).toEqual([
      'right',
      'right',
    ])
    await wrapper.find('[data-text-align="left"]').trigger('click')
    expect(
      (
        wrapper.emitted('change')!.slice(-1)[0]![0] as BoardElement[]
      )[0]?.richText?.paragraphs.map((paragraph) => paragraph.align)
    ).toEqual(['left', 'left'])
    wrapper.unmount()
  })

  it('edits free text inline, grows with new lines, and cancels an existing draft', async () => {
    const wrapper = mountCanvas([{ ...note, kind: 'text', textAutoWidth: true }])
    await wrapper.find('[data-element-id]').trigger('dblclick')
    expect(wrapper.find('.board-text-editor').exists()).toBe(false)
    const editor = wrapper.findComponent(BoardRichTextEditor)
    editor.vm.$emit(
      'update:modelValue',
      plainToRich('Primeira linha\nSegunda linha\nTerceira linha\nQuarta linha', {
        ...note,
        kind: 'text',
      })
    )
    expect(wrapper.findComponent(BoardRichTextEditor).exists()).toBe(true)
    editor.vm.$emit('finish')
    await nextTick()
    const updated = wrapper.emitted('change')![0]![0] as BoardElement[]
    expect(updated[0]?.height).toBeGreaterThan(60)
    expect(updated[0]?.text).toContain('Quarta linha')
    await wrapper.find('[data-element-id]').trigger('dblclick')
    wrapper
      .findComponent(BoardRichTextEditor)
      .vm.$emit('update:modelValue', plainToRich('Descartar', { ...note, kind: 'text' }))
    wrapper.findComponent(BoardRichTextEditor).vm.$emit('cancel')
    expect(wrapper.emitted('change')).toHaveLength(1)
    wrapper.unmount()
  })
  it('flushes formatted text before locking', async () => {
    const wrapper = mountCanvas([{ ...note, kind: 'text' }])
    await wrapper.find('[data-element-id]').trigger('dblclick')
    const document = plainToRich('Texto antes de bloquear', { ...note, kind: 'text' })
    document.paragraphs[0]!.runs[0]!.bold = true
    wrapper.findComponent(BoardRichTextEditor).vm.$emit('update:modelValue', document)
    expect(wrapper.emitted('change')).toBeUndefined()
    window.dispatchEvent(new Event('praxis:commit-board-edit'))
    expect((wrapper.emitted('change')![0]![0] as BoardElement[])[0]?.text).toBe(
      'Texto antes de bloquear'
    )
    expect(
      (wrapper.emitted('change')![0]![0] as BoardElement[])[0]?.richText?.paragraphs[0]
        ?.runs[0]?.bold
    ).toBe(true)
    wrapper.unmount()
  })
  it('creates handwritten text and preserves highlight styles through undo', async () => {
    const wrapper = mountCanvas()
    await wrapper.find('[data-tool="text"]').trigger('click')
    const viewport = wrapper.find('.board-viewport')
    await pointer(viewport.element, 'pointerdown', 1, 100, 100)
    await pointer(viewport.element, 'pointerup', 1, 100, 100)
    wrapper
      .findComponent(BoardRichTextEditor)
      .vm.$emit(
        'update:modelValue',
        plainToRich('Anotação à mão', { ...note, kind: 'text', textFont: 'handwritten' })
      )
    wrapper.findComponent(BoardRichTextEditor).vm.$emit('finish')
    await nextTick()
    expect(wrapper.find('[data-text-highlight]').exists()).toBe(false)
    wrapper
      .findComponent({ name: 'BoardAnnotationControls' })
      .vm.$emit('update:modelValue', defaultAnnotation('highlight'))
    await nextTick()
    const highlighted = wrapper.emitted('change')!.slice(-1)[0]![0] as BoardElement[]
    expect(highlighted[0]).toMatchObject({
      textFont: 'handwritten',
      textAnnotation: expect.objectContaining({ type: 'highlight' }),
    })
    expect(wrapper.find('[data-handwritten]').exists()).toBe(true)
    await viewport.trigger('keydown', { key: 'z', ctrlKey: true })
    expect(
      (wrapper.emitted('change')!.slice(-1)[0]![0] as BoardElement[])[0]
        ?.textAnnotation ?? null
    ).toBeNull()
    wrapper.unmount()
  })
  it('creates pencil elements, switches existing strokes and undoes the style change', async () => {
    const wrapper = mountCanvas()
    await wrapper.find('[data-tool="rectangle"]').trigger('click')
    const viewport = wrapper.find('.board-viewport')
    await pointer(viewport.element, 'pointerdown', 1, 100, 100)
    await pointer(viewport.element, 'pointermove', 1, 300, 220)
    await pointer(viewport.element, 'pointerup', 1, 300, 220)
    expect((wrapper.emitted('change')![0]![0] as BoardElement[])[0]?.strokeStyle).toBe(
      'pencil'
    )
    await wrapper.find('[data-stroke-style="pen"]').trigger('click')
    expect((wrapper.emitted('change')![1]![0] as BoardElement[])[0]?.strokeStyle).toBe(
      'pen'
    )
    await viewport.trigger('keydown', { key: 'z', ctrlKey: true })
    expect((wrapper.emitted('change')![2]![0] as BoardElement[])[0]?.strokeStyle).toBe(
      'pencil'
    )
    wrapper.unmount()
  })
  it('keeps legacy strokes clean and does not regenerate drawing paths on camera zoom', async () => {
    const wrapper = mountCanvas([{ ...note, kind: 'rectangle' }])
    const path = wrapper.find('[data-element-id] path')
    const initial = path.attributes('d')
    await wrapper.find('[data-element-id]').trigger('dblclick')
    wrapper.getComponent(BoardRichTextEditor).vm.$emit('finish')
    await nextTick()
    expect(wrapper.find('[data-stroke-style="clean"]').attributes('aria-pressed')).toBe(
      'true'
    )
    wrapper.find('.board-viewport').element.dispatchEvent(
      new WheelEvent('wheel', {
        deltaY: 120,
        clientX: 200,
        clientY: 200,
        bubbles: true,
      })
    )
    await nextTick()
    expect(wrapper.find('[data-element-id] path').attributes('d')).toBe(initial)
    expect(wrapper.emitted('change')).toBeUndefined()
    wrapper.unmount()
  })
  it('offers free drawing tools without imposing a refinement workflow', async () => {
    const wrapper = mountCanvas()
    expect(wrapper.find('[data-tool="draw"]').exists()).toBe(true)
    for (const kind of ['question', 'decision', 'task']) {
      expect(wrapper.find(`[data-tool="${kind}"]`).exists()).toBe(false)
    }
    await wrapper.find('.board-viewport').trigger('keydown', { key: 'r' })
    expect(wrapper.find('[data-tool="rectangle"]').attributes('aria-pressed')).toBe(
      'true'
    )
    wrapper.unmount()
  })
  it('commits a creation gesture only on pointer-up and cancels an unfinished gesture', async () => {
    const wrapper = mountCanvas()
    const rectangle = wrapper.find('[data-tool="rectangle"]')
    await rectangle.trigger('click')
    const viewport = wrapper.find('.board-viewport')
    await pointer(viewport.element, 'pointerdown', 1, 100, 100)
    await pointer(viewport.element, 'pointermove', 1, 300, 220)
    expect(wrapper.emitted('change')).toBeUndefined()
    await pointer(viewport.element, 'pointerup', 1, 300, 220)
    const created = wrapper.emitted('change')![0]![0] as BoardElement[]
    expect(created[0]).toMatchObject({
      kind: 'rectangle',
      x: 60,
      y: 60,
      width: 200,
      height: 120,
    })
    await rectangle.trigger('click')
    await pointer(viewport.element, 'pointerdown', 2, 400, 300)
    await viewport.trigger('keydown', { key: 'Escape' })
    expect(wrapper.findAll('[data-element-id]')).toHaveLength(1)
    expect(wrapper.emitted('change')).toHaveLength(1)
    wrapper.unmount()
  })
  it('commits text once after finishing and undoes the completed edit', async () => {
    const wrapper = mountCanvas([note])
    await wrapper.find('[data-element-id]').trigger('dblclick')
    wrapper
      .getComponent(BoardRichTextEditor)
      .vm.$emit('update:modelValue', plainToRich('After', note))
    await nextTick()
    expect(wrapper.emitted('change')).toBeUndefined()
    wrapper.getComponent(BoardRichTextEditor).vm.$emit('finish')
    await nextTick()
    expect((wrapper.emitted('change')![0]![0] as BoardElement[])[0]?.text).toBe('After')
    await wrapper.find('.board-viewport').trigger('keydown', { key: 'z', ctrlKey: true })
    expect((wrapper.emitted('change')![1]![0] as BoardElement[])[0]?.text).toBe('Before')
    wrapper.unmount()
  })
  it('does not delete selected elements when the user types in the rich editor', async () => {
    const wrapper = mountCanvas([note])
    await wrapper.find('[data-element-id]').trigger('dblclick')
    await wrapper
      .getComponent(BoardRichTextEditor)
      .get('[contenteditable]')
      .trigger('keydown', { key: 'Backspace' })
    expect(wrapper.findAll('[data-element-id]')).toHaveLength(1)
    expect(wrapper.emitted('change')).toBeUndefined()
    wrapper.unmount()
  })
  it('drops undo history at an external task-link update boundary', async () => {
    const wrapper = mountCanvas([note])
    await wrapper.find('[data-element-id]').trigger('dblclick')
    wrapper
      .getComponent(BoardRichTextEditor)
      .vm.$emit('update:modelValue', plainToRich('After', note))
    await nextTick()
    wrapper.getComponent(BoardRichTextEditor).vm.$emit('finish')
    await nextTick()
    await wrapper.setProps({ elements: [{ ...note, kind: 'task', taskId: 'task-1' }] })
    await wrapper.find('.board-viewport').trigger('keydown', { key: 'z', ctrlKey: true })
    expect(wrapper.emitted('change')).toHaveLength(1)
    wrapper.unmount()
  })
  it('commits the current text once before a lifecycle flush and removes its listener', async () => {
    const removeListener = vi.spyOn(window, 'removeEventListener')
    const wrapper = mountCanvas([note])
    await wrapper.find('[data-element-id]').trigger('dblclick')
    wrapper
      .getComponent(BoardRichTextEditor)
      .vm.$emit('update:modelValue', plainToRich('Typed before locking', note))
    await nextTick()
    window.dispatchEvent(new Event('praxis:commit-board-edit'))
    expect((wrapper.emitted('change')![0]![0] as BoardElement[])[0]?.text).toBe(
      'Typed before locking'
    )
    window.dispatchEvent(new Event('praxis:commit-board-edit'))
    expect(wrapper.emitted('change')).toHaveLength(1)
    wrapper.unmount()
    expect(removeListener).toHaveBeenCalledWith(
      'praxis:commit-board-edit',
      expect.any(Function)
    )
    removeListener.mockRestore()
  })
  it('duplicates a selection and moves it with keyboard controls', async () => {
    const wrapper = mountCanvas([note])
    await wrapper.find('[data-element-id]').trigger('dblclick')
    wrapper.getComponent(BoardRichTextEditor).vm.$emit('finish')
    await nextTick()
    await wrapper.find('.board-viewport').trigger('keydown', { key: 'd', ctrlKey: true })
    const copied = wrapper.emitted('change')![0]![0] as BoardElement[]
    expect(copied).toHaveLength(2)
    expect(copied[1]?.id).not.toBe(note.id)
    await wrapper
      .find('.board-viewport')
      .trigger('keydown', { key: 'ArrowRight', shiftKey: true })
    const moved = wrapper.emitted('change')![1]![0] as BoardElement[]
    expect(moved[1]?.x).toBe(44)
    wrapper.unmount()
  })
})
