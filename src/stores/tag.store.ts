import { defineStore } from "pinia";

import {
	assignTagToTask,
	createTag,
	deleteTag,
	listTags,
	removeTagFromTask,
	updateTag,
} from "@/shared/lib/tags/tag.service";
import type {
	CreateTagInput,
	Tag,
	TagCollection,
	TaskTag,
	UpdateTagInput,
} from "@/shared/types/tag";

type TagStoreState = {
	tags: Tag[];
	taskTags: TaskTag[];
	selectedTagId: string;
	isReady: boolean;
	error: string;
};

export const useTagStore = defineStore("tags", {
	state: (): TagStoreState => ({
		tags: [],
		taskTags: [],
		selectedTagId: "",
		isReady: false,
		error: "",
	}),

	getters: {
		selectedTag(state) {
			return state.tags.find((tag) => tag.id === state.selectedTagId) ?? null;
		},

		tagsByTask(state) {
			const tagsById = new Map(state.tags.map((tag) => [tag.id, tag]));

			return state.taskTags.reduce<Record<string, Tag[]>>((index, relation) => {
				const tag = tagsById.get(relation.tagId);

				if (!tag) {
					return index;
				}

				index[relation.taskId] = [...(index[relation.taskId] ?? []), tag];
				return index;
			}, {});
		},
	},

	actions: {
		applyCollection(collection: TagCollection) {
			this.tags = collection.tags;
			this.taskTags = collection.taskTags;
			this.isReady = true;
			this.error = "";

			if (
				this.selectedTagId &&
				!this.tags.some((tag) => tag.id === this.selectedTagId)
			) {
				this.selectedTagId = "";
			}
		},

		resetLocal() {
			this.tags = [];
			this.taskTags = [];
			this.selectedTagId = "";
			this.isReady = false;
			this.error = "";
		},

		async hydrate() {
			try {
				this.applyCollection(await listTags());
			} catch (error) {
				this.error =
					error instanceof Error
						? error.message
						: "Abra o cofre para carregar tags.";
			}
		},

		async create(input: CreateTagInput) {
			try {
				this.applyCollection(await createTag(input));
				return true;
			} catch (error) {
				this.error =
					error instanceof Error
						? error.message
						: "Nao foi possivel criar a tag.";
				return false;
			}
		},

		async update(id: string, input: UpdateTagInput) {
			try {
				this.applyCollection(await updateTag(id, input));
				return true;
			} catch (error) {
				this.error =
					error instanceof Error
						? error.message
						: "Nao foi possivel atualizar a tag.";
				return false;
			}
		},

		async delete(id: string) {
			try {
				this.applyCollection(await deleteTag(id));
			} catch (error) {
				this.error =
					error instanceof Error
						? error.message
						: "Nao foi possivel remover a tag.";
			}
		},

		async assignToTask(taskId: string, tagId: string) {
			try {
				this.applyCollection(await assignTagToTask(taskId, tagId));
			} catch (error) {
				this.error =
					error instanceof Error
						? error.message
						: "Nao foi possivel atribuir a tag.";
			}
		},

		async removeFromTask(taskId: string, tagId: string) {
			try {
				this.applyCollection(await removeTagFromTask(taskId, tagId));
			} catch (error) {
				this.error =
					error instanceof Error
						? error.message
						: "Nao foi possivel remover a tag da tarefa.";
			}
		},

		selectTag(id: string) {
			this.selectedTagId = id;
		},
	},
});
