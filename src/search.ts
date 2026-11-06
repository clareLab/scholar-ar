type Folded = {
	index: Int32Array;
	names: string[];
	text: Uint16Array;
	ends: Int32Array;
	carries: Int8Array;
};

const cache = new WeakMap<readonly unknown[], Folded>();

const fold = (text: string) =>
	(/[^\x20-\x7e]/.test(text)
		? text.normalize("NFD").replace(/\p{M}/gu, "")
		: text
	).toLowerCase();

const folded = <T>(items: readonly T[], text: (item: T) => string) => {
	let out = cache.get(items);
	if (out) return out;
	const seen = new Map<string, number>();
	const index = new Int32Array(items.length);
	items.forEach((item, k) => {
		const name = fold(text(item));
		let id = seen.get(name);
		if (id === undefined) {
			id = seen.size;
			seen.set(name, id);
		}
		index[k] = id;
	});
	const names = [...seen.keys()];
	const ends = new Int32Array(names.length);
	let size = 0;
	let longest = 0;
	names.forEach((name, k) => {
		size += name.length;
		ends[k] = size;
		longest = Math.max(longest, name.length);
	});
	const codes = new Uint16Array(size);
	let at = 0;
	for (const name of names)
		for (let c = 0; c < name.length; c++) codes[at++] = name.charCodeAt(c);
	out = { index, names, text: codes, ends, carries: new Int8Array(longest) };
	cache.set(items, out);
	return out;
};

export const fuzzy = <T>(
	items: readonly T[],
	text: (item: T) => string,
	query: string,
) => {
	const q = fold(query.trim());
	if (!q) return [...items];
	const { index, names, text: codes, ends, carries } = folded(items, text);
	const blocks = Math.ceil(q.length / 32);
	const peq = new Int32Array(blocks << 16);
	for (let j = 0; j < q.length; j++)
		peq[((j >> 5) << 16) | q.charCodeAt(j)] |= 1 << (j & 31);
	const scores = new Int32Array(names.length);
	let c = 0;
	for (let k = 0; k < names.length; k++) {
		const end = ends[k];
		let best = 0;
		if (!names[k].startsWith(q)) {
			let score = q.length;
			best = score;
			for (let b = 0; b < blocks; b++) {
				const last = b === blocks - 1;
				const shift = last ? (q.length - 1) & 31 : 31;
				const row = b << 16;
				let p = -1;
				let m = 0;
				for (let at = c; at < end; at++) {
					const carry = b ? carries[at - c] : 0;
					const eq = peq[row | codes[at]];
					const xv = eq | m;
					const hit = carry < 0 ? eq | 1 : eq;
					const xh = (((hit & p) + p) ^ p) | hit;
					const ph = m | ~(xh | p);
					const mh = p & xh;
					const out = ((ph >>> shift) & 1) - ((mh >>> shift) & 1);
					const up = (ph << 1) | (carry > 0 ? 1 : 0);
					p = (mh << 1) | (carry < 0 ? 1 : 0) | ~(xv | up);
					m = up & xv;
					if (!last) carries[at - c] = out;
					else {
						score += out;
						if (score < best) best = score;
					}
				}
			}
			best++;
		}
		c = end;
		scores[k] = best;
	}
	const starts = new Int32Array(q.length + 2);
	for (const id of index) starts[scores[id]]++;
	let start = 0;
	for (let k = 0; k < starts.length; k++) {
		const size = starts[k];
		starts[k] = start;
		start += size;
	}
	const out = new Array<T>(items.length);
	index.forEach((id, k) => {
		out[starts[scores[id]]++] = items[k];
	});
	return out;
};
