import { cap, fit, measure, wrap } from "./fonts";
import { fixed, plural, scale, snap, venueName, whole } from "./format";
import type { Data, Derived } from "./model";
import { grey, ink, paper, quiet, rule, tiers, tierText } from "./palette";
import {
	blockTitle,
	cond,
	condMedium,
	condSemi,
	divider,
	type Grid,
	maxOf,
	pack,
	percentOf,
	type Row,
	type Sheet,
	sans,
	sansMedium,
	sansSemi,
	titleBand,
} from "./sheet";

const keySize = 28;

const cellLabel = (rank: string, name: string, w: number, h: number) => {
	const target = snap(Math.min(48, Math.sqrt(w * h) / 8));
	const sizes = scale.filter((v) => v >= 12 && v <= target).reverse();
	const tries = sizes.length ? [...sizes.map((v) => [v, 4]), [12, 8]] : [];
	for (const [size, most] of tries) {
		const rs = Math.max(12, snap(size * 0.62));
		const inset = Math.round(rs * 0.5);
		if (2 * inset + measure(rank, rs, sansMedium) > w) continue;
		const band = inset + cap(rs, sansMedium) + Math.round(size * 0.3);
		const pad = Math.max(4, size * 0.4);
		const free = h - band - pad;
		for (const turn of free > w * 1.5 ? [false, true] : [false]) {
			const across = turn ? free : w - 2 * pad;
			const down = turn ? w - 2 * pad : free;
			if (across < size * 2) continue;
			const set = fit(name, size, condSemi, across, most);
			if (!set) continue;
			const lead = Math.round(size * 1.08);
			const height = cap(size, condSemi) + (set.lines.length - 1) * lead;
			if (height > down) continue;
			return {
				size,
				rs,
				inset,
				band,
				pad,
				lines: set.lines,
				turn,
				height,
				lead,
			};
		}
	}
	return undefined;
};

export const venueParts = (
	data: Data,
	derived: Derived,
	s: number,
	most = derived.venueCut.end,
) => {
	const gap = Math.round(s * 0.6);
	const rows = data.venues.slice(0, most);
	const half = derived.venueCut.marks.find((m) => m.k === 1)?.row ?? 0;
	const chosen = new Set(data.selection.years);
	const history = data.history;
	const cellW = Math.round(s * 1.25);
	const cellGap = Math.max(2, Math.round(s * 0.16));
	const thin = Math.max(3, Math.round(s * 0.25));
	const offsets: number[] = [];
	let stripW = 0;
	for (const [k, year] of history.entries()) {
		const wide = chosen.has(year);
		const prev = k ? chosen.has(history[k - 1]) : false;
		if (k) stripW += wide || prev ? cellGap : 1;
		offsets.push(stripW);
		stripW += wide ? cellW : thin;
	}
	const hs = Math.max(10, snap(s * 0.86));
	const rankW = measure(whole(rows.length), s, sans);
	const flagW = Math.round(s * 1.2);
	const countW = Math.max(
		measure("Count", hs, sansMedium),
		maxOf(
			rows.map((r, i) =>
				measure(fixed(r.count), s, i < half ? sansMedium : sans),
			),
		),
	);
	const nameX = rankW + gap + flagW + gap * 0.6;
	const fixedW = nameX + gap + stripW + gap * 1.4 + countW;
	return {
		gap,
		rows,
		half,
		chosen,
		history,
		cellW,
		thin,
		offsets,
		stripW,
		hs,
		rankW,
		flagW,
		countW,
		nameX,
		fixedW,
	};
};

export const venueWidth = (data: Data, derived: Derived, s: number) =>
	venueParts(data, derived, s).fixedW + s * 15;

export const venuesBlock = (
	data: Data,
	derived: Derived,
	s: number,
	grid: Grid,
	first = 0,
	most = derived.venueCut.end,
): Sheet | undefined => {
	const parts = venueParts(data, derived, s, most);
	const {
		gap,
		rows,
		half,
		chosen,
		history,
		cellW,
		thin,
		offsets,
		hs,
		rankW,
		flagW,
		nameX,
		fixedW,
	} = parts;
	const p = Math.round(s * 1.36);
	const width = grid.w;
	const nameW = width - fixedW;
	if (nameW < s * 10) return undefined;
	const stripX = nameX + nameW + gap;
	const marks = new Map<number, number>();
	for (const m of derived.venueCut.marks)
		marks.set(m.row, Math.max(marks.get(m.row) ?? 0, m.k));
	const list: Row[] = [];
	for (const [i, v] of rows.entries()) {
		const top = i < half;
		const font = top ? condMedium : cond;
		const lines = wrap(venueName(v.name), s, font, nameW);
		list.push({
			height: p * lines.length,
			draw: (scene, x, y) => {
				const b = y + p * 0.72;
				scene.text(x + rankW, b, whole(v.rank), s, sans, quiet, "end");
				const fx = x + rankW + gap;
				if (v.country)
					scene.flag(v.country, fx, b - flagW * 0.75 + s * 0.06, flagW);
				for (const [k, line] of lines.entries())
					scene.text(x + nameX, b + k * p, line, s, font, ink);
				const mid = b - cap(s, cond) / 2;
				const ts = Math.max(10, snap(s * 0.84));
				for (const [k, t] of v.past.entries()) {
					if (!t) continue;
					const tx = x + stripX + offsets[k];
					const ti = Number(t) - 1;
					if (!chosen.has(history[k])) {
						scene.rect(tx, mid - s * 0.53, thin, s * 1.06, tiers[ti]);
						continue;
					}
					scene.rect(tx, mid - s * 0.53, cellW, s * 1.06, tiers[ti]);
					scene.text(
						tx + cellW / 2,
						mid + cap(ts, sansMedium) / 2,
						t,
						ts,
						sansMedium,
						tierText[ti],
						"middle",
					);
				}
				scene.text(
					x + width,
					b,
					fixed(v.count),
					s,
					top ? sansMedium : sans,
					ink,
					"end",
				);
			},
		});
		const k = marks.get(i + 1);
		if (k) {
			list[list.length - 1].keep = true;
			list.push({
				height: Math.round(p * 1.1),
				draw: (scene, x, y) => divider(scene, x, y, width, s, percentOf(k)),
			});
		}
	}
	const rest = data.venues.length - rows.length;
	if (rest)
		list.push({
			height: p,
			draw: (scene, x, y) =>
				scene.text(
					x + nameX,
					y + p * 0.72,
					plural(rest, "more venue", "more venues"),
					s,
					condMedium,
					grey,
				),
		});
	const head = Math.round(p * 1.3);
	const stripH = Math.round(s * 10);
	const stripBand = stripH + Math.round(s * 3.2);
	const cols = grid.n - first;
	const columns = pack(list, cols);
	const used = Math.max(
		...columns.map((c) => c.reduce((a, r) => a + r.height, 0)),
	);
	const note = `${plural(data.venues.length, "venue", "venues")}, ${whole(rows.length)} listed`;
	const latest = (v: (typeof rows)[number]) => {
		for (let k = v.tiers.length - 1; k >= 0; k--)
			if (v.tiers[k]) return Number(v.tiers[k]) - 1;
		return 0;
	};
	const step = grid.w + grid.g;
	const full = cols * grid.w + (cols - 1) * grid.g;
	return {
		height: titleBand + stripBand + head + used,
		draw: (scene, at, y) => {
			const x = at + first * step;
			blockTitle(scene, x, y, full, "VENUES", note);
			const base = y + cap(40, sansSemi);
			const kw = 64;
			const kh = 32;
			const keyRight = x + full - measure(note, keySize, sans) - 64;
			const ky = base - cap(keySize, sans) / 2 - kh / 2;
			for (const [k, fill] of tiers.entries()) {
				const kx = keyRight - (tiers.length - k) * kw;
				scene.rect(kx, ky, kw, kh, fill, paper, 1.5);
				scene.text(
					kx + kw / 2,
					ky + kh / 2 + cap(24, sansSemi) / 2,
					`${k + 1}`,
					24,
					sansSemi,
					tierText[k],
					"middle",
				);
			}
			scene.text(
				keyRight - tiers.length * kw - 16,
				base,
				"Tier",
				keySize,
				sansMedium,
				grey,
				"end",
			);
			const sy = y + titleBand;
			const total = derived.mass || 1;
			let run = 0;
			for (const v of data.venues.slice(0, derived.venueCut.end)) {
				const sx = x + (run / total) * full;
				const w = (v.count / total) * full;
				const ti = latest(v);
				const fill = tierText[ti];
				scene.rect(sx, sy, w, stripH, tiers[ti], paper, w > 3 ? 1.5 : 0);
				run += v.count;
				const rank = whole(v.rank);
				const set = cellLabel(rank, venueName(v.name), w, stripH);
				const rs = set ? set.rs : 12;
				const inset = Math.round(rs * 0.5);
				if (set || 2 * inset + measure(rank, rs, sansMedium) <= w)
					scene.text(
						sx + inset,
						sy + inset + cap(rs, sansMedium),
						rank,
						rs,
						sansMedium,
						fill,
					);
				if (!set) continue;
				const cx = sx + w / 2;
				const cy = sy + set.band + (stripH - set.band - set.pad) / 2;
				let d = -set.height / 2 + cap(set.size, condSemi);
				for (const line of set.lines) {
					scene.text(
						set.turn ? cx + d : cx,
						set.turn ? cy : cy + d,
						line,
						set.size,
						condSemi,
						fill,
						"middle",
						0,
						0,
						set.turn ? -90 : 0,
					);
					d += set.lead;
				}
			}
			scene.rect(
				x + (run / total) * full,
				sy,
				full - (run / total) * full,
				stripH,
				"#eef0f3",
			);
			for (const m of derived.venueCut.marks) {
				const fx = x + (1 - 2 ** -m.k) * full;
				scene.line(fx, sy - s * 0.6, fx, sy - 3, ink, 3);
				scene.line(fx, sy + stripH + 3, fx, sy + stripH + s * 0.6, ink, 3);
				scene.text(
					fx,
					sy + stripH + s * 1.6,
					percentOf(m.k),
					hs,
					sansSemi,
					ink,
					"middle",
				);
			}
			for (const [c, col] of columns.entries()) {
				const cx = x + c * step;
				const hb = y + titleBand + stripBand + p * 0.8;
				scene.text(cx + nameX, hb, "Venue", hs, sansMedium, grey);
				for (const [k, yr] of history.entries()) {
					const short = `${yr}`.slice(2);
					const at_ = cx + stripX + offsets[k];
					if (chosen.has(yr))
						scene.text(
							at_ + cellW / 2,
							hb,
							short,
							hs,
							sansMedium,
							grey,
							"middle",
						);
					else if (k === 0 && !chosen.has(history[1]))
						scene.text(at_, hb, short, hs, sansMedium, grey);
					else if (k === history.length - 1 && !chosen.has(history[k - 1]))
						scene.text(at_ + thin, hb, short, hs, sansMedium, grey, "end");
				}
				scene.text(cx + width, hb, "Count", hs, sansMedium, grey, "end");
				scene.line(
					cx,
					y + titleBand + stripBand + head - 4,
					cx + width,
					y + titleBand + stripBand + head - 4,
					rule,
					2,
				);
				let cy = y + titleBand + stripBand + head;
				for (const r of col) {
					r.draw(scene, cx, cy);
					cy += r.height;
				}
			}
		},
	};
};
