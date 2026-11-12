import type { Item } from "./scene";

const quote = (value: unknown, attr: boolean) => {
	const text = String(value ?? "");
	const pattern = attr ? /[&"<]/g : /[&<]/g;
	let out = "";
	let last = 0;
	while (pattern.test(text)) {
		const i = pattern.lastIndex - 1;
		const ch = text[i];
		out +=
			text.substring(last, i) +
			(ch === "&" ? "&amp;" : ch === '"' ? "&quot;" : "&lt;");
		last = i + 1;
	}
	return out + text.substring(last);
};

const at = (name: string, value: unknown) =>
	value == null ? "" : ` ${name}="${quote(value, true)}"`;

const n = (v: number) => v.toFixed(1);

export const frame = "#a9afb8";

const draw = (list: Item[], flags: Map<string, string>, out: string[]) => {
	for (const item of list) {
		if (item.kind === "rect")
			out.push(
				`<rect${at("x", item.x)}${at("y", item.y)}${at("width", item.w)}${at("height", item.h)}${at("fill", item.fill)}${at("stroke", item.stroke)}${at("stroke-width", item.sw)}${at("fill-opacity", item.opacity)}></rect>`,
			);
		else if (item.kind === "text")
			out.push(
				`<text${at("x", item.x)}${at("y", item.y)}${at(
					"transform",
					item.rotate
						? `rotate(${item.rotate} ${item.x} ${item.y})`
						: undefined,
				)}${at("font-family", item.family)}${at("font-size", item.size)}${at("font-weight", item.weight)}${at("fill", item.fill)}${at(
					"text-anchor",
					item.anchor === "start" ? undefined : item.anchor,
				)}${at("letter-spacing", item.track || undefined)}${at(
					"stroke",
					item.halo ? "#ffffff" : undefined,
				)}${at("stroke-width", item.halo || undefined)}${at(
					"stroke-linejoin",
					item.halo ? "round" : undefined,
				)}${at("paint-order", item.halo ? "stroke" : undefined)}>${quote(item.text, false)}</text>`,
			);
		else if (item.kind === "dots") {
			out.push(
				`<g${at("fill", item.fill)}${at("fill-opacity", item.opacity)}${at("stroke", item.stroke)}${at("stroke-width", item.sw)}>`,
			);
			for (const [cx, cy, r] of item.dots)
				out.push(
					`<circle${at("cx", n(cx))}${at("cy", n(cy))}${at("r", n(r))}></circle>`,
				);
			out.push("</g>");
		} else if (item.kind === "line")
			out.push(
				`<line${at("x1", item.x1)}${at("y1", item.y1)}${at("x2", item.x2)}${at("y2", item.y2)}${at("stroke", item.stroke)}${at("stroke-width", item.sw)}${at("stroke-dasharray", item.dash)}></line>`,
			);
		else if (item.kind === "path")
			out.push(
				`<path${at("d", item.d)}${at("fill", item.fill)}${at("stroke", item.stroke)}${at("stroke-width", item.sw)}${at("fill-opacity", item.opacity)} stroke-linejoin="round"></path>`,
			);
		else if (item.kind === "flag") {
			if (flags.has(item.code))
				out.push(
					`<use href="#flag-${quote(item.code, true)}"${at("x", item.x)}${at("y", item.y)}${at("width", item.w)}${at("height", item.w * 0.75)}></use><rect${at("x", item.x + 0.5)}${at("y", item.y + 0.5)}${at("width", item.w - 1)}${at("height", item.w * 0.75 - 1)} fill="none" stroke="${frame}" stroke-width="1"></rect>`,
				);
		} else if (item.kind === "link") {
			out.push(`<a${at("href", item.href)}>`);
			draw(item.items, flags, out);
			out.push("</a>");
		}
	}
};

export const face = (family: string, weight: number, base64: string) =>
	`@font-face{font-family:'${family}';font-weight:${weight};font-style:normal;src:url(data:font/otf;base64,${base64}) format('opentype')}`;

export const svg = (
	items: Item[],
	width: number,
	height: number,
	flags: Map<string, string>,
	faces: string[],
	top = 0,
) => {
	const out = [
		`<?xml version="1.0" encoding="UTF-8"?>\n<svg xmlns="http://www.w3.org/2000/svg"${at("width", width)}${at("height", height)} viewBox="0 ${top} ${quote(width, true)} ${quote(height, true)}"><defs><style>${faces.join("")}</style>`,
	];
	for (const [code, uri] of flags)
		out.push(
			`<symbol id="flag-${quote(code, true)}" viewBox="0 0 640 480" preserveAspectRatio="none"><image width="640" height="480"${at("href", uri)} preserveAspectRatio="none"></image></symbol>`,
		);
	out.push("</defs>");
	draw(items, flags, out);
	out.push("</svg>\n");
	return out.join("");
};
