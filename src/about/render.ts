import katex from "katex";
import MarkdownIt from "markdown-it";
import type { Words } from "./words/index.ts";

export type Section = { id: string; number: string; title: string };

export type Block =
	| { html: string }
	| { figure: string; number: number; caption: string; wide: boolean };

export type Part = { head: string; blocks: Block[]; subs: Part[] };

export type Paper = {
	title: string;
	date: string;
	abstract: string;
	sections: Section[];
	lead: Block[];
	parts: Part[];
};

const md = new MarkdownIt({ html: true, typographer: true });

const front = (text: string) => {
	const [, head, body] = text.match(/^---\n([\s\S]*?)\n---\n([\s\S]*)$/) ?? [];
	if (head === undefined) throw new Error("about.md needs a front matter");
	const meta: Record<string, string> = {};
	let key = "";
	for (const line of head.split("\n")) {
		const pair = line.match(/^(\w+):\s*(.*)$/);
		if (pair) {
			key = pair[1];
			meta[key] = pair[2] === "|" ? "" : pair[2];
		} else meta[key] += `${line.trim()}\n`;
	}
	return { meta, body };
};

const slug = (text: string) =>
	text
		.toLowerCase()
		.replace(/[^\p{L}\p{N}]+/gu, "-")
		.replace(/^-|-$/g, "");

export const paper = (text: string, words: Words): Paper => {
	const maths: string[] = [];
	const keep = (tex: string, displayMode: boolean) => {
		maths.push(katex.renderToString(tex, { displayMode, throwOnError: true }));
		return `%%${maths.length - 1}%%`;
	};
	const { meta, body } = front(
		text
			.replace(/\$\$([\s\S]+?)\$\$/g, (_, tex) => keep(tex, true))
			.replace(/(?<![\\$])\$(?!\s)([^$\n]+?)(?<!\s)\$/g, (_, tex) =>
				keep(tex, false),
			),
	);
	const lines = body.split("\n");

	const figures = new Map<string, number>();
	const refs = new Map<string, number>();
	let inRefs = false;
	for (const line of lines) {
		const fig = line.match(/^::: \{#fig:([a-z]+) \.figure( \.wide)?\}$/);
		if (fig) figures.set(fig[1], figures.size + 1);
		if (line === "::: {#refs}") inRefs = true;
		else if (line === ":::") inRefs = false;
		const ref = inRefs && line.match(/^\[([a-z0-9]+)\] /);
		if (ref) refs.set(ref[1], refs.size + 1);
	}
	const number = <T>(map: Map<string, T>, key: string) => {
		const n = map.get(key);
		if (n === undefined) throw new Error(`unknown reference: ${key}`);
		return n;
	};
	const cite = (line: string) =>
		line
			.replace(
				/\[(@[a-z0-9]+(?:; @[a-z0-9]+)*)\]/g,
				(_, keys: string) =>
					`\\[${keys
						.split("; ")
						.map(
							(key) => `[${number(refs, key.slice(1))}](#ref-${key.slice(1)})`,
						)
						.join(", ")}\\]`,
			)
			.replace(
				/@fig:([a-z]+)/g,
				(_, id) => `[${words.figure} ${number(figures, id)}](#fig-${id})`,
			);

	const blocks: Block[] = [];
	const parts: string[] = [];
	const mark = (block: Block) => {
		blocks.push(block);
		parts.push("", `<!--block ${blocks.length - 1}-->`, "");
	};
	let open: { id: string; wide: boolean; lines: string[] } | undefined;
	for (const line of lines) {
		const start = line.match(
			/^::: \{#(fig:([a-z]+) \.figure( \.wide)?|refs)\}$/,
		);
		if (start)
			open = { id: start[2] ?? "refs", wide: Boolean(start[3]), lines: [] };
		else if (open && line === ":::") {
			const { id, wide, lines: inner } = open;
			const text = inner.join("\n").trim();
			if (id === "refs")
				mark({
					html: `<ol class="refs">${text
						.split(/\n\s*\n/)
						.map((item) => {
							const [, key, rest] =
								item.match(/^\[([a-z0-9]+)\] ([\s\S]*)$/) ?? [];
							return `<li id="ref-${key}">${md.renderInline(cite(rest))}</li>`;
						})
						.join("")}</ol>`,
				});
			else
				mark({
					figure: id,
					number: number(figures, id),
					caption: md.renderInline(cite(text)),
					wide,
				});
			open = undefined;
		} else if (open) open.lines.push(line);
		else parts.push(cite(line));
	}

	const sections: Section[] = [];
	const counts = [0, 0];
	const tokens = md.parse(parts.join("\n"), {});
	tokens.forEach((token, k) => {
		if (token.type !== "heading_open") return;
		const depth = Number(token.tag.slice(1));
		const inline = tokens[k + 1];
		const plain = inline.content.replace(/\s*\{-\}$/, "");
		const numbered = plain === inline.content;
		inline.children = md.parseInline(plain, {})[0].children;
		token.tag = `h${depth + 1}`;
		tokens[k + 2].tag = token.tag;
		let label = "";
		if (numbered) {
			counts[depth - 1]++;
			if (depth === 1) counts[1] = 0;
			label = counts.slice(0, depth).join(".");
		}
		const id = slug(plain);
		token.attrSet("id", id);
		if (label) token.attrSet("data-number", label);
		if (depth === 1) sections.push({ id, number: label, title: plain });
	});
	md.renderer.rules.fence = (all, k) =>
		`<div class="code"><button class="copy" type="button">${words.copy}</button><pre><code>${md.utils.escapeHtml(all[k].content)}</code></pre></div>`;
	const html = md.renderer.render(tokens, md.options, {});
	const back = (text: string) =>
		text
			.replace(/<p>%%(\d+)%%<\/p>/g, (_, n) => maths[Number(n)])
			.replace(/%%(\d+)%%/g, (_, n) => maths[Number(n)]);
	const run = (html: string) => {
		const out: Block[] = [];
		html.split(/<!--block (\d+)-->\n?/).forEach((chunk, k) => {
			if (k % 2) {
				const block = blocks[Number(chunk)];
				out.push(
					"html" in block
						? { html: back(block.html) }
						: { ...block, caption: back(block.caption) },
				);
			} else if (chunk.trim()) out.push({ html: back(chunk) });
		});
		return out;
	};
	const [lead, ...rest] = html.split(/(?=<h[23][ >])/);
	const tree: Part[] = [];
	for (const chunk of lead.startsWith("<h") ? [lead, ...rest] : rest) {
		const [head, depth] = chunk.match(/^<h([23])[\s\S]*?<\/h\1>\n?/) ?? [""];
		const part: Part = {
			head: back(head),
			blocks: run(chunk.slice(head.length)),
			subs: [],
		};
		if (depth === "3" && tree.length) tree[tree.length - 1].subs.push(part);
		else tree.push(part);
	}
	return {
		title: meta.title ?? "",
		date: words.date(new Date()),
		abstract: back(md.render(cite(meta.abstract ?? ""))),
		sections,
		lead: lead.startsWith("<h") ? [] : run(lead),
		parts: tree,
	};
};
