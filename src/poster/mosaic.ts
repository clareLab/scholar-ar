import { balance, cap, fit, measure } from "./fonts";
import { clean, fixed, nation, percent, snap, whole } from "./format";
import type { Data, Derived, Institution } from "./model";
import {
	classBounds,
	classes,
	classOf,
	grey,
	ink,
	paper,
	soft,
} from "./palette";

const rankInk = soft;

import { type Rect, type Scene, squarify } from "./scene";
import { condMedium, sans, sansMedium, sansSemi, titleSize } from "./sheet";

const steps = [112, 96, 80, 64, 56, 48, 40, 32, 28, 24, 20, 16, 14, 12, 10, 8];

type Set = {
	size: number;
	lines: string[];
	rank: string;
	count: string;
	es: number;
	inset: number;
	band: number;
	pad: number;
	height: number;
	lead: number;
};

const layout = (row: Institution, w: number, h: number): Set | undefined => {
	const rank = whole(row.rankExcess);
	const count = fixed(row.count);
	const name_ = clean(row.name);
	const pad = Math.max(3, Math.min(w, h) * 0.07);
	for (const s of steps) {
		if (s * 1.6 > h) continue;
		const es = Math.max(8, snap(s * 0.62));
		const inset = Math.max(3, Math.round(es * 0.5));
		if (2 * inset + measure(rank, es, sans) + es + measure(count, es, sans) > w)
			continue;
		const set = fit(name_, s, condMedium, w - 2 * pad, 5);
		if (!set) continue;
		const band = inset + cap(es, sans) + Math.max(2, Math.round(s * 0.3));
		const lead = Math.round(s * 1.06);
		const height = cap(s, condMedium) + (set.lines.length - 1) * lead;
		if (band + height + pad > h) continue;
		return {
			size: s,
			lines: set.lines,
			rank,
			count,
			es,
			inset,
			band,
			pad,
			height,
			lead,
		};
	}
	return undefined;
};

export const plotMosaic = (
	scene: Scene,
	data: Data,
	derived: Derived,
	rect: Rect,
) => {
	const head = 120;
	scene.rect(rect.x, rect.y, rect.w, rect.h, paper);
	scene.text(
		rect.x,
		rect.y + cap(titleSize, sansSemi),
		"INSTITUTIONS BY COUNTRY",
		titleSize,
		sansSemi,
		ink,
		"start",
		0,
		titleSize * 0.1,
	);
	const keySize = 28;
	const sw = 96;
	const kx = rect.x + rect.w - classes.length * sw;
	const ky = rect.y + 4;
	const keyX = kx - 32 - measure("Count / Expected", keySize, sansMedium);
	const titleW = measure(
		"INSTITUTIONS BY COUNTRY",
		titleSize,
		sansSemi,
		titleSize * 0.1,
	);
	if (keyX >= rect.x + titleW + 64) {
		scene.text(
			kx - 32,
			ky + 30,
			"Count / Expected",
			keySize,
			sansMedium,
			ink,
			"end",
		);
		scene.text(
			kx - 32,
			ky + 30 + 40,
			"Area = Count",
			keySize,
			sansMedium,
			grey,
			"end",
		);
		for (const [k, fill] of classes.entries())
			scene.rect(kx + k * sw, ky + 8, sw, 30, fill);
		for (const [k, text] of classBounds.entries())
			scene.text(
				kx + (k + 1) * sw,
				ky + 8 + 30 + 32,
				text,
				keySize,
				sans,
				ink,
				"middle",
			);
	}
	const tw = 176;
	const th = 64;
	const tx = keyX - 64 - tw;
	if (
		tx >
		rect.x +
			measure("INSTITUTIONS BY COUNTRY", titleSize, sansSemi) +
			titleSize * 2.4 +
			64
	) {
		scene.rect(tx, ky, tw, th, classes[5]);
		const inset = 7;
		const corner = ky + inset + cap(14, sans);
		scene.text(tx + inset, corner, "Rank", 14, sans, rankInk);
		scene.text(tx + tw - inset, corner, "Count", 14, sans, rankInk, "end");
		const below = corner + 7;
		scene.text(
			tx + tw / 2,
			below + (ky + th - inset - below) / 2 + cap(24, condMedium) / 2,
			"Institution",
			24,
			condMedium,
			ink,
			"middle",
		);
	}
	const body: Rect = {
		x: rect.x,
		y: rect.y + head,
		w: rect.w,
		h: rect.h - head,
	};
	const groups = derived.nations
		.map((n) => ({
			n,
			rows: data.institutions
				.filter((r) => r.country === n.code)
				.sort(
					(a, b) => b.count - a.count || a.name.localeCompare(b.name, "en"),
				),
		}))
		.filter((g) => g.rows.length);
	const regions = squarify(
		groups.map((g) => g.rows.reduce((a, r) => a + r.count, 0)),
		body,
	);
	const gap = 6;
	const tabs: { region: Rect; tab: Rect; draw: () => void }[] = [];
	const labels: (() => void)[] = [];
	for (const [k, g] of groups.entries()) {
		const reg = regions[k];
		const inner: Rect =
			reg.w > 3 * gap && reg.h > 3 * gap
				? {
						x: reg.x + gap / 2,
						y: reg.y + gap / 2,
						w: reg.w - gap,
						h: reg.h - gap,
					}
				: reg;
		const tiles = squarify(
			g.rows.map((r) => r.count),
			inner,
		);
		const big = Math.sqrt(inner.w * inner.h);
		let tab: Rect | undefined;
		let drawTab = () => {};
		const country = nation(g.n.code);
		const tail = `${fixed(g.n.count)}\u2003${percent(g.n.share)}`;
		const tone = derived.colour(g.n.code);
		const top = Math.min(56, Math.max(12, snap(big / 18)));
		const sizes = steps.filter((v) => v <= top && v >= 10);
		const options: [number, boolean, number][] = sizes.flatMap((v, k) => [
			[v, true, 1],
			...(k + 1 < sizes.length
				? [[sizes[k + 1], true, 1] as [number, boolean, number]]
				: []),
			[v, false, 1],
			[v, false, 2],
		]);
		for (const [s, withTail, rows] of options) {
			const flagW = g.n.code ? Math.round(s * 1.2) : 0;
			const sw = Math.round(s * 0.5);
			const lead = s * 0.45 + sw + s * 0.35 + (flagW ? flagW + s * 0.4 : 0);
			const set =
				rows === 1
					? { lines: [country], width: measure(country, s, sansSemi) }
					: balance(country, s, sansSemi, 2);
			if (rows === 2 && set.lines.length < 2) continue;
			const tailW = withTail ? measure(tail, s, sans) + s * 0.7 : 0;
			const w = lead + set.width + tailW + s * 0.5;
			const lh = Math.round(s * 1.15);
			const h = Math.round(s * 0.6 + lh * set.lines.length);
			if (w > inner.w - 4 || h > inner.h / 3) continue;
			const t = { x: inner.x, y: inner.y, w, h };
			tab = t;
			drawTab = () => {
				scene.rect(t.x, t.y, t.w, t.h, paper);
				let tx = t.x + s * 0.45;
				const base = t.y + s * 0.3 + (lh + cap(s, sansSemi)) / 2;
				scene.rect(tx, base - cap(s, sansSemi) / 2 - sw / 2, sw, sw, tone);
				tx += sw + s * 0.35;
				if (flagW) {
					scene.flag(
						g.n.code,
						tx,
						base - cap(s, sansSemi) / 2 - (flagW * 0.75) / 2,
						flagW,
					);
					tx += flagW + s * 0.4;
				}
				for (const [k, line] of set.lines.entries())
					scene.text(tx, base + k * lh, line, s, sansSemi, ink);
				if (withTail)
					scene.text(tx + set.width + s * 0.7, base, tail, s, sans, grey);
			};
			break;
		}
		for (const [j, tile] of tiles.entries()) {
			const row = g.rows[j];
			const fill = classes[classOf(row.count, row.expected)];
			const edge = Math.min(tile.w, tile.h);
			const stroke = edge > 3 ? Math.min(1.5, edge / 8) : 0;
			scene.rect(
				tile.x,
				tile.y,
				tile.w,
				tile.h,
				fill,
				stroke ? paper : undefined,
				stroke || undefined,
			);
			if (edge < 12) continue;
			let area = { ...tile };
			if (tab) {
				const t = tab;
				const crossX = tile.x < t.x + t.w && tile.x + tile.w > t.x;
				const crossY = tile.y < t.y + t.h && tile.y + tile.h > t.y;
				if (crossX && crossY) {
					const below = tile.y + tile.h - (t.y + t.h);
					const right = tile.x + tile.w - (t.x + t.w);
					if (below * tile.w >= right * tile.h)
						area = { x: tile.x, y: t.y + t.h, w: tile.w, h: below };
					else area = { x: t.x + t.w, y: tile.y, w: right, h: tile.h };
				}
			}
			const set = layout(row, area.w, area.h);
			if (!set) continue;
			const cx = area.x + area.w / 2;
			const free = area.h - set.band - set.pad;
			const top = area.y + set.band + (free - set.height) / 2;
			labels.push(() => {
				const corner = area.y + set.inset + cap(set.es, sans);
				scene.text(area.x + set.inset, corner, set.rank, set.es, sans, rankInk);
				scene.text(
					area.x + area.w - set.inset,
					corner,
					set.count,
					set.es,
					sans,
					rankInk,
					"end",
				);
				let y = top + cap(set.size, condMedium);
				for (const line of set.lines) {
					scene.text(cx, y, line, set.size, condMedium, ink, "middle");
					y += set.lead;
				}
			});
		}
		if (tab) tabs.push({ region: inner, tab, draw: drawTab });
	}
	for (const t of tabs) t.draw();
	for (const draw of labels) draw();
};
