export type RecurrenceFrequency = "weekly" | "monthly" | "yearly";

export type RecurrenceRule = {
  id: string;
  title: string;
  notes: string | null;
  frequency: RecurrenceFrequency;
  interval: number;
  startsOn: string;
  endsOn: string | null;
  notify: boolean;
  reminderTime: string | null;
  createdAt: string;
  updatedAt: string;
};

export type CreateRecurrenceRuleInput = {
  title: string;
  notes?: string | null;
  frequency: RecurrenceFrequency;
  interval?: number | null;
  startsOn: string;
  endsOn?: string | null;
  notify: boolean;
  reminderTime?: string | null;
};

export type UpdateRecurrenceRuleInput = {
  title?: string;
  notes?: string | null;
  frequency?: RecurrenceFrequency;
  interval?: number;
  startsOn?: string;
  endsOn?: string | null;
  notify?: boolean;
  reminderTime?: string | null;
};

export type RecurrenceCollection = {
  recurrenceRules: RecurrenceRule[];
};
