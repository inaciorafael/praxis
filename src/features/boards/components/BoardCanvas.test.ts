import { mount } from '@vue/test-utils'
import { createI18n } from 'vue-i18n'
import { nextTick } from 'vue'
import { describe, expect, it, vi } from 'vitest'
import BoardCanvas from './BoardCanvas.vue'
import BoardRichTextEditor from './BoardRichTextEditor.vue'
import { plainToRich } from '../lib/rich-text'
import type { BoardElement } from '@/shared/types/board'
vi.mock('@/shared/lib/boards/board-export.service', () => ({ saveBoardPng: vi.fn() }))
async function pointer(
  element: Element,
  type: string,
  pointerId: number,
  clientX: number,
  clientY: number,
  modifiers: MouseEventInit = {}
) {
  const event = new MouseEvent(type, { bubbles: true, button: 0, clientX, clientY, ...modifiers })
  Object.defineProperty(event, 'pointerId', { value: pointerId })
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
    expect((wrapper.emitted('change')!.slice(-1)[0]![0] as BoardElement[])[0]).toMatchObject({
      kind: 'draw', strokeStyle: 'pencil', strokeWidth: 6, opacity: .45, strokeColor: '#336699',
    })
    wrapper.unmount()
  })

  it('updates brush properties on the selection and restores each property through undo', async () => {
    const wrapper = mountCanvas([{ ...note, kind: 'rectangle', strokeWidth: 2, opacity: 1, strokeColor: '#000000' }])
    const viewport = wrapper.get('.board-viewport')
    await pointer(wrapper.get('[data-element-id]').element, 'pointerdown', 1, 70, 70)
    await pointer(viewport.element, 'pointerup', 1, 70, 70)
    await wrapper.get('[data-tool-settings]').trigger('click')
    await wrapper.get('[data-brush-width]').setValue('8')
    await wrapper.get('[data-brush-opacity]').setValue('30')
    await wrapper.get('[data-brush-color]').setValue('#996633')
    expect((wrapper.emitted('change')!.slice(-1)[0]![0] as BoardElement[])[0]).toMatchObject({ strokeWidth: 8, opacity: .3, strokeColor: '#996633' })
    await viewport.trigger('keydown', { key: 'z', ctrlKey: true })
    expect((wrapper.emitted('change')!.slice(-1)[0]![0] as BoardElement[])[0]).toMatchObject({ strokeWidth: 8, opacity: .3, strokeColor: '#000000' })
    await viewport.trigger('keydown', { key: 'z', ctrlKey: true })
    await viewport.trigger('keydown', { key: 'z', ctrlKey: true })
    expect((wrapper.emitted('change')!.slice(-1)[0]![0] as BoardElement[])[0]).toMatchObject({ strokeWidth: 2, opacity: 1, strokeColor: '#000000' })
    wrapper.unmount()
  })

  it('keeps the pen active across strokes and allows switching to selection for editing', async () => {
    const wrapper = mountCanvas()
    const viewport = wrapper.get('.board-viewport')
    await viewport.trigger('keydown', { key: 'b' })
    for (const [pointerId, x] of [[1, 300], [2, 420]]) {
      await pointer(viewport.element, 'pointerdown', pointerId!, x!, 300)
      await pointer(viewport.element, 'pointermove', pointerId!, x! + 60, 340)
      await pointer(viewport.element, 'pointerup', pointerId!, x! + 60, 340)
      expect(wrapper.get('[data-tool="pen"]').attributes('aria-pressed')).toBe('true')
    }
    expect((wrapper.emitted('change')!.slice(-1)[0]![0] as BoardElement[])).toHaveLength(2)
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
    expect((wrapper.emitted('change')!.slice(-1)[0]![0] as BoardElement[])[1]).toMatchObject({ kind: 'draw', strokeStyle: 'pen' })
    await wrapper.get('[data-element-id="note"]').trigger('dblclick')
    expect(wrapper.vm.isInteracting()).toBe(true)
    expect(wrapper.find('.board-text-editor').exists()).toBe(true)
    await wrapper.get('textarea').setValue('Hidden controls, working editor')
    window.dispatchEvent(new Event('praxis:commit-board-edit'))
    expect(wrapper.vm.isInteracting()).toBe(false)
    expect((wrapper.emitted('change')!.slice(-1)[0]![0] as BoardElement[])[0]?.text).toBe('Hidden controls, working editor')
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
    for (const [key, tool, strokeStyle] of [['b', 'pen', 'pen'], ['p', 'draw', 'pencil']]) {
      const wrapper = mountCanvas()
      const viewport = wrapper.get('.board-viewport')
      await viewport.trigger('keydown', { key })
      expect(wrapper.get(`[data-tool="${tool}"]`).attributes('aria-pressed')).toBe('true')
      await pointer(viewport.element, 'pointerdown', 1, 100, 100)
      await pointer(viewport.element, 'pointermove', 1, 160, 140)
      await pointer(viewport.element, 'pointerup', 1, 160, 140)
      expect((wrapper.emitted('change')![0]![0] as BoardElement[])[0]).toMatchObject({ kind: 'draw', strokeStyle })
      wrapper.unmount()
    }
  })

  it.each(['shiftKey', 'ctrlKey'] as const)('shows four corner handles and preserves aspect ratio with %s', async modifier => {
    const wrapper = mountCanvas([{ ...note, kind: 'rectangle' }])
    const viewport = wrapper.get('.board-viewport')
    await pointer(wrapper.get('[data-element-id]').element, 'pointerdown', 1, 70, 70)
    await pointer(viewport.element, 'pointerup', 1, 70, 70)
    expect(wrapper.findAll('[data-resize-handle]').map(handle => handle.attributes('data-resize-handle')).sort()).toEqual(['ne', 'nw', 'se', 'sw'])
    await pointer(wrapper.get('[data-resize-handle="se"]').element, 'pointerdown', 2, 230, 170)
    await pointer(viewport.element, 'pointermove', 2, 410, 200, { [modifier]: true })
    await pointer(viewport.element, 'pointerup', 2, 410, 200, { [modifier]: true })
    const resized = (wrapper.emitted('change')!.slice(-1)[0]![0] as BoardElement[])[0]!
    expect(resized.width / resized.height).toBeCloseTo(1.5)
    expect(resized.width).not.toBe(note.width)
    wrapper.unmount()
  })

  it('resizes from the center with Alt and restores geometry with undo', async () => {
    const wrapper = mountCanvas([{ ...note, kind: 'rectangle' }])
    const viewport = wrapper.get('.board-viewport')
    await pointer(wrapper.get('[data-element-id]').element, 'pointerdown', 1, 70, 70)
    await pointer(viewport.element, 'pointerup', 1, 70, 70)
    await pointer(wrapper.get('[data-resize-handle="se"]').element, 'pointerdown', 2, 230, 170)
    await pointer(viewport.element, 'pointermove', 2, 290, 210, { altKey: true })
    await pointer(viewport.element, 'pointerup', 2, 290, 210, { altKey: true })
    const resized = (wrapper.emitted('change')!.slice(-1)[0]![0] as BoardElement[])[0]!
    expect(resized.x + resized.width / 2).toBeCloseTo(100)
    expect(resized.y + resized.height / 2).toBeCloseTo(70)
    await viewport.trigger('keydown', { key: 'z', ctrlKey: true })
    expect((wrapper.emitted('change')!.slice(-1)[0]![0] as BoardElement[])[0]).toMatchObject({ x: 10, y: 10, width: 180, height: 120 })
    wrapper.unmount()
  })

  it('snaps handle rotation to fifteen degrees and supports keyboard rotation with undo', async () => {
    const wrapper = mountCanvas([{ ...note, kind: 'rectangle' }])
    const viewport = wrapper.get('.board-viewport')
    await pointer(wrapper.get('[data-element-id]').element, 'pointerdown', 1, 70, 70)
    await pointer(viewport.element, 'pointerup', 1, 70, 70)
    await pointer(wrapper.get('[data-rotate]').element, 'pointerdown', 2, 140, 10)
    await pointer(viewport.element, 'pointermove', 2, 210, 75, { shiftKey: true })
    await pointer(viewport.element, 'pointerup', 2, 210, 75, { shiftKey: true })
    const angle = (wrapper.emitted('change')!.slice(-1)[0]![0] as BoardElement[])[0]!.angle!
    expect(angle / (Math.PI / 12)).toBeCloseTo(Math.round(angle / (Math.PI / 12)))
    await viewport.trigger('keydown', { key: 'ArrowRight', altKey: true })
    const turned = (wrapper.emitted('change')!.slice(-1)[0]![0] as BoardElement[])[0]!
    expect(turned.angle).toBeCloseTo(angle + Math.PI / 12)
    await viewport.trigger('keydown', { key: 'z', ctrlKey: true })
    expect((wrapper.emitted('change')!.slice(-1)[0]![0] as BoardElement[])[0]!.angle).toBeCloseTo(angle)
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
    expect((wrapper.get('textarea').element as HTMLTextAreaElement).value).toBe('Before')
    await wrapper.get('textarea').setValue('Edited shape')
    await wrapper.get('.board-text-editor button').trigger('click')
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
    await wrapper.find('[data-text-highlight="yellow"]').trigger('click')
    const highlighted = wrapper.emitted('change')!.slice(-1)[0]![0] as BoardElement[]
    expect(highlighted[0]).toMatchObject({
      textFont: 'handwritten',
      textHighlight: 'yellow',
    })
    expect(wrapper.find('[data-handwritten]').exists()).toBe(true)
    await viewport.trigger('keydown', { key: 'z', ctrlKey: true })
    expect(
      (wrapper.emitted('change')!.slice(-1)[0]![0] as BoardElement[])[0]?.textHighlight
    ).toBe('none')
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
    await wrapper.find('.board-text-editor button').trigger('click')
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
    await wrapper.find('textarea').setValue('After')
    expect(wrapper.emitted('change')).toBeUndefined()
    await wrapper.find('.board-text-editor button').trigger('click')
    expect((wrapper.emitted('change')![0]![0] as BoardElement[])[0]?.text).toBe('After')
    await wrapper.find('.board-viewport').trigger('keydown', { key: 'z', ctrlKey: true })
    expect((wrapper.emitted('change')![1]![0] as BoardElement[])[0]?.text).toBe('Before')
    wrapper.unmount()
  })
  it('does not delete selected elements when the user types in the textarea', async () => {
    const wrapper = mountCanvas([note])
    await wrapper.find('[data-element-id]').trigger('dblclick')
    await wrapper.find('textarea').trigger('keydown', { key: 'Backspace' })
    expect(wrapper.findAll('[data-element-id]')).toHaveLength(1)
    expect(wrapper.emitted('change')).toBeUndefined()
    wrapper.unmount()
  })
  it('drops undo history at an external task-link update boundary', async () => {
    const wrapper = mountCanvas([note])
    await wrapper.find('[data-element-id]').trigger('dblclick')
    await wrapper.find('textarea').setValue('After')
    await wrapper.find('.board-text-editor button').trigger('click')
    await wrapper.setProps({ elements: [{ ...note, kind: 'task', taskId: 'task-1' }] })
    await wrapper.find('.board-viewport').trigger('keydown', { key: 'z', ctrlKey: true })
    expect(wrapper.emitted('change')).toHaveLength(1)
    wrapper.unmount()
  })
  it('commits the current text once before a lifecycle flush and removes its listener', async () => {
    const removeListener = vi.spyOn(window, 'removeEventListener')
    const wrapper = mountCanvas([note])
    await wrapper.find('[data-element-id]').trigger('dblclick')
    await wrapper.find('textarea').setValue('Typed before locking')
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
    await wrapper.find('.board-text-editor button').trigger('click')
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
