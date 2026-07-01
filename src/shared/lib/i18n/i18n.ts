import { createI18n } from 'vue-i18n'

import en from '@/locales/en.json'
import ptBR from '@/locales/pt-BR.json'
import type { AppLanguage } from '@/shared/types/app'

export const defaultLanguage: AppLanguage = 'en'

export const supportedLanguages = [
  { id: 'en', label: 'English' },
  { id: 'pt-BR', label: 'Português (Brasil)' },
] as const

export const i18n = createI18n({
  legacy: false,
  locale: defaultLanguage,
  fallbackLocale: defaultLanguage,
  messages: {
    en,
    'pt-BR': ptBR,
  },
})

export function applyLanguage(language: AppLanguage) {
  i18n.global.locale.value = language
  document.documentElement.lang = language
}

export function translate(key: string, params?: Record<string, unknown>) {
  return i18n.global.t(key, params ?? {})
}
