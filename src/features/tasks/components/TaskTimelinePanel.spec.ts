import { mount } from "@vue/test-utils";
import { describe, expect, it } from "vitest";

import TaskTimelinePanel from "./TaskTimelinePanel.vue";
import type { LifecycleEvent } from "@/shared/types/lifecycle";

const baseEvent = {
  entityType: "task",
  entityId: "task-1",
  taskId: "task-1",
  occurredAt: "2026-06-18T15:00:00Z",
  actor: {
    type: "user",
  },
} satisfies Partial<LifecycleEvent>;

describe("TaskTimelinePanel", () => {
  it("renders an empty state when the task has no lifecycle events", () => {
    const wrapper = mount(TaskTimelinePanel, {
      props: {
        events: [],
      },
    });

    expect(wrapper.text()).toContain("Nenhum evento registrado para esta tarefa.");
  });

  it("renders useful task lifecycle summaries on screen", () => {
    const wrapper = mount(TaskTimelinePanel, {
      props: {
        events: [
          {
            ...baseEvent,
            id: "event-1",
            type: "taskCreated",
            summary: "Tarefa criada",
            metadata: {
              title: {
                to: "Enviar proposta",
              },
            },
          },
          {
            ...baseEvent,
            id: "event-2",
            type: "taskCompleted",
            summary: "Tarefa concluida",
            metadata: {
              completedAt: "2026-06-18T16:00:00Z",
            },
          },
        ],
      },
    });

    expect(wrapper.text()).toContain("Tarefa criada");
    expect(wrapper.text()).toContain("Tarefa concluida");
    expect(wrapper.text()).toContain("user");
    expect(wrapper.findAll("li")).toHaveLength(2);
  });

  it("renders date and reminder changes with visible details", () => {
    const wrapper = mount(TaskTimelinePanel, {
      props: {
        events: [
          {
            ...baseEvent,
            id: "event-1",
            type: "taskDueAtUpdated",
            summary: "Vencimento alterado",
            metadata: {
              dueAt: {
                from: "2026-06-18T12:00:00Z",
                to: "2026-06-19T12:00:00Z",
              },
            },
          },
          {
            ...baseEvent,
            entityType: "reminder",
            entityId: "task:task-1",
            id: "event-2",
            type: "reminderCreated",
            summary: "Lembrete criado",
            metadata: {
              scheduledAt: {
                to: "2026-06-18T15:00:00Z",
              },
            },
          },
        ],
      },
    });

    expect(wrapper.text()).toContain("Vencimento: 2026-06-18T12:00:00Z -> 2026-06-19T12:00:00Z");
    expect(wrapper.text()).toContain("Lembrete: 2026-06-18T15:00:00Z");
  });
});
