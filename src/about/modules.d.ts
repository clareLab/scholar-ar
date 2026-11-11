declare module "*.md" {
	const built: unknown;
	export default built;
}

declare module "*.md?lead" {
	const lead: string;
	export default lead;
}
