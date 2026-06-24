import { execFileSync } from "node:child_process";
import { mkdirSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";

const outputDir = join(import.meta.dirname, "..", "src-tauri", "resources", "jump-list");
const temporaryDir = join(outputDir, ".svg");
const magick = "C:\\Program Files\\ImageMagick-7.1.1-Q16-HDRI\\magick.exe";

const icons = [
	["today", "calendar-days"],
	["my-week", "clock-3"],
];

rmSync(outputDir, { recursive: true, force: true });
mkdirSync(temporaryDir, { recursive: true });

for (const [name, lucideName] of icons) {
	const module = await import(
		`../node_modules/@lucide/vue/dist/esm/icons/${lucideName}.mjs`
	);
	const shapes = module.__iconNode
		.map(([tag, attributes]) => {
			const serializedAttributes = Object.entries(attributes)
				.filter(([key]) => key !== "key")
				.map(([key, value]) => `${key}="${value}"`)
				.join(" ");
			return `<${tag} ${serializedAttributes} />`;
		})
		.join("");
	const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="64" height="64" viewBox="0 0 64 64">
  <g transform="translate(8 8) scale(2)" fill="none" stroke="#526F7A" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round">
    ${shapes}
  </g>
</svg>`;
	const svgPath = join(temporaryDir, `${name}.svg`);
	const pngPath = join(outputDir, `${name}.png`);
	const iconPath = join(outputDir, `${name}.ico`);

	writeFileSync(svgPath, svg);
	execFileSync(magick, ["-background", "none", svgPath, pngPath]);
	execFileSync(magick, [
		pngPath,
		"-background",
		"none",
		"-define",
		"icon:auto-resize=64,48,32,24,20,16",
		iconPath,
	]);
}

rmSync(temporaryDir, { recursive: true, force: true });
