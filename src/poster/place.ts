import type { Box } from "./scene";

export type Segment = [number, number, number, number];

export const overlaps = (a: Box, b: Box) =>
	a.x0 < b.x1 && a.x1 > b.x0 && a.y0 < b.y1 && a.y1 > b.y0;

export const cross = (a: Segment, b: Segment) => {
	const d = (
		p: number,
		q: number,
		r: number,
		s: number,
		u: number,
		v: number,
	) => (r - p) * (v - q) - (s - q) * (u - p);
	const d1 = d(b[0], b[1], b[2], b[3], a[0], a[1]);
	const d2 = d(b[0], b[1], b[2], b[3], a[2], a[3]);
	const d3 = d(a[0], a[1], a[2], a[3], b[0], b[1]);
	const d4 = d(a[0], a[1], a[2], a[3], b[2], b[3]);
	return d1 * d2 < 0 && d3 * d4 < 0;
};

export const span = (seg: Segment): Box => ({
	x0: Math.min(seg[0], seg[2]),
	y0: Math.min(seg[1], seg[3]),
	x1: Math.max(seg[0], seg[2]),
	y1: Math.max(seg[1], seg[3]),
});

type Cells = [number, number, number, number];

const cells = (b: Box, size: number): Cells => [
	Math.floor(b.x0 / size),
	Math.floor(b.x1 / size),
	Math.floor(b.y0 / size),
	Math.floor(b.y1 / size),
];

const meet = (a: Cells, b: Cells) =>
	a[0] <= a[1] &&
	a[2] <= a[3] &&
	b[0] <= b[1] &&
	b[2] <= b[3] &&
	a[0] <= b[1] &&
	b[0] <= a[1] &&
	a[2] <= b[3] &&
	b[2] <= a[3];

const hitsAt = (
	x0: number,
	y0: number,
	x1: number,
	y1: number,
	bx0: number,
	by0: number,
	bx1: number,
	by1: number,
) => {
	let t0 = 0;
	let t1 = 1;
	const dx = x1 - x0;
	const dy = y1 - y0;
	const p = [-dx, dx, -dy, dy];
	const q = [x0 - bx0, bx1 - x0, y0 - by0, by1 - y0];
	for (let i = 0; i < 4; i++) {
		if (p[i] === 0) {
			if (q[i] < 0) return false;
			continue;
		}
		const r = q[i] / p[i];
		if (p[i] < 0) {
			if (r > t1) return false;
			if (r > t0) t0 = r;
		} else {
			if (r < t0) return false;
			if (r < t1) t1 = r;
		}
	}
	return t0 <= t1;
};

class Grid {
	readonly at: Float64Array;
	private i0 = 0;
	private j0 = 0;
	private w = 0;
	private h = 0;
	private start = new Int32Array(1);
	private list = new Int32Array(0);
	private rows = new Int32Array(0);

	constructor(
		coords: number[][],
		private size: number,
		bound: (c: number[]) => Box,
	) {
		this.at = Float64Array.from(coords.flat());
		const ranges = coords.map((c) => cells(bound(c), size));
		let [i0, i1, j0, j1] = [Infinity, -Infinity, Infinity, -Infinity];
		for (const r of ranges) {
			if (r[0] > r[1] || r[2] > r[3]) continue;
			i0 = Math.min(i0, r[0]);
			i1 = Math.max(i1, r[1]);
			j0 = Math.min(j0, r[2]);
			j1 = Math.max(j1, r[3]);
		}
		if (i0 > i1) return;
		this.i0 = i0;
		this.j0 = j0;
		this.w = i1 - i0 + 1;
		this.h = j1 - j0 + 1;
		const count = new Int32Array(this.w * this.h + 1);
		const each = (r: Cells, f: (cell: number) => void) => {
			if (r[0] > r[1] || r[2] > r[3]) return;
			for (let j = r[2]; j <= r[3]; j++)
				for (let i = r[0]; i <= r[1]; i++)
					f((j - this.j0) * this.w + (i - this.i0));
		};
		for (const r of ranges) each(r, (c) => count[c + 1]++);
		for (let c = 0; c < this.w * this.h; c++) count[c + 1] += count[c];
		this.start = count.slice();
		this.list = new Int32Array(count[this.w * this.h]);
		const fill = count.slice();
		ranges.forEach((r, k) => {
			each(r, (c) => {
				this.list[fill[c]++] = k;
			});
		});
		this.rows = new Int32Array(this.h * (this.w + 1));
		for (let j = 0; j < this.h; j++)
			for (let i = 0; i < this.w; i++) {
				const c = j * this.w + i;
				this.rows[j * (this.w + 1) + i + 1] =
					this.rows[j * (this.w + 1) + i] + this.start[c + 1] - this.start[c];
			}
	}

	private range(x0: number, y0: number, x1: number, y1: number) {
		const s = this.size;
		return [
			Math.max(Math.floor(x0 / s), this.i0) - this.i0,
			Math.min(Math.floor(x1 / s), this.i0 + this.w - 1) - this.i0,
			Math.max(Math.floor(y0 / s), this.j0) - this.j0,
			Math.min(Math.floor(y1 / s), this.j0 + this.h - 1) - this.j0,
		];
	}

	overlaps(x0: number, y0: number, x1: number, y1: number) {
		if (!this.w) return false;
		const [i0, i1, j0, j1] = this.range(x0, y0, x1, y1);
		if (i0 > i1) return false;
		const { rows, start, list, at, w } = this;
		for (let j = j0; j <= j1; j++) {
			if (rows[j * (w + 1) + i1 + 1] === rows[j * (w + 1) + i0]) continue;
			for (let i = i0; i <= i1; i++)
				for (let k = start[j * w + i]; k < start[j * w + i + 1]; k++) {
					const o = 4 * list[k];
					if (x0 < at[o + 2] && x1 > at[o] && y0 < at[o + 3] && y1 > at[o + 1])
						return true;
				}
		}
		return false;
	}

	crossing(x0: number, y0: number, x1: number, y1: number) {
		if (!this.w) return false;
		const [i0, i1, j0, j1] = this.range(x0, y0, x1, y1);
		if (i0 > i1) return false;
		const { rows, start, list, at, w } = this;
		for (let j = j0; j <= j1; j++) {
			if (rows[j * (w + 1) + i1 + 1] === rows[j * (w + 1) + i0]) continue;
			for (let i = i0; i <= i1; i++)
				for (let k = start[j * w + i]; k < start[j * w + i + 1]; k++) {
					const o = 4 * list[k];
					if (hitsAt(at[o], at[o + 1], at[o + 2], at[o + 3], x0, y0, x1, y1))
						return true;
				}
		}
		return false;
	}

	crossed(x0: number, y0: number, x1: number, y1: number) {
		if (!this.w) return false;
		const [i0, i1, j0, j1] = this.range(
			Math.min(x0, x1),
			Math.min(y0, y1),
			Math.max(x0, x1),
			Math.max(y0, y1),
		);
		if (i0 > i1) return false;
		const { rows, start, list, at, w } = this;
		for (let j = j0; j <= j1; j++) {
			if (rows[j * (w + 1) + i1 + 1] === rows[j * (w + 1) + i0]) continue;
			for (let i = i0; i <= i1; i++)
				for (let k = start[j * w + i]; k < start[j * w + i + 1]; k++) {
					const o = 4 * list[k];
					if (hitsAt(x0, y0, x1, y1, at[o], at[o + 1], at[o + 2], at[o + 3]))
						return true;
				}
		}
		return false;
	}
}

const boxes = (list: Box[]) => list.map((b) => [b.x0, b.y0, b.x1, b.y1]);

const corners = ([x0, y0, x1, y1]: number[]): Box => ({ x0, y0, x1, y1 });

export class Rails {
	private grid: Grid;

	constructor(segments: Segment[]) {
		this.grid = new Grid(segments, 128, (c) => span(c as Segment));
	}

	hits(b: Box) {
		return this.grid.crossing(b.x0, b.y0, b.x1, b.y1);
	}
}

export class Ground {
	private field: Grid;
	private written: Grid;
	private rails: Grid;

	constructor(field: Box[], written: Box[], rails: Segment[]) {
		this.field = new Grid(boxes(field), 96, corners);
		this.written = new Grid(boxes(written), 96, corners);
		this.rails = new Grid(rails, 128, (c) => span(c as Segment));
	}

	clear(x0: number, y0: number, x1: number, y1: number) {
		return (
			!this.field.overlaps(x0, y0, x1, y1) &&
			!this.rails.crossing(x0, y0, x1, y1)
		);
	}

	reach([x0, y0, x1, y1]: Segment) {
		return !this.written.crossed(x0, y0, x1, y1);
	}
}

const slack = 1;

export class Board {
	private keys = new Map<string, number>();
	private live: number[] = [];
	private stamps: number[] = [];
	private clock = 0;
	private size = 0;
	private box = new Float64Array(256);
	private reachOf = new Float64Array(256);
	private lead = new Float64Array(256);
	private led = new Uint8Array(64);
	private near = new Int32Array(256);
	private line = new Int32Array(256);
	alive = new Uint8Array(64);

	private grow() {
		const twice = <T extends Float64Array | Int32Array | Uint8Array>(a: T) => {
			const out = new (a.constructor as new (n: number) => T)(a.length * 2);
			out.set(a);
			return out;
		};
		this.box = twice(this.box);
		this.reachOf = twice(this.reachOf);
		this.lead = twice(this.lead);
		this.led = twice(this.led);
		this.near = twice(this.near);
		this.line = twice(this.line);
		this.alive = twice(this.alive);
	}

	id(key: string, box: Box, lead?: Segment) {
		let id = this.keys.get(key);
		if (id !== undefined) return id;
		id = this.size++;
		this.keys.set(key, id);
		if (id >= this.alive.length) this.grow();
		this.box.set([box.x0, box.y0, box.x1, box.y1], id * 4);
		this.near.set(cells(box, 96), id * 4);
		if (lead) {
			this.led[id] = 1;
			this.lead.set(lead, id * 4);
			const s = span(lead);
			this.reachOf.set(
				[s.x0 - slack, s.y0 - slack, s.x1 + slack, s.y1 + slack],
				id * 4,
			);
			this.line.set(cells(s, 128), id * 4);
		}
		return id;
	}

	add(id: number) {
		this.live.push(id);
		this.stamps.push(++this.clock);
		this.alive[id] = 1;
	}

	checkpoint() {
		return this.live.length;
	}

	rollback(at: number) {
		while (this.live.length > at) {
			this.alive[this.live.pop() as number] = 0;
			this.stamps.pop();
		}
	}

	now() {
		return this.clock;
	}

	after(stamp: number) {
		let lo = 0;
		let hi = this.stamps.length;
		while (lo < hi) {
			const mid = (lo + hi) >> 1;
			if (this.stamps[mid] <= stamp) lo = mid + 1;
			else hi = mid;
		}
		return lo;
	}

	private meets(cells: Int32Array, at: number, q: Cells) {
		return meet([cells[at], cells[at + 1], cells[at + 2], cells[at + 3]], q);
	}

	covers(q: Box, from = 0) {
		const { box: b, reachOf: r, lead: l, live } = this;
		let near: Cells | undefined;
		let line: Cells | undefined;
		for (let k = from; k < live.length; k++) {
			const id = live[k];
			const at = id * 4;
			if (
				q.x0 < b[at + 2] &&
				q.x1 > b[at] &&
				q.y0 < b[at + 3] &&
				q.y1 > b[at + 1]
			) {
				near ??= cells(q, 96);
				if (this.meets(this.near, at, near)) return id;
			}
			if (
				this.led[id] &&
				r[at] <= q.x1 &&
				r[at + 2] >= q.x0 &&
				r[at + 1] <= q.y1 &&
				r[at + 3] >= q.y0
			) {
				line ??= cells(q, 128);
				if (
					this.meets(this.line, at, line) &&
					hitsAt(l[at], l[at + 1], l[at + 2], l[at + 3], q.x0, q.y0, q.x1, q.y1)
				)
					return id;
			}
		}
		return -1;
	}

	blocks(seg: Segment, from = 0) {
		const { box: b, live } = this;
		const [x0, y0, x1, y1] = seg;
		const sx0 = Math.min(x0, x1) - slack;
		const sx1 = Math.max(x0, x1) + slack;
		const sy0 = Math.min(y0, y1) - slack;
		const sy1 = Math.max(y0, y1) + slack;
		let near: Cells | undefined;
		for (let k = from; k < live.length; k++) {
			const id = live[k];
			const at = id * 4;
			if (sx0 > b[at + 2] || sx1 < b[at] || sy0 > b[at + 3] || sy1 < b[at + 1])
				continue;
			near ??= cells(span(seg), 96);
			if (
				this.meets(this.near, at, near) &&
				hitsAt(x0, y0, x1, y1, b[at], b[at + 1], b[at + 2], b[at + 3])
			)
				return id;
		}
		return -1;
	}

	crosses(seg: Segment) {
		const { reachOf: r, lead: l, live } = this;
		const sx0 = Math.min(seg[0], seg[2]);
		const sx1 = Math.max(seg[0], seg[2]);
		const sy0 = Math.min(seg[1], seg[3]);
		const sy1 = Math.max(seg[1], seg[3]);
		let line: Cells | undefined;
		for (const id of live) {
			if (!this.led[id]) continue;
			const at = id * 4;
			if (sx0 > r[at + 2] || sx1 < r[at] || sy0 > r[at + 3] || sy1 < r[at + 1])
				continue;
			line ??= cells(span(seg), 128);
			if (
				this.meets(this.line, at, line) &&
				cross(seg, [l[at], l[at + 1], l[at + 2], l[at + 3]])
			)
				return id;
		}
		return -1;
	}
}

export const ranked = (dist: number[]) => {
	let top = 0;
	for (const v of dist) top = Math.max(top, Math.floor(v));
	const start = new Int32Array(top + 2);
	for (const v of dist) start[Math.floor(v) + 1]++;
	for (let b = 0; b <= top; b++) start[b + 1] += start[b];
	const order = new Int32Array(dist.length);
	const fill = start.slice();
	for (let k = 0; k < dist.length; k++) order[fill[Math.floor(dist[k])]++] = k;
	for (let b = 0; b <= top; b++) {
		const from = start[b];
		const to = start[b + 1];
		for (let k = from + 1; k < to; k++) {
			const v = order[k];
			let j = k - 1;
			while (j >= from && dist[order[j]] > dist[v]) {
				order[j + 1] = order[j];
				j--;
			}
			order[j + 1] = v;
		}
	}
	return order;
};
