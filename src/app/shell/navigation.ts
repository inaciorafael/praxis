import type { Component } from "vue";

import {
  CalendarDays,
  CheckCircle2,
  Clock3,
  Inbox,
  AlertTriangle,
  Bell,
} from "@lucide/vue";

export type AppNavigationItem = {
  label: string;
  to: string;
  icon: Component;
  badgeKey:
  | "today"
  | "week"
  | "pending"
  | "overdue"
  | "reminders"
  | "completed";
};

export const appNavigationItems: AppNavigationItem[] = [
  {
    label: "Meu dia",
    to: "/app/today",
    icon: CalendarDays,
    badgeKey: "today",
  },
  {
    label: "Minha semana",
    to: "/app/my-week",
    icon: Clock3,
    badgeKey: "week",
  },
  {
    label: "Pendentes",
    to: "/app/pending",
    icon: Inbox,
    badgeKey: "pending",
  },
  {
    label: "Vencidas",
    to: "/app/overdue",
    icon: AlertTriangle,
    badgeKey: "overdue",
  },
  {
    label: "Lembretes",
    to: "/app/reminders",
    icon: Bell,
    badgeKey: "reminders",
  },
  {
    label: "Concluídas",
    to: "/app/completed",
    icon: CheckCircle2,
    badgeKey: "completed",
  },
];
