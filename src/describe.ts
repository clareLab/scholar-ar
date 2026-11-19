import type { Meta, Node } from "./data";
import { list, nation, plural, plurals, venueName } from "./poster/format";
import { grouped, type Selection } from "./state";
import { collate, lands } from "./tables";

export const places = (meta: Meta, at: string[]) => {
	const { groups, codes } = grouped(at, lands(meta));
	return [...groups, ...codes.map(nation).sort(collate)];
};

const series = (names: string[]) =>
	names.map((name, k) =>
		k === names.length - 1 && k
			? `and ${name}`
			: k < names.length - 2
				? `${name},`
				: name,
	);

const quoted = (name: string) => `“${name}”`;

export const describe = (meta: Meta, node: Node, s: Selection) => {
	const parts: string[][] = [
		[s.from === s.to ? `${s.from}` : `${s.from} to ${s.to}`],
		[list(s.tiers.map((t) => `T${t}`))],
	];
	const child = node.children[0]?.level;
	if (child) {
		const off = new Set(s.off);
		const dropped = node.children.filter((c) => off.has(c.id));
		const noun = plural(node.children.length, child, plurals(child));
		parts.push(
			dropped.length
				? [`all ${noun} except`, ...series(dropped.map((c) => quoted(c.name)))]
				: [`all ${noun}`],
		);
	}
	parts.push(
		s.at.length === lands(meta).length
			? ["all countries"]
			: series(places(meta, s.at)),
	);
	const tiers = new Set(s.tiers);
	const flips = s.flip
		.map((key) => {
			const [tier, id] = key.split(".").map(Number);
			return { tier, v: meta.venues.id.indexOf(id) };
		})
		.filter(({ v }) => v >= 0)
		.map(({ tier, v }) => ({ tier, name: venueName(meta.venues.name[v]) }))
		.sort((a, b) => a.tier - b.tier || collate(a.name, b.name));
	for (const [added, one, many] of [
		[true, "listing added:", "listings added:"],
		[false, "listing removed:", "listings removed:"],
	] as const) {
		const these = flips.filter((f) => tiers.has(f.tier) !== added);
		if (these.length)
			parts.push([
				plural(these.length, one, many),
				...series(these.map((f) => `T${f.tier} ${quoted(f.name)}`)),
			]);
	}
	return parts;
};
