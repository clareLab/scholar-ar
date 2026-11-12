const codewords = [
	-1, 10, 16, 26, 18, 24, 16, 18, 22, 22, 26, 30, 22, 22, 24, 24, 28, 28, 26,
	26, 26, 26, 28, 28, 28, 28, 28, 28, 28, 28, 28, 28, 28, 28, 28, 28, 28, 28,
	28, 28, 28,
];
const blocks = [
	-1, 1, 1, 1, 2, 2, 4, 4, 4, 5, 5, 5, 8, 9, 9, 10, 10, 11, 13, 14, 16, 17, 17,
	18, 20, 21, 23, 25, 26, 28, 29, 31, 33, 35, 37, 38, 40, 43, 45, 47, 49,
];

const raw = (version: number) => {
	let bits = (16 * version + 128) * version + 64;
	if (version >= 2) {
		const n = Math.floor(version / 7) + 2;
		bits -= (25 * n - 10) * n - 55;
		if (version >= 7) bits -= 36;
	}
	return bits;
};

const capacity = (version: number) =>
	Math.floor(raw(version) / 8) - codewords[version] * blocks[version];

const multiply = (a: number, b: number) => {
	let out = 0;
	for (let k = 7; k >= 0; k--) {
		out = (out << 1) ^ ((out >>> 7) * 0x11d);
		out ^= ((b >>> k) & 1) * a;
	}
	return out & 0xff;
};

const divisor = (degree: number) => {
	const out = new Array<number>(degree).fill(0);
	out[degree - 1] = 1;
	let root = 1;
	for (let k = 0; k < degree; k++) {
		for (let j = 0; j < degree; j++) {
			out[j] = multiply(out[j], root);
			if (j + 1 < degree) out[j] ^= out[j + 1];
		}
		root = multiply(root, 2);
	}
	return out;
};

const remainder = (data: number[], by: number[]) => {
	const out = by.map(() => 0);
	for (const byte of data) {
		const factor = byte ^ (out.shift() as number);
		out.push(0);
		by.forEach((c, k) => {
			out[k] ^= multiply(c, factor);
		});
	}
	return out;
};

const interleave = (data: number[], version: number) => {
	const n = blocks[version];
	const ec = codewords[version];
	const total = Math.floor(raw(version) / 8);
	const short = n - (total % n);
	const length = Math.floor(total / n);
	const by = divisor(ec);
	const parts: number[][] = [];
	for (let k = 0, at = 0; k < n; k++) {
		const take = length - ec + (k < short ? 0 : 1);
		const chunk = data.slice(at, at + take);
		at += take;
		const tail = remainder(chunk, by);
		if (k < short) chunk.push(0);
		parts.push([...chunk, ...tail]);
	}
	const out: number[] = [];
	for (let j = 0; j < parts[0].length; j++)
		parts.forEach((part, k) => {
			if (j !== length - ec || k >= short) out.push(part[j]);
		});
	return out;
};

const encode = (text: string) => {
	const bytes = [...new TextEncoder().encode(text)];
	let version = 1;
	const need = (v: number) => 4 + (v < 10 ? 8 : 16) + 8 * bytes.length;
	while (need(version) > capacity(version) * 8) version++;
	if (version > 40) throw new Error("link too long for a QR code");
	const bits: number[] = [];
	const put = (value: number, length: number) => {
		for (let k = length - 1; k >= 0; k--) bits.push((value >>> k) & 1);
	};
	put(4, 4);
	put(bytes.length, version < 10 ? 8 : 16);
	for (const b of bytes) put(b, 8);
	const room = capacity(version) * 8;
	put(0, Math.min(4, room - bits.length));
	put(0, (8 - (bits.length % 8)) % 8);
	for (let pad = 0xec; bits.length < room; pad ^= 0xec ^ 0x11) put(pad, 8);
	const data: number[] = [];
	for (let k = 0; k < bits.length; k += 8)
		data.push(bits.slice(k, k + 8).reduce((a, b) => (a << 1) | b, 0));
	return { version, words: interleave(data, version) };
};

const masks: ((x: number, y: number) => boolean)[] = [
	(x, y) => (x + y) % 2 === 0,
	(_, y) => y % 2 === 0,
	(x) => x % 3 === 0,
	(x, y) => (x + y) % 3 === 0,
	(x, y) => (Math.floor(x / 3) + Math.floor(y / 2)) % 2 === 0,
	(x, y) => ((x * y) % 2) + ((x * y) % 3) === 0,
	(x, y) => (((x * y) % 2) + ((x * y) % 3)) % 2 === 0,
	(x, y) => (((x + y) % 2) + ((x * y) % 3)) % 2 === 0,
];

const penalty = (grid: boolean[][]) => {
	const size = grid.length;
	let score = 0;
	const lines = [...grid, ...grid.map((_, x) => grid.map((row) => row[x]))];
	for (const line of lines) {
		let run = 1;
		for (let k = 1; k <= size; k++) {
			if (k < size && line[k] === line[k - 1]) run++;
			else {
				if (run >= 5) score += run - 2;
				run = 1;
			}
		}
		const text = line.map((on) => (on ? "1" : "0")).join("");
		for (const pattern of ["10111010000", "00001011101"])
			for (
				let at = text.indexOf(pattern);
				at >= 0;
				at = text.indexOf(pattern, at + 1)
			)
				score += 40;
	}
	for (let y = 0; y + 1 < size; y++)
		for (let x = 0; x + 1 < size; x++) {
			const c = grid[y][x];
			if (
				c === grid[y][x + 1] &&
				c === grid[y + 1][x] &&
				c === grid[y + 1][x + 1]
			)
				score += 3;
		}
	const dark = grid.flat().filter(Boolean).length;
	score += Math.floor(Math.abs((dark * 20) / (size * size) - 10)) * 10;
	return score;
};

export const qr = (text: string) => {
	const { version, words } = encode(text);
	const size = version * 4 + 17;
	const grid = Array.from({ length: size }, () =>
		new Array<boolean>(size).fill(false),
	);
	const fixed = Array.from({ length: size }, () =>
		new Array<boolean>(size).fill(false),
	);
	const set = (x: number, y: number, on: boolean) => {
		grid[y][x] = on;
		fixed[y][x] = true;
	};
	for (let k = 0; k < size; k++) {
		set(6, k, k % 2 === 0);
		set(k, 6, k % 2 === 0);
	}
	for (const [cx, cy] of [
		[3, 3],
		[size - 4, 3],
		[3, size - 4],
	])
		for (let dy = -4; dy <= 4; dy++)
			for (let dx = -4; dx <= 4; dx++) {
				const x = cx + dx;
				const y = cy + dy;
				if (x < 0 || y < 0 || x >= size || y >= size) continue;
				const d = Math.max(Math.abs(dx), Math.abs(dy));
				set(x, y, d !== 2 && d !== 4);
			}
	if (version > 1) {
		const n = Math.floor(version / 7) + 2;
		const step =
			version === 32 ? 26 : Math.ceil((version * 4 + 4) / (n * 2 - 2)) * 2;
		const at = [6];
		for (let p = size - 7; at.length < n; p -= step) at.splice(1, 0, p);
		for (const [i, x] of at.entries())
			for (const [j, y] of at.entries()) {
				if (
					(i === 0 && j === 0) ||
					(i === 0 && j === n - 1) ||
					(i === n - 1 && j === 0)
				)
					continue;
				for (let dy = -2; dy <= 2; dy++)
					for (let dx = -2; dx <= 2; dx++)
						set(x + dx, y + dy, Math.max(Math.abs(dx), Math.abs(dy)) !== 1);
			}
	}
	const format = (mask: number) => {
		let rest = mask;
		for (let k = 0; k < 10; k++) rest = (rest << 1) ^ ((rest >>> 9) * 0x537);
		const bits = ((mask << 10) | rest) ^ 0x5412;
		const bit = (k: number) => ((bits >>> k) & 1) === 1;
		for (let k = 0; k <= 5; k++) set(8, k, bit(k));
		set(8, 7, bit(6));
		set(8, 8, bit(7));
		set(7, 8, bit(8));
		for (let k = 9; k < 15; k++) set(14 - k, 8, bit(k));
		for (let k = 0; k < 8; k++) set(size - 1 - k, 8, bit(k));
		for (let k = 8; k < 15; k++) set(8, size - 15 + k, bit(k));
		set(8, size - 8, true);
	};
	format(0);
	if (version >= 7) {
		let rest = version;
		for (let k = 0; k < 12; k++) rest = (rest << 1) ^ ((rest >>> 11) * 0x1f25);
		const bits = (version << 12) | rest;
		for (let k = 0; k < 18; k++) {
			const on = ((bits >>> k) & 1) === 1;
			const a = size - 11 + (k % 3);
			const b = Math.floor(k / 3);
			set(a, b, on);
			set(b, a, on);
		}
	}
	let k = 0;
	for (let right = size - 1; right >= 1; right -= 2) {
		if (right === 6) right = 5;
		for (let step = 0; step < size; step++)
			for (let j = 0; j < 2; j++) {
				const x = right - j;
				const y = ((right + 1) & 2) === 0 ? size - 1 - step : step;
				if (fixed[y][x] || k >= words.length * 8) continue;
				grid[y][x] = ((words[k >>> 3] >>> (7 - (k & 7))) & 1) === 1;
				k++;
			}
	}
	const masked = (mask: number) => {
		const copy = grid.map((row) => [...row]);
		for (let y = 0; y < size; y++)
			for (let x = 0; x < size; x++)
				if (!fixed[y][x] && masks[mask](x, y)) copy[y][x] = !copy[y][x];
		return copy;
	};
	let best = 0;
	let lowest = Number.POSITIVE_INFINITY;
	for (let mask = 0; mask < 8; mask++) {
		format(mask);
		const score = penalty(masked(mask));
		if (score < lowest) {
			lowest = score;
			best = mask;
		}
	}
	format(best);
	return masked(best);
};
