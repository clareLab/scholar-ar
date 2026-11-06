import { svelte } from "@sveltejs/vite-plugin-svelte";
import { defineConfig } from "vite";
import { about } from "./src/about/vite.ts";

export default defineConfig({
	base: "./",
	build: { license: { fileName: "licenses.md" } },
	plugins: [about(), svelte()],
});
