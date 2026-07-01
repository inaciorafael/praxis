<script setup lang="ts">
import { Check, Clipboard, Code2, Coffee, ExternalLink, Heart } from '@lucide/vue'
import { openUrl } from '@tauri-apps/plugin-opener'
import { onBeforeUnmount, ref } from 'vue'
import { useI18n } from 'vue-i18n'

import { praxisSupport } from '@/shared/config/support'

const pixKey = import.meta.env.VITE_PRAXIS_PIX_KEY?.trim() || praxisSupport.pixKey
const { t } = useI18n()
const copied = ref(false)
const copyError = ref(false)
const supportLinkError = ref(false)
let copiedTimer: number | null = null

async function copyPixKey() {
  if (!pixKey) {
    return
  }

  try {
    await navigator.clipboard.writeText(pixKey)
    copied.value = true
    copyError.value = false
  } catch {
    copied.value = false
    copyError.value = true
    return
  }

  if (copiedTimer !== null) {
    window.clearTimeout(copiedTimer)
  }

  copiedTimer = window.setTimeout(() => {
    copied.value = false
    copiedTimer = null
  }, 2400)
}

async function openBuyMeACoffee() {
  supportLinkError.value = false

  try {
    await openUrl(praxisSupport.buyMeACoffeeUrl)
  } catch {
    supportLinkError.value = true
  }
}

onBeforeUnmount(() => {
  if (copiedTimer !== null) {
    window.clearTimeout(copiedTimer)
  }
})
</script>

<template>
  <div class="grid gap-5">
    <div class="grid gap-3 text-body leading-6 text-ink-soft">
      <p>{{ t('support.intro1', { name: praxisSupport.creatorName }) }}</p>
      <p>{{ t('support.intro2') }}</p>
    </div>

    <div class="flex flex-wrap gap-x-5 gap-y-2 text-small text-ink-muted">
      <span class="flex items-center gap-2">
        <Heart :size="15" />
        {{ t('support.optional') }}
      </span>
      <span class="flex items-center gap-2">
        <Coffee :size="15" />
        {{ t('support.noSubscription') }}
      </span>
      <span class="flex items-center gap-2">
        <Code2 :size="15" />
        {{ t('support.independent') }}
      </span>
    </div>

    <div
      class="flex flex-wrap items-center justify-between gap-4 border border-border bg-surface p-4"
    >
      <div class="grid gap-1">
        <span class="text-caption font-semibold uppercase text-ink-muted">
          {{ t('support.international') }}
        </span>
        <span class="text-body text-ink-soft">
          {{ t('support.internationalDescription') }}
        </span>
        <span
          v-if="supportLinkError"
          class="text-small text-brick"
          role="status"
        >
          {{ t('support.openError') }}
        </span>
      </div>

      <button
        type="button"
        class="inline-flex min-h-10 shrink-0 items-center gap-2 border border-accent bg-accent px-4 py-2 text-body font-semibold text-on-accent hover:bg-orange"
        @click="openBuyMeACoffee"
      >
        <Coffee :size="17" />
        Buy me a coffee
        <ExternalLink :size="15" />
      </button>
    </div>

    <div class="grid gap-4 border border-border bg-surface p-4">
      <div class="grid gap-1">
        <span class="text-caption font-semibold uppercase text-ink-muted">
          {{ t('support.pix') }}
        </span>
        <span class="text-body text-ink-soft">
          {{ t('support.pixDescription') }}
        </span>
      </div>

      <div class="grid gap-4 tablet:grid-cols-[14rem_minmax(0,1fr)]">
        <div class="grid place-items-center border border-border bg-white p-3">
          <img
            :src="praxisSupport.pixQrCodeUrl"
            :alt="t('support.qrAlt')"
            class="aspect-square w-full max-w-52 object-contain"
            width="400"
            height="400"
          />
        </div>

        <div class="grid content-center gap-3">
          <div class="grid gap-1">
            <span class="text-small font-semibold text-ink">{{
              t('support.pixKey')
            }}</span>
            <code
              class="break-all border border-border bg-paper px-3 py-3 text-body text-ink"
            >
              {{ pixKey }}
            </code>
          </div>

          <button
            type="button"
            class="inline-flex min-h-10 w-fit items-center gap-2 bg-blue px-3 py-2 text-body font-semibold text-on-accent"
            @click="copyPixKey"
          >
            <Check
              v-if="copied"
              :size="17"
            />
            <Clipboard
              v-else
              :size="17"
            />
            {{ copied ? t('support.copied') : t('support.copy') }}
          </button>

          <span
            :class="['text-small', copyError ? 'text-brick' : 'text-ink-muted']"
            aria-live="polite"
          >
            {{
              copyError
                ? t('support.copyError')
                : copied
                  ? t('support.thanks')
                  : t('support.pixHint')
            }}
          </span>
        </div>
      </div>
    </div>
  </div>
</template>
