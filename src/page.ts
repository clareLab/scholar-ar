import lead from "./about/about.md?lead";
import { sentence } from "./about/sentence";
import type { Lang } from "./about/words";
import type { Node } from "./data";
import { origin, years } from "./state";

export type Head = {
	lang: string;
	title: string;
	description: string;
	path: string;
	about: boolean;
	dataset?: string;
	scholar?: { authors: string[]; date: string; pdf: string };
};

export type Ssr = {
	path: string;
	rows: number;
	got: Map<string, unknown>;
	wait: Map<string, Promise<unknown>>;
	head?: () => Head | undefined;
};

const labels = { institutions: "Institutions", venues: "Venues" };

const up = (path: string, nodes: Map<number, Node>) => {
	const parts = path.split("/").filter(Boolean);
	const [id, tab = "institutions"] = parts;
	if (
		/^[1-9]\d*$/.test(id) &&
		parts.length <= 2 &&
		(tab === "institutions" || tab === "venues")
	) {
		const node = nodes.get(Number(id));
		const at = parts.length === 1 ? node?.id : node?.parent?.id;
		return `/${at ? `${at}/` : ""}${tab}/`;
	}
	parts.pop();
	return parts.length ? `/${parts.join("/")}/` : "/institutions/";
};

export const climb = async (
	path: string,
	nodes: Map<number, Node>,
	exists: (path: string) => Promise<boolean>,
) => {
	let at = up(path, nodes);
	while (at !== "/institutions/" && !(await exists(at))) at = up(at, nodes);
	return at;
};

export const plain = (event: MouseEvent) =>
	event.button === 0 &&
	!event.metaKey &&
	!event.ctrlKey &&
	!event.shiftKey &&
	!event.altKey;

const swallow = (event: Event) => {
	event.stopPropagation();
	event.preventDefault();
};

const disarm = () => removeEventListener("click", swallow, true);

export const outside = (box: HTMLElement, close: () => void) => {
	const down = (event: PointerEvent) => {
		if (box.contains(event.target as Element)) return;
		addEventListener("click", swallow, { capture: true, once: true });
		addEventListener("pointerdown", disarm, { capture: true, once: true });
		addEventListener("keydown", disarm, { capture: true, once: true });
		close();
	};
	addEventListener("pointerdown", down, true);
	return { destroy: () => removeEventListener("pointerdown", down, true) };
};

export const save = (blob: Blob, name: string) => {
	const anchor = document.createElement("a");
	anchor.href = URL.createObjectURL(blob);
	anchor.download = name;
	anchor.click();
	setTimeout(() => URL.revokeObjectURL(anchor.href), 65536);
};

const length = (text: string) => [...text].length;

export const view = (
	tab: "institutions" | "venues",
	node: Node,
	from: number,
	to: number,
	tiers: number[],
	entries: [number, string][],
	path: string,
): Head => {
	const trail: string[] = [];
	for (let at = node.parent; at?.parent; at = at.parent) trail.unshift(at.name);
	const named = tiers.map((t) => `T${t}`);
	let description = [
		trail.join(" / "),
		`${from}–${to}`,
		named.length > 1
			? `${named.slice(0, -1).join(", ")} and ${named[named.length - 1]}`
			: named.join(""),
	]
		.filter(Boolean)
		.join(", ");
	description += ".";
	for (const [k, [rank, name]] of entries.entries()) {
		const next = `${description}${k ? ", " : " "}${rank} ${name}`;
		if (length(next) > 155) break;
		description = next;
	}
	return {
		lang: "en",
		title: `${node.name} | ${labels[tab]} | AllRankings`,
		description,
		path,
		about: false,
		dataset: path === "/institutions/" ? lead : undefined,
	};
};

export const about = (
	lang: Lang,
	paper: {
		title: string;
		abstract: string;
		authors: { name: string }[];
		issued: string;
		pdf: string;
	},
): Head => ({
	lang: lang === "zh" ? "zh-Hans" : lang,
	title: paper.title,
	description: sentence(paper.abstract),
	path: `/${lang}/about/`,
	about: true,
	scholar:
		lang === "en"
			? {
					authors: paper.authors.map((author) => author.name),
					date: paper.issued,
					pdf: `${origin}/${paper.pdf}`,
				}
			: undefined,
});

export const quote = (text: string) =>
	text
		.replace(/&/g, "&amp;")
		.replace(/"/g, "&quot;")
		.replace(/</g, "&lt;")
		.replace(/>/g, "&gt;");

export const tags = (head: Head) => {
	const url = `${origin}${head.path}`;
	const meta = (key: string, name: string, content: string) =>
		`<meta ${key}="${name}" content="${quote(content)}" />`;
	const out = [
		meta("name", "description", head.description),
		`<link rel="canonical" href="${url}" />`,
		meta("property", "og:title", head.title),
		meta("property", "og:description", head.description),
		meta("property", "og:url", url),
		meta("property", "og:type", "website"),
		meta("property", "og:site_name", "AllRankings"),
		meta("name", "twitter:card", "summary"),
	];
	if (head.about)
		for (const [hreflang, lang] of [
			["en", "en"],
			["zh-Hans", "zh"],
			["x-default", "en"],
		])
			out.push(
				`<link rel="alternate" hreflang="${hreflang}" href="${origin}/${lang}/about/" />`,
			);
	if (head.scholar)
		out.push(
			meta("name", "citation_title", head.title),
			...head.scholar.authors.map((name) =>
				meta("name", "citation_author", name),
			),
			meta("name", "citation_publication_date", head.scholar.date),
			meta("name", "citation_pdf_url", head.scholar.pdf),
		);
	if (head.dataset)
		out.push(
			`<script type="application/ld+json">${JSON.stringify({
				"@context": "https://schema.org",
				"@type": "Dataset",
				name: "AllRankings",
				description: head.dataset,
				url,
				creator: { "@type": "Organization", name: "clareLab" },
				temporalCoverage: years.join("/"),
				isBasedOn: "https://openalex.org",
			}).replace(/</g, "\\u003c")}</script>`,
		);
	return out;
};

const managed = [
	'meta[name="description"]',
	'link[rel="canonical"]',
	'link[rel="alternate"]',
	'meta[property^="og:"]',
	'meta[name="twitter:card"]',
	'meta[name^="citation_"]',
	'script[type="application/ld+json"]',
].join(", ");

export const apply = (head: Head) => {
	document.documentElement.lang = head.lang;
	document.title = head.title;
	for (const old of document.head.querySelectorAll(managed)) old.remove();
	document.head.insertAdjacentHTML("beforeend", tags(head).join(""));
};
