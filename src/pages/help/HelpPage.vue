<script setup lang="ts">
import {
  Bell,
  CalendarDays,
  CheckCircle2,
  Clock3,
  Hash,
  HelpCircle,
  HeartHandshake,
  KeyRound,
  LockKeyhole,
  Moon,
  Plus,
  Settings,
  ShieldCheck,
  Sun,
} from '@lucide/vue'

import HelpKey from '@/features/help/components/HelpKey.vue'
import HelpSteps from '@/features/help/components/HelpSteps.vue'
import HelpTaskPreview from '@/features/help/components/HelpTaskPreview.vue'
import HelpTopic from '@/features/help/components/HelpTopic.vue'
import HelpCreatorSupport from '@/features/help/components/HelpCreatorSupport.vue'
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'

const { t } = useI18n()
const topics = computed(() => [
  { id: 'comece', label: t('help.topics.start'), icon: KeyRound },
  { id: 'criar', label: t('help.topics.create'), icon: Plus },
  { id: 'visoes', label: t('help.topics.views'), icon: CalendarDays },
  { id: 'lembretes', label: t('help.topics.reminders'), icon: Bell },
  { id: 'detalhes', label: t('help.topics.details'), icon: Hash },
  { id: 'concluir', label: t('help.topics.complete'), icon: CheckCircle2 },
  { id: 'privacidade', label: t('help.topics.privacy'), icon: ShieldCheck },
  { id: 'sobre', label: t('help.topics.support'), icon: HeartHandshake },
])

const vaultSteps = computed(() => [
  t('help.access.steps.0'),
  t('help.access.steps.1'),
  t('help.access.steps.2'),
])

const reminderSteps = computed(() => [
  t('help.reminder.steps.0'),
  t('help.reminder.steps.1'),
  t('help.reminder.steps.2'),
])

function scrollToTopic(topicId: string) {
  document.getElementById(topicId)?.scrollIntoView({
    behavior: 'smooth',
    block: 'start',
  })
}
</script>

<template>
  <section class="mx-auto grid max-w-5xl gap-8">
    <header class="grid gap-4 border-b border-border pb-7">
      <div class="flex items-center gap-3 text-blue">
        <HelpCircle :size="24" />
        <span class="text-caption font-semibold uppercase">{{ t('help.eyebrow') }}</span>
      </div>
      <div class="grid max-w-3xl gap-2">
        <h1 class="text-display text-ink">{{ t('help.title') }}</h1>
        <p class="text-body leading-6 text-ink-soft">
          {{ t('help.intro') }}
        </p>
      </div>

      <div class="flex flex-wrap gap-x-6 gap-y-3 border-t border-border pt-4">
        <HelpKey
          :keys="['Ctrl', 'N']"
          :label="t('help.shortcutContext')"
        />
        <HelpKey
          :keys="['Ctrl', 'Shift', 'N']"
          :label="t('help.shortcutFree')"
        />
      </div>
    </header>

    <div class="grid items-start gap-8 desktop:grid-cols-[13rem_minmax(0,1fr)]">
      <nav
        class="grid gap-1 desktop:sticky desktop:top-8"
        :aria-label="t('help.topicsLabel')"
      >
        <span class="mb-2 text-caption font-semibold uppercase text-ink-muted">{{
          t('help.inThisGuide')
        }}</span>
        <button
          v-for="topic in topics"
          :key="topic.id"
          type="button"
          class="flex items-center gap-2 border-l-2 border-transparent px-3 py-2 text-left text-body text-ink-soft hover:border-blue hover:bg-hover hover:text-ink"
          @click="scrollToTopic(topic.id)"
        >
          <component
            :is="topic.icon"
            :size="17"
          />
          <span>{{ topic.label }}</span>
        </button>
      </nav>

      <main class="grid gap-10">
        <HelpTopic
          id="comece"
          :eyebrow="t('help.access.eyebrow')"
          :title="t('help.access.title')"
          :description="t('help.access.description')"
          :icon="KeyRound"
        >
          <HelpSteps :steps="vaultSteps" />

          <template #visual>
            <div class="grid gap-3 border border-border bg-surface p-4">
              <span class="text-caption font-semibold uppercase text-ink-muted">{{
                t('help.access.existing')
              }}</span>
              <div
                class="flex items-center gap-3 border border-border bg-paper px-3 py-3"
              >
                <LockKeyhole
                  :size="19"
                  class="text-blue"
                />
                <div class="min-w-0 flex-1">
                  <p class="text-body font-semibold text-ink">planejamento.praxis</p>
                  <p class="truncate text-small text-ink-muted">
                    C:\...\Praxis\planejamento.praxis
                  </p>
                </div>
              </div>
              <div class="flex items-center gap-2 text-small font-semibold text-sage">
                <ShieldCheck :size="16" />
                {{ t('help.access.recognized') }}
              </div>
            </div>
          </template>
        </HelpTopic>

        <HelpTopic
          id="criar"
          :eyebrow="t('help.capture.eyebrow')"
          :title="t('help.capture.title')"
          :description="t('help.capture.description')"
          :icon="Plus"
        >
          <div class="grid gap-5">
            <div class="grid gap-2">
              <HelpKey
                :keys="['Ctrl', 'N']"
                :label="t('help.capture.contextLabel')"
              />
              <p class="text-body leading-6 text-ink-soft">
                {{ t('help.capture.contextBody') }}
              </p>
            </div>
            <div class="grid gap-2">
              <HelpKey
                :keys="['Ctrl', 'Shift', 'N']"
                :label="t('help.capture.freeLabel')"
              />
              <p class="text-body leading-6 text-ink-soft">
                {{ t('help.capture.freeBody') }}
              </p>
            </div>
          </div>

          <template #visual>
            <div class="grid gap-3 border border-border bg-surface p-4">
              <span class="text-caption font-semibold uppercase text-ink-muted">{{
                t('help.capture.newTask')
              }}</span>
              <div class="border border-blue bg-paper px-3 py-2 text-body text-ink">
                {{ t('help.capture.exampleTitle') }}
              </div>
              <div class="grid grid-cols-2 gap-2">
                <div
                  class="border border-border bg-paper px-3 py-2 text-small text-ink-soft"
                >
                  {{ t('help.capture.todayTime') }}
                </div>
                <div
                  class="border border-border bg-paper px-3 py-2 text-small text-ink-soft"
                >
                  {{ t('help.capture.reminderTime') }}
                </div>
              </div>
              <div class="flex justify-end">
                <span
                  class="bg-accent px-3 py-2 text-small font-semibold text-on-accent"
                  >{{ t('help.capture.createTask') }}</span
                >
              </div>
            </div>
          </template>
        </HelpTopic>

        <HelpTopic
          id="visoes"
          :eyebrow="t('help.views.eyebrow')"
          :title="t('help.views.title')"
          :description="t('help.views.description')"
          :icon="CalendarDays"
        >
          <div class="grid border-t border-border">
            <div class="grid grid-cols-[8rem_1fr] gap-4 border-b border-border py-3">
              <strong class="text-body text-ink">{{ t('nav.today') }}</strong>
              <span class="text-body text-ink-soft">{{ t('help.views.today') }}</span>
            </div>
            <div class="grid grid-cols-[8rem_1fr] gap-4 border-b border-border py-3">
              <strong class="text-body text-ink">{{ t('nav.week') }}</strong>
              <span class="text-body text-ink-soft">{{ t('help.views.week') }}</span>
            </div>
            <div class="grid grid-cols-[8rem_1fr] gap-4 border-b border-border py-3">
              <strong class="text-body text-ink">{{ t('nav.pending') }}</strong>
              <span class="text-body text-ink-soft">{{ t('help.views.pending') }}</span>
            </div>
            <div class="grid grid-cols-[8rem_1fr] gap-4 border-b border-border py-3">
              <strong class="text-body text-ink">{{ t('nav.reminders') }}</strong>
              <span class="text-body text-ink-soft">{{ t('help.views.reminders') }}</span>
            </div>
          </div>

          <template #visual>
            <div class="grid grid-cols-4 gap-2 border border-border bg-surface p-4">
              <div
                class="grid h-20 place-items-center border border-blue bg-blue text-on-accent"
              >
                <span class="text-small">{{ t('help.preview.weekdays.0') }}</span
                ><strong class="text-heading">23</strong>
              </div>
              <div
                class="grid h-20 place-items-center border border-border bg-paper text-ink"
              >
                <span class="text-small">{{ t('help.preview.weekdays.1') }}</span
                ><strong class="text-heading">24</strong>
              </div>
              <div
                class="grid h-20 place-items-center border border-border bg-paper text-ink"
              >
                <span class="text-small">{{ t('help.preview.weekdays.2') }}</span
                ><strong class="text-heading">25</strong>
              </div>
              <div
                class="grid h-20 place-items-center border border-border bg-paper text-ink"
              >
                <span class="text-small">{{ t('help.preview.weekdays.3') }}</span
                ><strong class="text-heading">26</strong>
              </div>
            </div>
          </template>
        </HelpTopic>

        <HelpTopic
          id="lembretes"
          :eyebrow="t('help.reminder.eyebrow')"
          :title="t('help.reminder.title')"
          :description="t('help.reminder.description')"
          :icon="Bell"
        >
          <HelpSteps :steps="reminderSteps" />

          <template #visual>
            <HelpTaskPreview
              :title="t('help.reminder.exampleTitle')"
              :note="t('help.reminder.exampleNote')"
              show-reminder
            />
          </template>
        </HelpTopic>

        <HelpTopic
          id="detalhes"
          :eyebrow="t('help.details.eyebrow')"
          :title="t('help.details.title')"
          :description="t('help.details.description')"
          :icon="Hash"
        >
          <div class="grid gap-4">
            <p class="text-body leading-6 text-ink-soft">
              {{ t('help.details.checklist') }}
            </p>
            <p class="text-body leading-6 text-ink-soft">
              {{ t('help.details.tags') }}
            </p>
            <p class="text-body leading-6 text-ink-soft">
              {{ t('help.details.inlineTag') }}
            </p>
          </div>

          <template #visual>
            <HelpTaskPreview
              :title="t('help.details.exampleTitle')"
              :note="t('help.details.exampleNote')"
              show-checklist
            />
          </template>
        </HelpTopic>

        <HelpTopic
          id="concluir"
          :eyebrow="t('help.lifecycle.eyebrow')"
          :title="t('help.lifecycle.title')"
          :description="t('help.lifecycle.description')"
          :icon="CheckCircle2"
        >
          <div class="grid gap-4 text-body leading-6 text-ink-soft">
            <p>{{ t('help.lifecycle.toggle') }}</p>
            <p>
              {{ t('help.lifecycle.archive') }}
            </p>
            <p>
              {{ t('help.lifecycle.restore') }}
            </p>
          </div>

          <template #visual>
            <div class="grid gap-3">
              <HelpTaskPreview
                :title="t('help.lifecycle.completedExample')"
                state="completed"
              />
              <HelpTaskPreview
                :title="t('help.lifecycle.archivedExample')"
                state="archived"
              />
            </div>
          </template>
        </HelpTopic>

        <HelpTopic
          id="privacidade"
          :eyebrow="t('help.privacy.eyebrow')"
          :title="t('help.privacy.title')"
          :description="t('help.privacy.description')"
          :icon="Settings"
        >
          <div class="grid gap-4">
            <p class="text-body leading-6 text-ink-soft">
              {{ t('help.privacy.database') }}
            </p>
            <p class="text-body leading-6 text-ink-soft">
              {{ t('help.privacy.theme') }}
            </p>
          </div>

          <template #visual>
            <div class="grid gap-3 border border-border bg-surface p-4">
              <div class="flex items-center justify-between border-b border-border pb-3">
                <span class="flex items-center gap-2 text-body text-ink"
                  ><ShieldCheck :size="17" /> {{ t('help.privacy.encryption') }}</span
                >
                <strong class="text-small text-sage">{{
                  t('help.privacy.active')
                }}</strong>
              </div>
              <div class="grid grid-cols-2 border border-border bg-paper p-1">
                <span
                  class="flex items-center justify-center gap-2 bg-ink px-3 py-2 text-small text-paper"
                >
                  <Sun :size="15" /> {{ t('settings.paper') }}
                </span>
                <span
                  class="flex items-center justify-center gap-2 px-3 py-2 text-small text-ink-soft"
                >
                  <Moon :size="15" /> {{ t('settings.dark') }}
                </span>
              </div>
              <div class="flex items-center gap-2 text-small text-ink-muted">
                <Clock3 :size="15" />
                {{ t('help.privacy.lastUpdate') }}
              </div>
            </div>
          </template>
        </HelpTopic>

        <HelpTopic
          id="sobre"
          eyebrow="08 · Praxis"
          :title="t('help.supportTitle')"
          :description="t('help.supportDescription')"
          :icon="HeartHandshake"
        >
          <HelpCreatorSupport />

          <template #visual>
            <div class="grid gap-4 border border-border bg-surface p-5">
              <div
                class="flex h-12 w-12 items-center justify-center border border-border bg-paper text-accent"
              >
                <HeartHandshake :size="24" />
              </div>
              <div class="grid gap-2">
                <span class="text-heading text-ink">{{
                  t('help.supportVisualTitle')
                }}</span>
                <p class="text-body leading-6 text-ink-soft">
                  {{ t('help.supportVisualBody') }}
                </p>
              </div>
              <div
                class="border-l-2 border-sage pl-3 text-small leading-5 text-ink-muted"
              >
                {{ t('help.supportVisualNote') }}
              </div>
            </div>
          </template>
        </HelpTopic>

        <footer
          class="flex flex-wrap items-center justify-between gap-4 border-t border-border py-6"
        >
          <div class="grid gap-1">
            <span class="text-heading text-ink">{{ t('help.footerTitle') }}</span>
            <span class="text-body text-ink-soft">{{ t('help.footerBody') }}</span>
          </div>
          <RouterLink
            to="/app/today"
            class="flex items-center gap-2 bg-blue px-4 py-2 text-body font-semibold text-on-accent"
          >
            <CalendarDays :size="17" />
            {{ t('help.goToday') }}
          </RouterLink>
        </footer>
      </main>
    </div>
  </section>
</template>
