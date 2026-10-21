<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import type { PostitView, PostitMode } from '@/shared/types/postit'
import { CheckCircle2 } from '@lucide/vue'
import { useI18n } from 'vue-i18n'
import PostitNote from '@/features/postits/components/PostitNote.vue'
const props = defineProps<{ stage: 'capture' | 'edit' | 'done' }>()
const { t } = useI18n()

const revision = ref(1)
const preferred = ref<PostitMode>('micro')
const temporary = ref<PostitMode | null>(null)
const expanded = computed(() => (temporary.value ?? preferred.value) === 'expanded')
const body = ref<string | null>(null)
const title = ref<string | null>(null)
watch(
  () => props.stage,
  (stage) => {
    preferred.value = stage === 'edit' ? 'expanded' : 'micro'
    temporary.value = null
    body.value = null
    title.value = null
    revision.value = 1
  },
  { immediate: true }
)
const note = computed(() => ({
  title: title.value ?? t('help.postits.exampleTitle'),
  record: {
    id: 'help-only',
    title: title.value ?? t('help.postits.exampleTitle'),
    body: body.value ?? t('help.postits.exampleBody'),
    revision: revision.value,
    color: 'yellow' as const,
    pinned: true,
    collapsed: !expanded.value,
    preferredMode: preferred.value,
    archived: false,
  },
}))
function save(
  values: { body: string; title: string },
  settled: (note: PostitView | string) => void
) {
  body.value = values.body
  title.value = values.title
  revision.value++
  settled(note.value)
}
</script>
<template>
  <figure class="grid gap-3 border border-border bg-surface p-4">
    <span class="text-caption font-semibold uppercase text-ink-muted">{{
      t('help.postits.illustration')
    }}</span>
    <div class="grid min-h-64 place-items-center border border-border bg-paper p-4">
      <div
        v-if="stage === 'done'"
        class="grid justify-items-center gap-3 text-center text-ink"
      >
        <CheckCircle2
          :size="36"
          class="text-sage"
        />
        <strong>{{ t('postits.complete') }}</strong>
        <span class="text-small text-ink-soft">{{ t('postits.retention') }}</span>
        <span class="border border-border bg-surface px-3 py-2 text-small">{{
          t('postits.restore')
        }}</span>
      </div>
      <div
        v-else
        :style="{
          width:
            expanded || temporary === 'expanded'
              ? '340px'
              : temporary === 'compact' || preferred === 'compact'
                ? '248px'
                : '180px',
          height:
            expanded || temporary === 'expanded'
              ? '380px'
              : temporary === 'compact' || preferred === 'compact'
                ? '132px'
                : '40px',
          maxWidth: '100%',
        }"
      >
        <PostitNote
          :note="note"
          @present="temporary = $event"
          @mode="preferred = $event"
          @save="save"
          @unpin="preferred = 'micro'"
          @complete="preferred = 'micro'"
        />
      </div>
    </div>
    <figcaption class="text-small leading-5 text-ink-soft">
      {{ t('help.postits.' + stage + '.caption') }}
    </figcaption>
  </figure>
</template>
