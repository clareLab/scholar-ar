const folded = new WeakMap<readonly unknown[], string[]>();

const distance = (q: string, name: string, limit: number, row: Int32Array) => {
	for (let j = 0; j <= q.length; j++) row[j] = j;
	let top = Math.min(limit + 1, q.length);
	let best = limit + 1;
	for (let c = 0; c < name.length; c++) {
		const code = name.charCodeAt(c);
		let diagonal = 0;
		for (let j = 1; j <= top; j++) {
			const up = row[j];
			row[j] =
				q.charCodeAt(j - 1) === code
					? diagonal
					: Math.min(diagonal, row[j - 1], up) + 1;
			diagonal = up;
		}
		while (row[top] > limit) top--;
		if (top === q.length) best = Math.min(best, row[top]);
		else top++;
	}
	return best;
};

export const fuzzy = <T>(
	items: readonly T[],
	text: (item: T) => string,
	query: string,
) => {
	const q = query.trim().toLowerCase();
	if (!q) return [...items];
	const limit = Math.min(2, Math.floor(q.length / 4));
	const row = new Int32Array(q.length + 1);
	let names = folded.get(items);
	if (!names) {
		names = items.map((item) => text(item).toLowerCase());
		folded.set(items, names);
	}
	const hits: [number, number][] = [];
	names.forEach((name, at) => {
		const score = name.startsWith(q) ? -1 : distance(q, name, limit, row);
		if (score <= limit) hits.push([score, at]);
	});
	hits.sort((a, b) => a[0] - b[0] || a[1] - b[1]);
	return hits.map(([, at]) => items[at]);
};
