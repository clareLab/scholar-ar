import { cap, type Font, measure } from "./fonts";
import { ladderFor, plotFork, probeFork, sheet } from "./fork";
import { decade } from "./format";
import { countriesBlock, drawLedger, planLedger } from "./ledger";
import { type Meta, masthead } from "./masthead";
import { type Data, type Derived, derive } from "./model";
import { plotMosaic } from "./mosaic";
import {
	familyTone,
	gain,
	ink,
	loss,
	paper,
	par,
	quiet,
	rule,
} from "./palette";
import { type Rect, Scene } from "./scene";
import type { Block } from "./sheet";

export const page = { width: 7200, height: 9600 };
const margin = 256;

const label: Font = { family: "sans", weight: 500 };
const plain: Font = { family: "sans", weight: 400 };
const name: Font = { family: "cond", weight: 500 };

const fourth = (x: number) => {
	const digits = Math.max(0, 3 - Math.floor(Math.log10(Math.abs(x))));
	return x.toFixed(digits);
};

const keyBlock = (
	data: Data,
	derived: Derived,
	rad: (n: number) => number,
	cMax: number,
	spec: { unit: number; block: number; blockW: number; short: boolean },
) => {
	const size = 32;
	const lineH = 56;
	const gap = 40;
	const marks = [0.001, 0.01, 0.1, 1, 10, 100, 1000, 10000].filter(
		(v) => v <= cMax && rad(v) >= 4,
	);
	const shown = marks.slice(-3);
	const rMax = Math.max(...shown.map(rad));
	const row = Math.max(2 * rMax, 48);
	const sample = 40;
	const anatomy = cap(sample, name) + 32;
	const continents = derived.shown;
	const swatch = 28;
	const pieces = continents.map((c) => ({
		c,
		w: swatch + 12 + measure(c, size, plain) + 40,
	}));
	const lead = measure("Dot colour = country, by continent", size, label);
	const { beta, scale } = data.model;
	const years = data.selection;
	const span =
		years.from === years.to ? `${years.from}` : `${years.from} to ${years.to}`;
	const unit = spec.unit;
	const amount = `${Number(unit.toPrecision(6))}`;
	const blocks = `Count in blocks of ${amount} ${unit === 1 ? "paper" : "papers"}`;
	const blockItems = [
		"Up to Expected",
		"Above Expected",
		...(spec.short ? ["Short of Expected"] : []),
	];
	const ends = ["Count", "Excess"];
	const shiftItems = ["Rises", "Falls"];
	const bw = Math.round(spec.blockW * 2);
	const bh = Math.round(spec.block * 2);
	const bell = 64;
	const dot = 8;
	const height =
		row +
		gap +
		lineH +
		gap +
		anatomy +
		gap +
		lineH +
		gap +
		lineH +
		lineH +
		gap +
		lineH * 2;
	const lines = [
		lead + 32 + pieces.reduce((a, p) => a + p.w, 0),
		measure(blocks, size, label) +
			32 +
			blockItems.reduce(
				(a, t) => a + bw + 12 + measure(t, size, plain) + 40,
				0,
			),
		measure("Rank", size, label) +
			32 +
			ends.reduce(
				(a, t) => a + 2 * dot + 12 + measure(t, size, plain) + 40,
				0,
			) +
			shiftItems.reduce(
				(a, t) => a + bell + 12 + measure(t, size, plain) + 40,
				0,
			),
	];
	return {
		height,
		width: Math.max(...lines, 1200),
		draw: (scene: Scene, x: number, y: number) => {
			const cy = y + row / 2;
			scene.text(
				x,
				cy + cap(size, label) / 2,
				"Dot area = Count",
				size,
				label,
				ink,
			);
			let cx = x + measure("Dot area = Count", size, label) + 48;
			for (const v of shown) {
				const r = rad(v);
				scene.dots(quiet, 0.6, [[cx + r, cy, r]]);
				const text = decade(v);
				scene.text(
					cx + 2 * r + 12,
					cy + cap(size, plain) / 2,
					text,
					size,
					plain,
					ink,
				);
				cx += 2 * r + 12 + measure(text, size, plain) + 40;
			}
			let by = y + row + gap + cap(size, label);
			scene.text(x, by, "Dot colour = country, by continent", size, label, ink);
			cx = x + lead + 32;
			for (const p of pieces) {
				scene.dots(familyTone(p.c), 0.92, [
					[cx + swatch / 2, by - cap(size, plain) / 2, swatch / 2],
				]);
				scene.text(cx + swatch + 12, by, p.c, size, plain, ink);
				cx += p.w;
			}
			by += lineH - cap(size, label) + gap;
			const base = by + cap(sample, name);
			const rank = "Rank ";
			scene.text(x, base, rank, sample, plain, quiet);
			scene.text(
				x + measure(rank, sample, plain),
				base,
				"Institution",
				sample,
				name,
				ink,
			);
			by = base + 32 + gap + cap(size, label);
			scene.text(x, by, "Count by year", size, label, ink);
			let kx = x + measure("Count by year", size, label) + 40;
			const sq = Math.round(cap(size, plain));
			scene.rect(kx, by - sq, sq, sq, ink);
			scene.text(kx + sq + 12, by, span, size, plain, ink);
			kx += sq + 12 + measure(span, size, plain) + 40;
			scene.rect(kx, by - sq, sq, sq, rule);
			scene.text(kx + sq + 12, by, "Other years", size, plain, ink);
			by += lineH + gap;
			scene.text(x, by, blocks, size, label, ink);
			kx = x + measure(blocks, size, label) + 32;
			const mid = by - cap(size, plain) / 2;
			for (const [k, t] of blockItems.entries()) {
				const piece = sheet(kx, mid - bh / 2, bw, bh);
				if (k === 2) scene.path(piece, "none", loss, 1.5);
				else scene.path(piece, k ? gain : par);
				scene.text(kx + bw + 12, by, t, size, plain, ink);
				kx += bw + 12 + measure(t, size, plain) + 40;
			}
			by += lineH;
			scene.text(x, by, "Rank", size, label, ink);
			kx = x + measure("Rank", size, label) + 32;
			const my = by - cap(size, plain) / 2;
			for (const [k, t] of ends.entries()) {
				if (k) scene.dots(ink, 1, [[kx + dot, my, dot]]);
				else scene.dots(paper, 1, [[kx + dot, my, dot]], ink, 2);
				scene.text(kx + 2 * dot + 12, by, t, size, plain, ink);
				kx += 2 * dot + 12 + measure(t, size, plain) + 40;
			}
			for (const [k, t] of shiftItems.entries()) {
				scene.line(kx + 4, my, kx + bell - 4, my, k ? loss : gain, 3);
				scene.text(kx + bell + 12, by, t, size, plain, ink);
				kx += bell + 12 + measure(t, size, plain) + 40;
			}
			by += lineH + gap;
			scene.text(x, by, "Excess = Count − Expected", size, plain, ink);
			by += lineH;
			const lead2 = `Expected = ${fourth(scale)} × Authors`;
			scene.text(x, by, lead2, size, plain, ink);
			scene.text(
				x + measure(lead2, size, plain) + 4,
				by - size * 0.42,
				fourth(beta),
				20,
				plain,
				ink,
			);
		},
	};
};

export const compose = (data: Data, meta: Meta) => {
	const derived = derive(data);
	const width = page.width - 2 * margin;
	const bottom = page.height - margin;
	const inst = data.institutions;
	const cMax = Math.max(...inst.map((r) => r.count / 1e6));
	const rad = (n: number) => Math.max(2, 64 * Math.sqrt(n / cMax));
	const attempt = (
		inside: boolean,
		boost: boolean,
		most = Number.POSITIVE_INFINITY,
	) => {
		const probe = ladderFor(data, bottom - margin);
		const natural = inside
			? probe.height +
				128 +
				countriesBlock(
					data,
					derived,
					probe.L,
					0,
					false,
					probe.width,
					Math.round(probe.width / 4),
				).height
			: 0;
		const ledger = planLedger(
			data,
			derived,
			width,
			inside ? bottom - margin - natural - 192 : 2944,
			!inside,
			boost,
			most,
		);
		const ledgerTop = bottom - ledger.height;
		const forkBottom = ledgerTop - 192;
		const region = {
			x0: margin,
			y0: margin,
			x1: page.width - margin,
			y1: forkBottom,
		};
		const spec = ladderFor(data, forkBottom - margin);
		let nations: Block | undefined;
		let beside: Rect | undefined;
		if (inside) {
			const room = forkBottom - (margin + spec.height + 128);
			const size = [spec.L, 16, 14, 12]
				.filter((v) => v <= spec.L)
				.find(
					(v) =>
						countriesBlock(data, derived, v, room, false, spec.width).height <=
						room,
				);
			if (size === undefined) return undefined;
			nations = countriesBlock(data, derived, size, room, false, spec.width);
			beside = {
				x: region.x1 - spec.width,
				y: forkBottom - nations.height,
				w: spec.width,
				h: nations.height,
			};
		}
		const key = keyBlock(data, derived, rad, cMax, spec);
		let head = masthead(data, meta, Math.round(width * 0.5));
		let least = Number.POSITIVE_INFINITY;
		for (const most of [384, 320, 256, 224, 192, 160]) {
			const candidate = masthead(data, meta, Math.round(width * 0.5), most);
			const compression = probeFork(data, region, candidate, key, spec);
			if (compression < least - 0.02) {
				least = compression;
				head = candidate;
			}
			if (compression <= 0.04) break;
		}
		const fork = plotFork(data, derived, region, head, key, spec, beside);
		return { ledger, ledgerTop, nations, beside, fork, head, key };
	};
	const pick = (boost: boolean) => attempt(true, boost);
	const plan =
		pick(true) ?? pick(false) ?? attempt(false, true) ?? attempt(false, false);
	if (!plan) throw new Error("no layout");
	const { ledger, ledgerTop, nations, beside, fork, head, key } = plan;
	const scene = new Scene();
	scene.rect(0, 0, page.width, page.height, paper);
	scene.items.push(
		...fork.back.items,
		...fork.strings.items,
		...fork.marks.items,
	);
	plotMosaic(scene, data, derived, fork.mosaic);
	head.draw(scene, fork.headAt.x, fork.headAt.y);
	key.draw(scene, fork.headAt.x, fork.headAt.y + head.height + 48);
	if (nations && beside)
		nations.draw(scene, beside.x, beside.y, 0, nations.width);
	for (const layer of fork.labels) scene.items.push(...layer.items);
	scene.items.push(...fork.front.items);
	for (const layer of [
		fork.back,
		fork.strings,
		fork.marks,
		fork.front,
		...fork.labels,
	])
		for (const code of layer.flags) scene.flags.add(code);
	drawLedger(scene, ledger, margin, ledgerTop);
	return { scene, derived, ledger, fork, nations: Boolean(nations) };
};
