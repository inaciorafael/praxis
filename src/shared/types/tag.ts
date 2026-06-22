export type Tag = {
	id: string;
	name: string;
	slug: string;
	color: string;
	createdAt: string;
	updatedAt: string;
};

export type TaskTag = {
	taskId: string;
	tagId: string;
};

export type CreateTagInput = {
	name: string;
	color: string;
};

export type UpdateTagInput = {
	name?: string;
	color?: string;
};

export type TagCollection = {
	tags: Tag[];
	taskTags: TaskTag[];
};
