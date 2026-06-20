export type ChecklistItemStatus = "pending" | "completed";

export type ChecklistItem = {
  id: string;
  taskId: string;
  title: string;
  status: ChecklistItemStatus;
  sortOrder: number;
  completedAt: string | null;
  createdAt: string;
  updatedAt: string;
};

export type TaskProgress = {
  totalItems: number;
  completedItems: number;
  percentage: number;
};

export type CreateChecklistItemInput = {
  taskId: string;
  title: string;
};

export type UpdateChecklistItemInput = {
  title: string;
};
