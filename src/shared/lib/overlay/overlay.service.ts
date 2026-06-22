import {
	markRaw,
	readonly,
	shallowReactive,
	type Component,
	type Raw,
} from "vue";

type OverlayProps = Record<string, unknown>;

type OverlayState = {
	visible: boolean;
	component: Raw<Component> | null;
	props: OverlayProps;
	closeOnBackdrop: boolean;
};

type OverlayOptions = {
	closeOnBackdrop?: boolean;
};

const state = shallowReactive<OverlayState>({
	visible: false,
	component: null,
	props: {},
	closeOnBackdrop: true,
});

export const overlayState = readonly(state);

export const overlay = {
	show(component: Component, props?: OverlayProps, options: OverlayOptions = {}) {
		state.component = markRaw(component);
		state.props = props ?? {};
		state.closeOnBackdrop = options.closeOnBackdrop ?? true;
		state.visible = true;
	},

	hide() {
		state.visible = false;
		state.component = null;
		state.props = {};
		state.closeOnBackdrop = true;
	},
};
