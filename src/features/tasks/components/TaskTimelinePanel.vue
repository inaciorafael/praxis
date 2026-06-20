<script setup lang="ts">
import type { LifecycleEvent, LifecycleValueChange } from "@/shared/types/lifecycle";

defineProps<{
  events: LifecycleEvent[];
}>();

function formatEventDate(value: string) {
  return new Intl.DateTimeFormat("pt-BR", {
    dateStyle: "short",
    timeStyle: "short",
  }).format(new Date(value));
}

function eventDetails(event: LifecycleEvent) {
  if (!event.metadata) {
    return "";
  }

  if ("dueAt" in event.metadata && event.metadata.dueAt) {
    return describeChange("Vencimento", event.metadata.dueAt);
  }

  if ("scheduledAt" in event.metadata && event.metadata.scheduledAt) {
    return describeChange("Lembrete", event.metadata.scheduledAt);
  }

  if ("plannedFor" in event.metadata && event.metadata.plannedFor) {
    return describeChange("Planejamento", event.metadata.plannedFor);
  }

  if ("name" in event.metadata && event.metadata.name) {
    return describeChange("Nome", event.metadata.name);
  }

  return "";
}

function describeChange(label: string, change: LifecycleValueChange) {
  if (change.from && change.to) {
    return `${label}: ${change.from} -> ${change.to}`;
  }

  if (change.to) {
    return `${label}: ${change.to}`;
  }

  if (change.from) {
    return `${label} removido`;
  }

  return "";
}
</script>

<template>
  <section class="grid gap-3" aria-label="Timeline da tarefa">
    <p v-if="!events.length" class="text-sm text-ink-muted">Nenhum evento registrado para esta tarefa.</p>

    <ol v-else class="grid gap-3">
      <li v-for="event in events" :key="event.id" class="praxis-row grid gap-1 p-3">
        <div class="flex flex-wrap items-center justify-between gap-2">
          <strong class="text-sm text-ink">{{ event.summary }}</strong>
          <time class="text-xs text-ink-muted" :datetime="event.occurredAt">
            {{ formatEventDate(event.occurredAt) }}
          </time>
        </div>

        <p v-if="eventDetails(event)" class="text-xs text-ink-soft">
          {{ eventDetails(event) }}
        </p>

        <span class="text-[11px] font-semibold uppercase text-accent">
          {{ event.actor.type }}
        </span>
      </li>
    </ol>
  </section>
</template>
