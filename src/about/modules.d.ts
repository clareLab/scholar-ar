declare module "*.md" {
	const built: unknown;
	export default built;
}

declare module "*.md?lead" {
	const lead: string;
	export default lead;
}

declare module "virtual:snapshot" {
	const snapshot: string;
	export default snapshot;
}

declare module "virtual:years" {
	export const years: number[];
	export const defaults: number[];
}

declare module "virtual:release" {
	export const release: string;
	export const year: number;
}
