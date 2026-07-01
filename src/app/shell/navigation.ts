import type { Component } from 'vue'

import {
  CalendarDays,
  // CheckCircle2,
  Clock3,
  Inbox,
  AlertTriangle,
  // Archive,
  Bell,
  BookOpen,
  Settings,
} from '@lucide/vue'

export type AppNavigationItem = {
  labelKey: string
  to: string
  icon: Component
  badgeKey?: 'today' | 'week' | 'pending' | 'overdue' | 'reminders' | 'completed'
}

export const appNavigationItems: AppNavigationItem[] = [
  {
    labelKey: 'nav.today',
    to: '/app/today',
    icon: CalendarDays,
    badgeKey: 'today',
  },
  {
    labelKey: 'nav.week',
    to: '/app/my-week',
    icon: Clock3,
    badgeKey: 'week',
  },
  {
    labelKey: 'nav.pending',
    to: '/app/pending',
    icon: Inbox,
    badgeKey: 'pending',
  },
  {
    labelKey: 'nav.overdue',
    to: '/app/overdue',
    icon: AlertTriangle,
    badgeKey: 'overdue',
  },
  {
    labelKey: 'nav.reminders',
    to: '/app/reminders',
    icon: Bell,
    badgeKey: 'reminders',
  },
  // {
  // 	label: "Concluídas",
  // 	to: "/app/completed",
  // 	icon: CheckCircle2,
  // },
  // {
  // 	label: "Arquivadas",
  // 	to: "/app/archived",
  // 	icon: Archive,
  // },
  {
    labelKey: 'nav.settings',
    to: '/app/settings',
    icon: Settings,
  },
  {
    labelKey: 'nav.help',
    to: '/app/help',
    icon: BookOpen,
  },
]
