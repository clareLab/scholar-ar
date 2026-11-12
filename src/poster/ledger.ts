import { childrenBlock } from "./children";
import { cap, measure, wrap } from "./fonts";
import { fixed, nation, percent, plural, signed, snap, whole } from "./format";
import type { Data, Derived } from "./model";
import { familyTone, grey, grid, ink, paper, quiet, rule } from "./palette";
import type { Scene } from "./scene";
import {
	type Block,
	blockTitle,
	cond,
	condMedium,
	divider,
	gridOf,
	pack,
	percentOf,
	type Row,
	type Sheet,
	sans,
	sansMedium,
	sansSemi,
	titleBand,
} from "./sheet";
import { venuesBlock, venueWidth } from "./venues";

export const countriesBlock = (
	data: Data,
	derived: Derived,
	s: number,
	room: number,
	side = false,
	full = 0,
	target = 0,
): Block => {
	const p = Math.round(s * 1.36);
	const gap = Math.round(s * 0.7);
	const hs = Math.max(10, snap(s * 0.86));
	const rows = derived.nations.slice(0, derived.nationCut.end);
	const flagW = Math.round(s * 1.2);
	const sw = Math.round(s * 0.7);
	const rankW = measure(whole(rows.length), s, sans);
	const nameMax = Math.round(s * 11);
	const names = rows.map((r) => wrap(nation(r.code), s, cond, nameMax));
	const others = data.others;
	const nameMin = Math.max(
		measure("Country", hs, sansMedium),
		...names.flat().map((l) => measure(l, s, cond)),
		others ? measure("Other countries", s, cond) : 0,
		derived.tail.length
			? measure(
					plural(derived.tail.length, "more country", "more countries"),
					s,
					condMedium,
				)
			: 0,
	);
	const cols = [
		Math.max(
			measure("Institutions", hs, sansMedium),
			...rows.map((r) => measure(whole(r.institutions), s, sans)),
			others ? measure(whole(others.institutions), s, sans) : 0,
		),
		Math.max(
			measure("Count", hs, sansMedium),
			...rows.map((r) => measure(fixed(r.count), s, sans)),
			others ? measure(fixed(others.count), s, sans) : 0,
		),
		Math.max(
			measure("Share", hs, sansMedium),
			...rows.map((r) => measure(percent(r.share), s, sans)),
			others ? measure(percent(others.share), s, sans) : 0,
		),
		Math.max(
			measure("Excess", hs, sansMedium),
			...rows.map((r) => measure(signed(r.excess), s, sans)),
		),
	];
	const lead = rankW + gap + sw + gap * 0.5 + flagW + gap;
	const natural = Math.round(
		lead + nameMin + cols.reduce((a, w) => a + w + gap * 1.4, 0),
	);
	const few = rows.length <= 3;
	const many = full > 0 && !few;
	const n = many ? Math.max(1, Math.floor((full + 64) / (natural + 64))) : 1;
	const width = many ? Math.floor((full - (n - 1) * 64) / n) : natural;
	const nameW = nameMin + width - natural;
	const listRows: Row[] = [];
	const head = Math.round(p * 1.2);
	listRows.push({
		height: head,
		draw: (scene, x, y) => {
			const b = y + p * 0.8;
			scene.text(x + lead, b, "Country", hs, sansMedium, grey);
			let cx = x + lead + nameW;
			for (const [k, text] of [
				"Institutions",
				"Count",
				"Share",
				"Excess",
			].entries()) {
				cx += gap * 1.4 + cols[k];
				scene.text(cx, b, text, hs, sansMedium, grey, "end");
			}
			scene.line(x, y + head - 2, x + width, y + head - 2, rule, 2);
		},
	});
	const marks = new Map<number, number>();
	for (const m of derived.nationCut.marks)
		marks.set(m.row, Math.max(marks.get(m.row) ?? 0, m.k));
	for (const [i, r] of rows.entries()) {
		const lines = names[i];
		listRows.push({
			height: p * lines.length,
			draw: (scene, x, y) => {
				const b = y + p * 0.72;
				scene.text(x + rankW, b, whole(r.rank), s, sans, quiet, "end");
				const sx = x + rankW + gap;
				scene.rect(sx, b - sw * 0.92, sw, sw, derived.colour(r.code));
				const fx = sx + sw + gap * 0.5;
				if (r.code) scene.flag(r.code, fx, b - flagW * 0.75 + s * 0.06, flagW);
				for (const [k, line] of lines.entries())
					scene.text(x + lead, b + k * p, line, s, cond, ink);
				let cx = x + lead + nameW;
				const values = [
					whole(r.institutions),
					fixed(r.count),
					percent(r.share),
					signed(r.excess),
				];
				for (const [k, text] of values.entries()) {
					cx += gap * 1.4 + cols[k];
					scene.text(cx, b, text, s, sans, ink, "end");
				}
			},
		});
		const k = marks.get(i + 1);
		if (k) {
			listRows[listRows.length - 1].keep = true;
			listRows.push({
				height: Math.round(p * 1.1),
				draw: (scene, x, y) => divider(scene, x, y, width, s, percentOf(k)),
			});
		}
	}
	const rest = derived.tail.length;
	if (rest)
		listRows.push({
			height: p,
			draw: (scene, x, y) =>
				scene.text(
					x + lead,
					y + p * 0.72,
					plural(rest, "more country", "more countries"),
					s,
					condMedium,
					grey,
				),
		});
	if (others)
		listRows.push({
			height: p,
			draw: (scene, x, y) => {
				const b = y + p * 0.72;
				scene.rect(x + rankW + gap, b - sw * 0.92, sw, sw, grid);
				scene.text(x + lead, b, "Other countries", s, cond, ink);
				let cx = x + lead + nameW;
				const values = [
					whole(others.institutions),
					fixed(others.count),
					percent(others.share),
					"",
				];
				for (const [k, text] of values.entries()) {
					cx += gap * 1.4 + cols[k];
					if (text) scene.text(cx, b, text, s, sans, ink, "end");
				}
			},
		});
	if (derived.tailContinents.length) {
		const items = derived.tailContinents.map((c) => ({
			c,
			w: sw + gap * 0.5 + measure(c, s, cond) + gap * 1.2,
		}));
		const lines: (typeof items)[] = [[]];
		let used = 0;
		const avail = width - lead;
		for (const it of items) {
			if (used + it.w > avail && lines[lines.length - 1].length) {
				lines.push([]);
				used = 0;
			}
			lines[lines.length - 1].push(it);
			used += it.w;
		}
		listRows.push({
			height: p * (lines.length + 1.3),
			draw: (scene, x, y) => {
				scene.text(
					x + lead,
					y + p * 1.02,
					"More countries, by continent",
					hs,
					sansMedium,
					grey,
				);
				for (const [k, line] of lines.entries()) {
					let cx = x + lead;
					const b = y + p * (k + 2.02);
					for (const it of line) {
						scene.rect(cx, b - sw * 0.92, sw, sw, familyTone(it.c));
						scene.text(cx + sw + gap * 0.5, b, it.c, s, cond, ink);
						cx += it.w;
					}
				}
			},
		});
	}
	const listHeight = listRows.reduce((a, r) => a + r.height, 0);
	const labelW =
		Math.max(
			...[
				...rows.map((r) => nation(r.code)),
				...(others ? ["Other countries"] : []),
			].map((t) => measure(t, hs, cond)),
		) + gap;
	if (side) {
		const riverW = Math.round(width * (few ? 0.7 : 0.92)) + Math.round(labelW);
		const riverH = few
			? Math.round(listHeight - p * 1.2)
			: Math.max(listHeight - 2 * p, Math.round(p * 14));
		const full = width + Math.round(s * 3) + riverW;
		return {
			width: full,
			height:
				titleBand + Math.max(listHeight, riverH + 4 * p) + Math.round(p * 0.6),
			cols: 1,
			colW: full,
			gap: 0,
			draw: (scene, x, y) => {
				blockTitle(scene, x, y, full, "COUNTRIES", "");
				let cy = y + titleBand;
				for (const r of listRows) {
					r.draw(scene, x, cy);
					cy += r.height;
				}
				river(
					scene,
					data,
					derived,
					x + width + Math.round(s * 3),
					y + titleBand + p * 1.4,
					riverW,
					riverH,
					s,
					labelW,
				);
			},
		};
	}
	const riverW = Math.max(width, full);
	const riverMin = few ? Math.round(p * 5) : Math.round(Math.max(360, s * 18));
	const body = listRows.slice(1);
	const columns = full ? pack(body, n) : [body];
	const tableH =
		listRows[0].height +
		Math.max(...columns.map((c) => c.reduce((a, r) => a + r.height, 0)));
	const spare = room - titleBand - tableH - 3 * p;
	const riverH = full
		? Math.max(riverMin, room ? spare : target)
		: few
			? riverMin
			: Math.max(riverMin, spare);
	const height = titleBand + riverH + 3 * p + tableH;
	return {
		width: riverW,
		height,
		cols: 1,
		colW: riverW,
		gap: 0,
		draw: (scene, x, y) => {
			blockTitle(scene, x, y, riverW, "COUNTRIES", "");
			river(
				scene,
				data,
				derived,
				x,
				y + titleBand + p,
				riverW,
				riverH - p,
				s,
				labelW,
			);
			const top = y + titleBand + riverH + 3 * p;
			for (const [c, col] of columns.entries()) {
				const cx = x + c * (width + 64);
				listRows[0].draw(scene, cx, top);
				let cy = top + listRows[0].height;
				for (const r of col) {
					r.draw(scene, cx, cy);
					cy += r.height;
				}
			}
		},
	};
};

const river = (
	scene: Scene,
	data: Data,
	derived: Derived,
	x: number,
	y: number,
	full: number,
	h: number,
	s: number,
	labelW: number,
) => {
	const years = data.history;
	const n = years.length;
	const hs = Math.max(10, snap(s * 0.86));
	const w = full - labelW;
	const xs = (k: number) => x + (k / (n - 1)) * w;
	const bands: { fill: string; shares: number[]; name?: string }[] = [];
	const listedRows = derived.nations.slice(0, derived.nationCut.end);
	const listed = new Set(listedRows.map((c) => c.code));
	for (const c of listedRows)
		bands.push({
			fill: derived.colour(c.code),
			shares: c.shares,
			name: nation(c.code),
		});
	const tail = data.countries.filter(
		(c) => !listed.has(c.code) && c.yearly.some((v) => v > 0),
	);
	tail.sort((a, b) => b.count - a.count || a.code.localeCompare(b.code, "en"));
	for (const c of tail)
		bands.push({ fill: derived.colour(c.code), shares: c.shares });
	if (data.others)
		bands.push({
			fill: grid,
			shares: data.others.shares,
			name: "Other countries",
		});
	const base = new Array(n).fill(0);
	const tags: { name: string; y: number }[] = [];
	for (const b of bands) {
		const upper = base.map((v) => v);
		const lower = base.map((v, k) => v + b.shares[k]);
		for (let k = 0; k < n; k++) base[k] = lower[k];
		if (b.shares.every((v) => v <= 0)) continue;
		const pts: string[] = [];
		for (let k = 0; k < n; k++)
			pts.push(
				`${pts.length ? "L" : "M"}${xs(k).toFixed(1)} ${(y + upper[k] * h).toFixed(1)}`,
			);
		for (let k = n - 1; k >= 0; k--)
			pts.push(`L${xs(k).toFixed(1)} ${(y + lower[k] * h).toFixed(1)}`);
		scene.path(`${pts.join("")}Z`, b.fill, paper, 1);
		const thick = (lower[n - 1] - upper[n - 1]) * h;
		if (b.name && thick >= hs * 0.9)
			tags.push({
				name: b.name,
				y: y + ((upper[n - 1] + lower[n - 1]) / 2) * h,
			});
	}
	let floor_ = -Infinity;
	for (const t of tags) {
		const ty = Math.max(t.y, floor_ + hs * 1.15);
		if (ty > y + h + hs) break;
		scene.text(x + w + hs * 0.6, ty + cap(hs, cond) / 2, t.name, hs, cond, ink);
		floor_ = ty;
	}
	const from = years.indexOf(data.selection.from);
	const to = years.indexOf(data.selection.to);
	for (const k of new Set([from, to]))
		scene.line(xs(k), y - 8, xs(k), y + h + 8, ink, 3);
	const top = y - 8 - hs * 0.4;
	if (from === to)
		scene.text(xs(from), top, `${years[from]}`, hs, sansSemi, ink, "middle");
	else {
		const a = measure(`${years[from]}`, hs, sansSemi);
		const b = measure(`${years[to]}`, hs, sansSemi);
		const fits = xs(to) - xs(from) >= (a + b) / 2 + hs;
		scene.text(
			xs(from),
			top,
			`${years[from]}`,
			hs,
			sansSemi,
			ink,
			fits ? "middle" : "end",
		);
		scene.text(
			xs(to),
			top,
			`${years[to]}`,
			hs,
			sansSemi,
			ink,
			fits ? "middle" : "start",
		);
	}
	const ys = y + h + 8 + hs * 1.3;
	for (const [k, yr] of years.entries()) {
		if ((yr - years[0]) % 4) continue;
		scene.text(
			xs(k),
			ys,
			`${yr}`,
			hs,
			sans,
			grey,
			k === 0 ? "start" : "middle",
		);
	}
	scene.text(x, top - hs * 1.5, "Share of yearly Count", hs, sansMedium, grey);
};

export const sizesL = [32, 28, 24, 20, 16, 14, 12, 10, 8];

const gutter = 64;
const bandGap = 128;

export const planLedger = (
	data: Data,
	derived: Derived,
	width: number,
	cap_: number,
	withCountries: boolean,
	boost = true,
	most = Number.POSITIVE_INFINITY,
) => {
	const sizes = sizesL.filter((v) => v <= most);
	const gridAt = (s: number) => {
		const least = venueWidth(data, derived, s);
		const n = Math.max(2, Math.floor((width + gutter) / (least + gutter)));
		return gridOf(width, n, gutter);
	};
	const attempt = (s: number) => {
		const grid = gridAt(s);
		const sheets: Sheet[] = [];
		if (derived.children.length) {
			const kids = childrenBlock(data, derived, s, grid);
			if (!kids) return undefined;
			sheets.push(kids);
		}
		if (withCountries) {
			const nations = countriesBlock(data, derived, s, 0, true);
			const first = Math.ceil((nations.width + grid.g) / (grid.w + grid.g));
			const venues =
				first < grid.n ? venuesBlock(data, derived, s, grid, first) : undefined;
			if (!venues) return undefined;
			sheets.push({
				height: Math.max(nations.height, venues.height),
				draw: (scene, x, y) => {
					nations.draw(scene, x, y, 0, nations.width);
					venues.draw(scene, x, y);
				},
			});
		} else {
			const venues = venuesBlock(data, derived, s, grid);
			if (!venues) return undefined;
			sheets.push(venues);
		}
		const height =
			sheets.reduce((a, b) => a + b.height, 0) + (sheets.length - 1) * bandGap;
		return { grid, sheets, height };
	};
	const fit = (room: number) => {
		for (const s of sizes) {
			const got = attempt(s);
			if (got && got.height <= room) return s;
		}
		return undefined;
	};
	let s = fit(cap_);
	for (const more of boost ? [384, 768] : []) {
		if (s !== undefined && s >= 12) break;
		const next = fit(cap_ + more);
		if (next !== undefined && (s === undefined || next > s)) s = next;
	}
	const size =
		s ??
		[...sizes].reverse().find((v) => attempt(v)) ??
		sizes[sizes.length - 1];
	const chosen = attempt(size);
	if (!chosen) throw new Error("no ledger layout");
	return {
		s: size,
		...chosen,
		bands: chosen.sheets.map((b) => b.height),
		bandGap,
	};
};

export const drawLedger = (
	scene: Scene,
	plan: ReturnType<typeof planLedger>,
	x: number,
	y: number,
) => {
	let by = y;
	for (const sheet of plan.sheets) {
		sheet.draw(scene, x, by);
		by += sheet.height + plan.bandGap;
	}
};
