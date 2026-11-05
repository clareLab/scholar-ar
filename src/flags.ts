const files = import.meta.glob<string>(
	"../node_modules/flag-icons/flags/4x3/??.svg",
	{ eager: true, query: "?url&no-inline", import: "default" },
);

const urls = new Map(
	Object.entries(files).map(([file, url]) => [
		file.slice(-6, -4).toUpperCase(),
		url,
	]),
);

export const flag = (code: string) => urls.get(code);

const names = new Intl.DisplayNames(["en"], { type: "region" });

export const country = (code: string) => names.of(code) ?? code;
