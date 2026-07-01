<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import dayjs from 'dayjs'
import { Moon, Sun } from '@lucide/vue'

import {
  checkForAppUpdate,
  downloadAndInstallAppUpdate,
  type AppUpdateInfo,
} from '@/shared/lib/app/app-update.service'
import { seedShowcaseData } from '@/shared/lib/tasks/task.service'
import { useAppStore } from '@/stores/app.store'
import { useBadgeStore } from '@/stores/badge.store'
import { useNotificationStore } from '@/stores/notification.store'
import { useTaskStore } from '@/stores/task.store'
import { useVaultStore } from '@/stores/vault.store'
import type { AppLanguage, AppTheme } from '@/shared/types/app'
import Toggle from '@/shared/ui/Toggle.vue'
import Select from '@/shared/ui/Select.vue'
import TagManager from '@/features/tags/components/TagManager.vue'
import { supportedLanguages } from '@/shared/lib/i18n/i18n'
import { useI18n } from 'vue-i18n'

const app = useAppStore()
const badge = useBadgeStore()
const notifications = useNotificationStore()
const tasks = useTaskStore()
const vault = useVaultStore()
const { t } = useI18n()
const updateInfo = ref<AppUpdateInfo | null>(null)
const updateStatus = ref('')
const isCheckingUpdate = ref(false)
const isInstallingUpdate = ref(false)
const showcaseStatus = ref('')
const isSeedingShowcase = ref(false)
const archiveStatus = ref('')
const isArchivingCompleted = ref(false)

const config = computed(() => app.config)
const dataFilePath = computed(() =>
  maskPath(vault.activeDataFilePath ?? vault.selectedDataFilePath)
)
const storageStatus = computed(() =>
  vault.active ? t('settings.vaultOpen') : t('settings.vaultLocked')
)
const selectedLanguage = computed(
  () =>
    supportedLanguages.find((language) => language.id === config.value?.language) ??
    supportedLanguages[0]
)

onMounted(async () => {
  await Promise.all([
    app.hydrateConfig(),
    vault.hydrate(),
    badge.hydrate(),
    notifications.hydrate(),
    vault.hydrateSafetyCopies(),
  ])
})

async function toggleNotifications(enabled: boolean) {
  if (enabled) {
    const granted = await notifications.requestPermission()

    if (!granted) {
      await app.updateConfig({ notificationsEnabled: false })
      return
    }
  } else {
    await notifications.cancelAll()
  }

  await app.updateConfig({ notificationsEnabled: enabled })
}

async function setTheme(theme: AppTheme) {
  await app.updateConfig({ theme })
}

async function setLanguage(language: string) {
  await app.updateConfig({ language: language as AppLanguage })
}

async function toggleBadge(enabled: boolean) {
  await app.updateConfig({ badgeEnabled: enabled })

  if (enabled) {
    await tasks.hydrateViewCounts()
    return
  }

  await badge.clear()
}

async function reloadVault() {
  await vault.reloadFromDisk()
}

async function prepareShowcase() {
  if (isSeedingShowcase.value) {
    return
  }

  isSeedingShowcase.value = true
  showcaseStatus.value = 'Preparando dados de showcase...'

  try {
    await tasks.applyCollection(await seedShowcaseData())
    await Promise.all([tasks.hydrateViewCounts(), vault.hydrate()])
    showcaseStatus.value =
      'Showcase pronto. O cofre aberto foi substituido por dados ilustrativos.'
  } catch (error) {
    showcaseStatus.value =
      error instanceof Error ? error.message : 'Nao foi possivel preparar o showcase.'
  } finally {
    isSeedingShowcase.value = false
  }
}

const selectedRetention = computed(() => {
  const value = config.value?.completedTaskRetentionDays ?? 'forever'

  return (
    retentionOptions.find((option) => option.id === String(value)) ?? retentionOptions[0]
  )
})

async function updateCompletedRetentionDays(value: string) {
  const retentionDays = value === 'forever' ? null : Number(value)
  await app.updateConfig({
    completedTaskRetentionDays: Number.isFinite(retentionDays) ? retentionDays : null,
  })
}

async function archiveCompletedNow() {
  const retentionDays = config.value?.completedTaskRetentionDays

  if (!retentionDays || isArchivingCompleted.value) {
    return
  }

  isArchivingCompleted.value = true
  archiveStatus.value = 'Arquivando tarefas concluídas antigas...'

  try {
    const beforeDate = dayjs().subtract(retentionDays, 'day').format('YYYY-MM-DD')
    await tasks.archiveCompletedBefore(beforeDate)
    await Promise.all([tasks.hydrateViewCounts(), vault.hydrate()])
    archiveStatus.value = `Concluídas antes de ${dayjs(beforeDate).format('DD/MM/YYYY')} foram arquivadas.`
  } catch (error) {
    archiveStatus.value =
      error instanceof Error
        ? error.message
        : 'Não foi possível arquivar tarefas concluídas.'
  } finally {
    isArchivingCompleted.value = false
  }
}

async function checkUpdate() {
  if (isCheckingUpdate.value || isInstallingUpdate.value) {
    return
  }

  isCheckingUpdate.value = true
  updateStatus.value = 'Verificando atualização...'

  try {
    updateInfo.value = await checkForAppUpdate()
    updateStatus.value = updateInfo.value
      ? `Versão ${updateInfo.value.version} disponível.`
      : 'Você já está na versão mais recente.'
  } catch (error) {
    updateInfo.value = null
    updateStatus.value =
      error instanceof Error ? error.message : 'Não foi possível verificar atualizações.'
  } finally {
    isCheckingUpdate.value = false
  }
}

async function installUpdate() {
  if (!updateInfo.value || isInstallingUpdate.value) {
    return
  }

  isInstallingUpdate.value = true
  updateStatus.value = 'Baixando atualização...'

  try {
    await downloadAndInstallAppUpdate((progress) => {
      updateStatus.value =
        progress.percentage === null
          ? 'Baixando atualização...'
          : `Baixando atualização... ${progress.percentage}%`
    })
  } catch (error) {
    updateStatus.value =
      error instanceof Error ? error.message : 'Não foi possível instalar a atualização.'
    isInstallingUpdate.value = false
  }
}

function formatDate(value: string | null) {
  return value ? dayjs(value).format('DD/MM/YYYY HH:mm') : 'Não disponível'
}

function yesNo(value: boolean | undefined) {
  return value ? 'Ativado' : 'Desativado'
}

function maskPath(value: string | null) {
  if (!value) {
    return 'Não selecionado'
  }

  const normalized = value.replace(/\//g, '\\')
  const parts = normalized.split('\\').filter(Boolean)
  const filename = parts[parts.length - 1] ?? normalized
  const root = normalized.match(/^[A-Za-z]:/)?.[0] ?? ''

  return root ? `${root}\\...\\${filename}` : `...\\${filename}`
}

const retentionOptions = [
  { id: 'forever', label: 'Manter sempre' },
  { id: '180', label: 'Após 6 meses' },
  { id: '365', label: 'Após 1 ano' },
  { id: '730', label: 'Após 2 anos' },
]
</script>

<template>
  <section class="grid max-w-4xl gap-6">
    <div class="flex flex-col gap-1">
      <span class="text-display">{{ t('settings.title') }}</span>
      <span class="text-body text-ink-soft"
        >{{ t('settings.subtitle') }}</span
      >
    </div>

    <div class="grid border border-border bg-surface">
      <div class="flex items-center justify-between gap-6 p-4">
        <div class="grid gap-1">
          <span class="text-heading">{{ t('settings.language') }}</span>
          <span class="text-body text-ink-soft">{{ t('settings.languageDescription') }}</span>
        </div>
        <Select
          class="max-w-64"
          :items="supportedLanguages"
          :model-value="selectedLanguage"
          @update:model-value="setLanguage(String($event.id))"
        >
          <template #selected="{ item }"><span>{{ item?.label }}</span></template>
          <template #item="{ item }"><span>{{ item.label }}</span></template>
        </Select>
      </div>
    </div>

    <div class="grid border border-border bg-surface">
      <div class="grid gap-5 p-4">
        <div class="grid gap-1">
          <span class="text-heading">{{ t('settings.appearance') }}</span>
          <span class="text-body text-ink-soft">
            {{ t('settings.appearanceDescription') }}
          </span>
        </div>

        <div
          class="grid gap-3 tablet:grid-cols-2"
          aria-label="Tema do aplicativo"
        >
          <button
            type="button"
            :aria-pressed="config?.theme === 'light'"
            :class="[
              'grid gap-3 border p-3 text-left transition-colors',
              config?.theme === 'light'
                ? 'border-accent bg-selection'
                : 'border-border bg-paper hover:border-border-strong hover:bg-hover',
            ]"
            @click="setTheme('light')"
          >
            <span
              class="theme-preview-paper grid h-20 grid-cols-[2.5rem_1fr] overflow-hidden border border-border"
            >
              <span
                class="border-r"
                style="
                  background: var(--preview-surface);
                  border-color: var(--preview-border);
                "
              ></span>
              <span
                class="grid content-center gap-2 p-3"
                style="background: var(--preview-paper)"
              >
                <span
                  class="h-2 w-2/3"
                  style="background: var(--preview-ink)"
                ></span>
                <span
                  class="h-1.5 w-full opacity-40"
                  style="background: var(--preview-ink)"
                ></span>
                <span
                  class="h-1.5 w-4/5 opacity-25"
                  style="background: var(--preview-ink)"
                ></span>
              </span>
            </span>
            <span class="flex items-center justify-between gap-3">
              <span class="flex items-center gap-2 text-body font-semibold text-ink">
                <Sun :size="17" />
                {{ t('settings.paper') }}
              </span>
              <span class="text-small text-ink-muted">{{ t('settings.paperHint') }}</span>
            </span>
          </button>

          <button
            type="button"
            :aria-pressed="config?.theme === 'dark'"
            :class="[
              'grid gap-3 border p-3 text-left transition-colors',
              config?.theme === 'dark'
                ? 'border-accent bg-selection'
                : 'border-border bg-paper hover:border-border-strong hover:bg-hover',
            ]"
            @click="setTheme('dark')"
          >
            <span
              class="theme-preview-dark grid h-20 grid-cols-[2.5rem_1fr] overflow-hidden border border-border"
            >
              <span
                class="border-r"
                style="
                  background: var(--preview-surface);
                  border-color: var(--preview-border);
                "
              ></span>
              <span
                class="grid content-center gap-2 p-3"
                style="background: var(--preview-paper)"
              >
                <span
                  class="h-2 w-2/3"
                  style="background: var(--preview-ink)"
                ></span>
                <span
                  class="h-1.5 w-full opacity-40"
                  style="background: var(--preview-ink)"
                ></span>
                <span
                  class="h-1.5 w-4/5 opacity-25"
                  style="background: var(--preview-ink)"
                ></span>
              </span>
            </span>
            <span class="flex items-center justify-between gap-3">
              <span class="flex items-center gap-2 text-body font-semibold text-ink">
                <Moon :size="17" />
                {{ t('settings.dark') }}
              </span>
              <span class="text-small text-ink-muted">{{ t('settings.darkHint') }}</span>
            </span>
          </button>
        </div>
      </div>
    </div>

    <TagManager />

    <div class="grid border border-border bg-surface">
      <div class="flex items-center justify-between gap-6 border-b border-border p-4">
        <div class="grid gap-1">
          <span class="text-heading">{{ t('settings.notifications') }}</span>
          <span class="text-body text-ink-soft"
            >{{ t('settings.notificationsDescription') }}</span
          >
        </div>

        <Toggle
          :checked="config?.notificationsEnabled"
          @change="toggleNotifications"
        />
      </div>

      <div class="flex items-center justify-between gap-6 border-b border-border p-4">
        <div class="grid gap-1">
          <span class="text-heading">{{ t('settings.badge') }}</span>
          <span class="text-body text-ink-soft"
            >{{ t('settings.badgeDescription') }}</span
          >
        </div>

        <Toggle
          :checked="config?.badgeEnabled"
          @change="toggleBadge"
        />
      </div>

      <div class="flex items-center justify-between gap-6 border-b border-border p-4">
        <div class="grid gap-1">
          <span class="text-heading">{{ t('settings.startWindows') }}</span>
          <span class="text-body text-ink-soft"
            >{{ t('settings.startWindowsDescription') }}</span
          >
        </div>

        <Toggle
          :checked="config?.startWithWindows"
          @change="app.updateConfig({ startWithWindows: !config?.startWithWindows })"
        />
      </div>

      <div class="flex items-center justify-between gap-6 border-b border-border p-4">
        <div class="grid gap-1">
          <span class="text-heading">{{ t('settings.startMinimized') }}</span>
          <span class="text-body text-ink-soft"
            >{{ t('settings.startMinimizedDescription') }}</span
          >
        </div>

        <Toggle
          :checked="config?.startMinimized"
          @change="app.updateConfig({ startMinimized: !config?.startMinimized })"
        />
      </div>

      <div class="flex items-center justify-between gap-6 p-4">
        <div class="grid gap-1">
          <span class="text-heading">{{ t('settings.minimizeTray') }}</span>
          <span class="text-body text-ink-soft"
            >{{ t('settings.minimizeTrayDescription') }}</span
          >
        </div>

        <Toggle
          :checked="config?.minimizeToTrayWhenUnlocked"
          @change="
            app.updateConfig({
              minimizeToTrayWhenUnlocked: !config?.minimizeToTrayWhenUnlocked,
            })
          "
        />
      </div>
    </div>

    <div class="grid border border-border bg-surface">
      <div class="flex items-center justify-between gap-6 border-b border-border p-4">
        <div class="grid gap-1">
          <span class="text-heading">Arquivar concluídas antigas</span>
          <span class="text-body text-ink-soft">
            Remove tarefas concluídas antigas das telas principais sem apagar o histórico
            do cofre.
          </span>
          <span
            v-if="archiveStatus"
            class="text-body font-semibold text-ink"
          >
            {{ archiveStatus }}
          </span>
        </div>

        <Select
          :items="retentionOptions"
          :model-value="selectedRetention"
          @update:model-value="updateCompletedRetentionDays($event.id)"
          placeholder="Selecione a prioridade"
        >
          <template #selected="{ item }">
            <span v-if="item">{{ item.label }}</span>
            <span
              v-else
              class="text-ink-soft"
              >Selecione a prioridade</span
            >
          </template>

          <template #item="{ item }">
            <div class="flex flex-col">
              <span class="font-medium">{{ item.label }}</span>
            </div>
          </template>
        </Select>
      </div>

      <div class="flex items-center justify-between gap-6 p-4">
        <div class="grid gap-1">
          <span class="text-heading">Arquivamento manual</span>
          <span class="text-body text-ink-soft">
            Executa agora a política escolhida acima. Tarefas pendentes nunca são
            arquivadas.
          </span>
        </div>

        <div class="flex shrink-0 gap-2">
          <RouterLink
            to="/app/archived"
            class="border border-border bg-paper px-3 py-2 text-body font-semibold text-ink hover:bg-hover"
          >
            Ver arquivadas
          </RouterLink>
          <button
            type="button"
            class="border border-border bg-paper px-3 py-2 text-body font-semibold text-ink hover:bg-hover disabled:pointer-events-none disabled:opacity-50"
            :disabled="
              !vault.active || !config?.completedTaskRetentionDays || isArchivingCompleted
            "
            @click="archiveCompletedNow"
          >
            {{ isArchivingCompleted ? 'Arquivando...' : 'Arquivar agora' }}
          </button>
        </div>
      </div>
    </div>

    <div class="grid border border-border bg-surface">
      <div class="flex items-center justify-between gap-6 p-4">
        <div class="grid gap-1">
          <span class="text-heading">{{ t('settings.updates') }}</span>
          <span class="text-body text-ink-soft">
            {{ t('settings.updatesDescription') }}
          </span>
          <span
            v-if="updateStatus"
            class="text-body font-semibold text-ink"
          >
            {{ updateStatus }}
          </span>
        </div>

        <div class="flex shrink-0 gap-2">
          <button
            type="button"
            class="border border-border bg-paper px-3 py-2 text-body font-semibold text-ink hover:bg-hover disabled:pointer-events-none disabled:opacity-50"
            :disabled="isCheckingUpdate || isInstallingUpdate"
            @click="checkUpdate"
          >
            {{ isCheckingUpdate ? t('settings.checking') : t('settings.check') }}
          </button>

          <button
            type="button"
            class="border border-accent bg-accent px-3 py-2 text-body font-semibold text-on-accent disabled:pointer-events-none disabled:opacity-50"
            :disabled="!updateInfo || isInstallingUpdate"
            @click="installUpdate"
          >
            {{ isInstallingUpdate ? t('settings.installing') : t('settings.install') }}
          </button>
        </div>
      </div>
    </div>

    <div class="grid border border-border bg-surface">
      <div class="grid gap-1 border-b border-border p-4">
        <div class="flex justify-between gap-4">
          <span class="text-heading">{{ t('settings.database') }}</span>
          <span class="text-body font-semibold text-ink">{{ storageStatus }}</span>
        </div>
        <span class="text-body text-ink-soft"
          >O arquivo .praxis é a fonte local dos dados.</span
        >
      </div>

      <div class="grid gap-1 border-b border-border p-4">
        <div class="flex justify-between gap-4">
          <span class="text-heading">Arquivo do cofre</span>
          <span class="break-all text-right text-body font-semibold text-ink">{{
            dataFilePath
          }}</span>
        </div>
        <span class="text-body text-ink-soft"
          >Caminho mascarado para evitar exposição desnecessária.</span
        >
      </div>

      <div class="grid gap-1 border-b border-border p-4">
        <div class="flex justify-between gap-4">
          <span class="text-heading">{{ t('settings.encryption') }}</span>
          <span class="text-body font-semibold text-ink">{{ t('settings.active') }}</span>
        </div>
        <span class="text-body text-ink-soft"
          >O Praxis não exibe senha nem conteúdo bruto do cofre.</span
        >
      </div>

      <div class="grid gap-1 border-b border-border p-4">
        <div class="flex justify-between gap-4">
          <span class="text-heading">Credencial salva</span>
          <span class="text-body font-semibold text-ink">{{
            yesNo(vault.credentialSaved)
          }}</span>
        </div>
        <span class="text-body text-ink-soft"
          >Usada apenas para auto unlock local quando disponível.</span
        >
      </div>

      <div class="grid gap-1 border-b border-border p-4">
        <div class="flex justify-between gap-4">
          <span class="text-heading">Última atualização interna</span>
          <span class="text-body font-semibold text-ink">{{
            formatDate(vault.dataFileUpdatedAt)
          }}</span>
        </div>
        <span class="text-body text-ink-soft"
          >Marcador gravado dentro do arquivo .praxis.</span
        >
      </div>

      <div class="grid gap-1 border-b border-border p-4">
        <div class="flex justify-between gap-4">
          <span class="text-heading">Última modificação do arquivo</span>
          <span class="text-body font-semibold text-ink">{{
            formatDate(vault.dataFileModifiedAt)
          }}</span>
        </div>
        <span class="text-body text-ink-soft"
          >Data informada pelo sistema de arquivos.</span
        >
      </div>

      <div class="grid gap-1 p-4">
        <div class="flex justify-between gap-4">
          <span class="text-heading">Permissão de notificações</span>
          <span class="text-body font-semibold text-ink">{{
            notifications.permissionGranted ? 'Concedida' : 'Pendente'
          }}</span>
        </div>
        <span class="text-body text-ink-soft"
          >Permissão do sistema operacional para exibir lembretes.</span
        >
      </div>
    </div>

    <div class="grid border border-border bg-surface">
      <div class="flex items-center justify-between gap-6 p-4">
        <div class="grid gap-1">
          <span class="text-heading">Showcase para GitHub</span>
          <span class="text-body text-ink-soft">
            Substitui os dados do cofre aberto por tarefas ilustrativas para screenshots.
          </span>
          <span
            v-if="showcaseStatus"
            class="text-body font-semibold text-ink"
          >
            {{ showcaseStatus }}
          </span>
        </div>

        <button
          type="button"
          class="border border-brick bg-paper px-3 py-2 text-body font-semibold text-brick hover:bg-hover disabled:pointer-events-none disabled:opacity-50"
          :disabled="!vault.active || isSeedingShowcase"
          @click="prepareShowcase"
        >
          {{ isSeedingShowcase ? 'Preparando...' : 'Preparar showcase' }}
        </button>
      </div>
    </div>

    <div class="flex justify-end">
      <button
        class="border border-border bg-surface px-3 py-2 text-body font-semibold text-ink hover:bg-hover"
        @click="reloadVault"
      >
        {{ t('settings.reloadVault') }}
      </button>
    </div>
  </section>
</template>
