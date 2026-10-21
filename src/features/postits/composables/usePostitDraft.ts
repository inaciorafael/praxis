import { computed, onBeforeUnmount, reactive, ref, watch } from 'vue'
import type { PostitView } from '@/shared/types/postit'

export type PostitTextChange = { title: string; body: string; expectedRevision: number }
export function usePostitDraft(save: (value: PostitTextChange) => Promise<PostitView>) {
  const editing = ref(false),
    saving = ref(false),
    error = ref('')
  const draft = reactive({ title: '', body: '' })
  const base = reactive({ title: '', body: '', revision: 0 })
  let timer: ReturnType<typeof setTimeout> | undefined
  let flight: Promise<boolean> | undefined
  let disposed = false
  const dirty = computed(
    () => draft.title.trim() !== base.title || draft.body !== base.body
  )
  function begin(note: PostitView) {
    clearTimeout(timer)
    Object.assign(base, {
      title: note.record.title,
      body: note.record.body,
      revision: note.record.revision,
    })
    draft.title = base.title
    draft.body = base.body
    error.value = ''
    editing.value = true
  }
  function receive(note: PostitView) {
    if (!editing.value || saving.value || note.record.revision <= base.revision) return
    if (note.record.title === base.title && note.record.body === base.body)
      base.revision = note.record.revision
    else error.value = 'postits.adaptive.conflict'
  }
  async function flush(): Promise<boolean> {
    clearTimeout(timer)
    if (flight) {
      if (!(await flight)) return false
      return flush()
    }
    if (!dirty.value) return true
    if (error.value) return false
    if (!draft.title.trim() && !draft.body.trim()) {
      error.value = 'postits.adaptive.empty'
      return false
    }
    const sent = {
      title: draft.title.trim(),
      body: draft.body,
      expectedRevision: base.revision,
    }
    saving.value = true
    flight = (async () => {
      try {
        const updated = await save(sent)
        Object.assign(base, {
          title: updated.record.title,
          body: updated.record.body,
          revision: updated.record.revision,
        })
        return true
      } catch (reason) {
        if (!disposed) error.value = String(reason)
        return false
      } finally {
        saving.value = false
      }
    })()
    const success = await flight
    flight = undefined
    if (success && dirty.value && !disposed) return flush()
    return success
  }
  async function finish() {
    if (await flush()) {
      editing.value = false
      return true
    }
    return false
  }
  function retry() {
    error.value = ''
    return flush()
  }
  watch(
    () => [draft.title, draft.body],
    () => {
      clearTimeout(timer)
      if (
        error.value === 'postits.adaptive.empty' &&
        (draft.title.trim() || draft.body.trim())
      )
        error.value = ''
      if (editing.value && !error.value)
        timer = setTimeout(() => {
          void flush()
        }, 600)
    }
  )
  onBeforeUnmount(() => {
    disposed = true
    clearTimeout(timer)
  })
  return { draft, editing, saving, error, dirty, begin, receive, flush, finish, retry }
}
