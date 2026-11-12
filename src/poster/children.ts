import { cap, fit, measure, wrap } from "./fonts";
import {
	clean,
	fixed,
	percent,
	plural,
	scale,
	signed,
	snap,
	whole,
} from "./format";
import type { Data, Derived } from "./model";
import { grey, ink, paper, quiet, rule } from "./palette";
import { type Rect, type Scene, squarify } from "./scene";
import {
	blockTitle,
	cond,
	condSemi,
	type Grid,
	type Sheet,
	sans,
	sansMedium,
	sansSemi,
	titleBand,
} from "./sheet";

type Item = {
	height: number;
	draw: (scene: Scene, x: number, y: number) => void;
};

type Group = { kind: number; head: Item; items: Item[] };

type Column = { kind: number; items: Item[] };

const tile = "#e9ecf0";

const tileLabel = (name: string, w: number, h: number) => {
	const target = snap(Math.min(48, Math.sqrt(w * h) / 8));
	if (target < 12) return undefined;
	const sizes = scale.filter((v) => v >= 12 && v <= target).reverse();
	for (const size of sizes)
		for (const turn of h > w * 1.5 ? [false, true] : [false]) {
			const across = turn ? h : w;
			const down = turn ? w : h;
			const pad = Math.max(4, size * 0.4);
			const room = across - 2 * pad;
			if (room < size * 2) continue;
			const set = fit(name, size, condSemi, room, 4);
			if (!set) continue;
			const lead = Math.round(size * 1.08);
			const height = cap(size, condSemi) + (set.lines.length - 1) * lead;
			if (height > down - 2 * pad) continue;
			return { size, lines: set.lines, turn, height, lead };
		}
	return undefined;
};

const flowGroups = (groups: Group[], depth: number) => {
	const columns: Column[] = [];
	let current: Column | undefined;
	let used = 0;
	const open = (kind: number) => {
		current = { kind, items: [] };
		columns.push(current);
		used = 0;
	};
	for (const g of groups) {
		const lead =
			g.head.height +
			g.items.slice(0, 2).reduce((a, item) => a + item.height, 0);
		if (!current || current.kind !== g.kind || used + lead > depth)
			open(g.kind);
		const col = () => current as Column;
		col().items.push(g.head);
		used += g.head.height;
		for (const [k, item] of g.items.entries()) {
			const rest = g.items.length - k;
			const lone =
				rest === 2 &&
				k > 1 &&
				used + item.height <= depth &&
				used + item.height + g.items[k + 1].height > depth;
			if (used + item.height > depth || lone) {
				open(g.kind);
				col().items.push(g.head);
				used = g.head.height;
			}
			col().items.push(item);
			used += item.height;
		}
	}
	return columns;
};

const settle = (groups: Group[], n: number) => {
	const tallest = Math.max(
		...groups.flatMap((g) => [
			g.head.height + (g.items[0]?.height ?? 0),
			...g.items.map((i) => g.head.height + i.height),
		]),
	);
	const total = groups.reduce(
		(a, g) => a + g.head.height + g.items.reduce((b, i) => b + i.height, 0),
		0,
	);
	let lo = tallest - 1;
	let hi = Math.max(total, tallest) * 2;
	if (flowGroups(groups, hi).length > n) return flowGroups(groups, hi);
	while (hi - lo > 1) {
		const mid = Math.floor((lo + hi) / 2);
		if (flowGroups(groups, mid).length <= n) hi = mid;
		else lo = mid;
	}
	return flowGroups(groups, hi);
};

const split = (groups: Group[], n: number) => {
	const lists = groups.filter((g) => g.kind === 0);
	const leaders = groups.filter((g) => g.kind === 1);
	const depth = (columns: Column[]) =>
		Math.max(
			0,
			...columns.map((c) => c.items.reduce((a, r) => a + r.height, 0)),
		);
	if (!lists.length || !leaders.length) return settle(groups, n);
	let best: { columns: Column[]; cost: number; gap: number } | undefined;
	for (let k = 1; k < n; k++) {
		const a = settle(lists, k);
		const b = settle(leaders, n - k);
		if (a.length > k || b.length > n - k) continue;
		const cost = Math.max(depth(a), depth(b));
		const gap = Math.abs(depth(a) - depth(b));
		if (!best || cost < best.cost || (cost === best.cost && gap < best.gap))
			best = { columns: [...a, ...b], cost, gap };
	}
	return best ? best.columns : settle(groups, n);
};

export const childrenBlock = (
	data: Data,
	derived: Derived,
	s: number,
	grid: Grid,
): Sheet | undefined => {
	const kids = derived.children;
	if (!kids.length) return undefined;
	const p = Math.round(s * 1.36);
	const gap = Math.round(s * 0.7);
	const hs = Math.max(10, snap(s * 0.86));
	const level = data.levels.child ?? "child";
	const grand = data.levels.grandchild;
	const plural_ = (word: string) =>
		word.endsWith("y") ? `${word.slice(0, -1)}ies` : `${word}s`;
	const total = kids.reduce((a, k) => a + k.count, 0);
	const nested = kids.some((k) => k.grandchildren.length);
	const bandH = Math.round(s * 1.75);
	const body = nested ? 512 : 256;
	const width = grid.w;
	const numberW = Math.max(
		measure(whole(kids.length + data.zero.length), s, sansSemi),
		...kids.map((k) => measure(whole(k.grandchildren.length), s, sans)),
		...kids.flatMap((k) =>
			k.leaders.map((l) => measure(whole(l.rank), s, sans)),
		),
	);
	const nameX = Math.round(numberW + gap * 0.8);
	const flagW = Math.round(s * 1.2);
	const counts = [
		...kids.map((k) => fixed(k.count)),
		...kids.flatMap((k) => k.grandchildren.map((g) => fixed(g.count))),
		...kids.flatMap((k) => k.leaders.map((l) => fixed(l.count))),
	];
	const countW = Math.max(...counts.map((c) => measure(c, s, sansSemi)));
	const excessW = Math.max(
		measure("Excess", hs, sansMedium),
		...kids.flatMap((k) =>
			k.leaders.map((l) => measure(signed(l.excess), s, sans)),
		),
	);
	const barW = Math.round(s * 2.4);
	const topicCountX = width - barW - gap;
	const topicNameW = topicCountX - countW - gap - nameX;
	const leadCountX = width - excessW - gap;
	const leadNameX = nameX + flagW + Math.round(gap * 0.6);
	const leadNameW = leadCountX - countW - gap - leadNameX;
	if (topicNameW < s * 10 || leadNameW < s * 10) return undefined;
	const most = Math.max(
		1,
		...kids.flatMap((k) => k.grandchildren.map((g) => g.count)),
	);
	const groups: Group[] = [];
	const headItem = (n: string, name: string, value?: string): Item => {
		const lines = wrap(
			clean(name),
			s,
			condSemi,
			(value ? leadCountX - countW - gap : width) - nameX,
		);
		return {
			height: p * lines.length,
			draw: (scene, x, y) => {
				const b = y + p * 0.72;
				scene.text(x + numberW, b, n, s, sansSemi, ink, "end");
				for (const [k, line] of lines.entries())
					scene.text(x + nameX, b + k * p, line, s, condSemi, ink);
				if (value)
					scene.text(x + leadCountX, b, value, s, sansSemi, ink, "end");
			},
		};
	};
	if (nested)
		for (const [j, kid] of kids.entries()) {
			if (!kid.grandchildren.length) continue;
			groups.push({
				kind: 0,
				head: headItem(`${j + 1}`, kid.name),
				items: kid.grandchildren.map((g, i) => {
					const lines = wrap(clean(g.name), s, cond, topicNameW);
					return {
						height: p * lines.length,
						draw: (scene, x, y) => {
							const b = y + p * 0.72;
							scene.text(x + numberW, b, whole(i + 1), s, sans, quiet, "end");
							for (const [k, line] of lines.entries())
								scene.text(x + nameX, b + k * p, line, s, cond, ink);
							scene.text(
								x + topicCountX,
								b,
								fixed(g.count),
								s,
								sans,
								ink,
								"end",
							);
							const bw = Math.max(1, (g.count / most) * barW);
							scene.rect(x + width - barW, b - s * 0.62, bw, s * 0.62, quiet);
						},
					};
				}),
			});
		}
	for (const [j, kid] of kids.entries())
		groups.push({
			kind: 1,
			head: headItem(`${j + 1}`, kid.name, fixed(kid.count)),
			items: kid.leaders.map((l) => {
				const lines = wrap(clean(l.name), s, cond, leadNameW);
				return {
					height: p * lines.length,
					draw: (scene, x, y) => {
						const b = y + p * 0.72;
						scene.text(x + numberW, b, whole(l.rank), s, sans, quiet, "end");
						if (l.country)
							scene.flag(
								l.country,
								x + nameX,
								b - cap(s, cond) / 2 - (flagW * 0.75) / 2,
								flagW,
							);
						for (const [k, line] of lines.entries())
							scene.text(x + leadNameX, b + k * p, line, s, cond, ink);
						scene.text(x + leadCountX, b, fixed(l.count), s, sans, ink, "end");
						scene.text(x + width, b, signed(l.excess), s, sans, ink, "end");
					},
				};
			}),
		});
	if (data.zero.length) {
		const [from, to] = [data.selection.from, data.selection.to];
		const span = from === to ? `${from}` : `${from} to ${to}`;
		groups.push({
			kind: 1,
			head: {
				height: p,
				draw: (scene, x, y) =>
					scene.text(
						x + nameX,
						y + p * 0.72,
						`Count 0 in ${span}`,
						s,
						condSemi,
						grey,
					),
			},
			items: data.zero.map((z, i) => {
				const lines = wrap(clean(z.name), s, cond, width - nameX);
				return {
					height: p * lines.length,
					draw: (scene, x, y) => {
						const b = y + p * 0.72;
						scene.text(
							x + numberW,
							b,
							whole(kids.length + i + 1),
							s,
							sansSemi,
							ink,
							"end",
						);
						for (const [k, line] of lines.entries())
							scene.text(x + nameX, b + k * p, line, s, cond, ink);
					},
				};
			}),
		});
	}
	const headH = Math.round(p * 1.3);
	const top = titleBand + bandH + body + Math.round(p * 1.2);
	const columns = split(groups, grid.n);
	if (columns.length > grid.n) return undefined;
	const full = grid.n * grid.w + (grid.n - 1) * grid.g;
	const used = Math.max(
		...columns.map((c) => c.items.reduce((a, r) => a + r.height, 0)),
	);
	const checked = kids.length + data.zero.length;
	const noteParts = [
		data.zero.length
			? `${plural(checked, level, plural_(level))}, ${whole(kids.length)} with Count`
			: plural(kids.length, level, plural_(level)),
	];
	if (grand)
		noteParts.push(
			plural(
				kids.reduce((a, k) => a + k.grandchildren.length, 0),
				grand,
				plural_(grand),
			),
		);
	const heads = [
		[
			{
				x: nameX,
				text: grand ? grand.charAt(0).toUpperCase() + grand.slice(1) : "",
				anchor: "start" as const,
			},
			{
				x: topicCountX,
				text: `Count in ${level} view`,
				anchor: "end" as const,
			},
		],
		[
			{ x: leadNameX, text: "Institution", anchor: "start" as const },
			{ x: leadCountX, text: "Count", anchor: "end" as const },
			{ x: width, text: "Excess", anchor: "end" as const },
		],
	];
	const mosaic = (scene: Scene, x: number, y: number, span: number) => {
		const slit = 4;
		const usable = span - slit * (kids.length - 1);
		const bandY = y;
		const bodyY = bandY + bandH;
		const pad = Math.max(4, s * 0.5);
		const label = (number: string, share: string) => ({
			number,
			share,
			w: measure(number, s, sansSemi) + gap + measure(share, s, sans),
		});
		const xs: number[] = [];
		let run = x;
		for (const kid of kids) {
			xs.push(run);
			run += (kid.count / total) * usable + slit;
		}
		const widthOf = (j: number) => (kids[j].count / total) * usable;
		const named = (from: number) =>
			from === kids.length - 1
				? `${kids.length}`
				: `${from + 1}–${kids.length}`;
		const restOf = (from: number) =>
			percent(kids.slice(from).reduce((a, k) => a + k.count, 0) / total);
		const fits = (from: number, to: number, number: string, share: string) =>
			label(number, share).w <= to - from - 2 * pad;
		let tail = kids.findIndex(
			(kid, j) =>
				!fits(
					xs[j],
					xs[j] + widthOf(j),
					`${j + 1}`,
					percent(kid.count / total),
				),
		);
		if (tail < 0) tail = kids.length;
		while (
			tail > 0 &&
			tail < kids.length &&
			!fits(xs[tail], x + span, named(tail), restOf(tail))
		)
			tail--;
		const band = (bx: number, bw: number, number: string, share: string) => {
			scene.rect(bx, bandY, bw, bandH, ink);
			const base = bandY + bandH / 2 + cap(s, sansSemi) / 2;
			scene.text(bx + pad, base, number, s, sansSemi, paper);
			scene.text(bx + bw - pad, base, share, s, sans, paper, "end");
		};
		for (let j = 0; j < tail; j++)
			band(xs[j], widthOf(j), `${j + 1}`, percent(kids[j].count / total));
		if (tail < kids.length)
			band(xs[tail], x + span - xs[tail], named(tail), restOf(tail));
		for (const [j, kid] of kids.entries()) {
			const w = widthOf(j);
			const parts = kid.grandchildren.length
				? kid.grandchildren.map((g) => ({ name: g.name, count: g.count }))
				: [{ name: kid.name, count: kid.count }];
			const boxes = squarify(
				parts.map((g) => g.count),
				{ x: xs[j], y: bodyY + 2, w, h: body - 2 },
			);
			for (const [i, g] of parts.entries()) {
				const r: Rect = boxes[i];
				const tw = Math.max(r.w - 2, 0);
				const th = Math.max(r.h - 2, 0);
				scene.rect(r.x, r.y, Math.max(tw, 0.5), Math.max(th, 0.5), tile);
				const set = tileLabel(clean(g.name), tw, th);
				if (!set) continue;
				const cxm = r.x + tw / 2;
				const cym = r.y + th / 2;
				const first = -set.height / 2 + cap(set.size, condSemi);
				for (const [k, line] of set.lines.entries()) {
					const dy = first + k * set.lead;
					scene.text(
						set.turn ? cxm + dy : cxm,
						set.turn ? cym : cym + dy,
						line,
						set.size,
						condSemi,
						ink,
						"middle",
						0,
						0,
						set.turn ? -90 : 0,
					);
				}
			}
		}
	};
	const note = noteParts.join(", ");
	const keys = [
		"Width = share of Count",
		...(grand ? [`Tiles = ${plural_(grand)} by Count in ${level} view`] : []),
	];
	return {
		height: top + headH + used,
		draw: (scene, x, y) => {
			blockTitle(scene, x, y, full, plural_(level).toUpperCase(), note);
			const base = y + cap(40, sansSemi);
			let kx = x + full - measure(note, 28, sans) - 64;
			for (const k of [...keys].reverse()) {
				scene.text(kx, base, k, 28, sansMedium, grey, "end");
				kx -= measure(k, 28, sansMedium) + 64;
			}
			mosaic(scene, x, y + titleBand, full);
			for (const [c, col] of columns.entries()) {
				const cx = x + c * (grid.w + grid.g);
				const hy = y + top;
				for (const h of heads[col.kind])
					if (h.text)
						scene.text(
							cx + h.x,
							hy + p * 0.8,
							h.text,
							hs,
							sansMedium,
							grey,
							h.anchor,
						);
				scene.line(cx, hy + headH - 4, cx + width, hy + headH - 4, rule, 2);
				let cy = hy + headH;
				for (const item of col.items) {
					item.draw(scene, cx, cy);
					cy += item.height;
				}
			}
		},
	};
};
