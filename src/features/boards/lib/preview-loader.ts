import { getBoardPreview } from '@/shared/lib/boards/board-preview.service'
import type { BoardPreview } from './preview-model'

const cache = new Map<string, BoardPreview>()
const queue: { run: () => Promise<void> }[] = []
let active = 0,
  consumers = 0,
  generation = 0
function drain() {
  while (active < 2 && queue.length) {
    const job = queue.shift()!
    active++
    void job.run().finally(() => {
      active--
      drain()
    })
  }
}
export function retainPaperPreviews() {
  consumers++
}
export function releasePaperPreviews() {
  consumers = Math.max(0, consumers - 1)
  if (!consumers) {
    cache.clear()
    generation++
  }
}
export function loadPaperPreview(
  id: string,
  revision: number,
  signal: AbortSignal
): Promise<BoardPreview> {
  const key = `${id}:${revision}`,
    epoch = generation
  const cached = cache.get(key)
  if (cached && !signal.aborted) {
    cache.delete(key)
    cache.set(key, cached)
    return Promise.resolve(cached)
  }
  return new Promise((resolve, reject) => {
    queue.push({
      run: async () => {
        try {
          if (signal.aborted || epoch !== generation)
            throw new DOMException('Aborted', 'AbortError')
          const preview = await getBoardPreview(id)
          if (signal.aborted || epoch !== generation)
            throw new DOMException('Aborted', 'AbortError')
          if (preview.revision === revision) {
            cache.set(key, preview)
            while (cache.size > 12) cache.delete(cache.keys().next().value!)
          }
          resolve(preview)
        } catch (error) {
          reject(error)
        }
      },
    })
    drain()
  })
}
