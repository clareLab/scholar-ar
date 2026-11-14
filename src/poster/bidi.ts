type Kind =
	| "L"
	| "R"
	| "AL"
	| "EN"
	| "ES"
	| "ET"
	| "AN"
	| "CS"
	| "NSM"
	| "BN"
	| "B"
	| "S"
	| "WS"
	| "ON";

const within = (code: number, spans: number[]) => {
	for (let k = 0; k < spans.length; k += 2)
		if (code >= spans[k] && code <= spans[k + 1]) return true;
	return false;
};

const european = [
	0x30, 0x39, 0xb2, 0xb3, 0xb9, 0xb9, 0x6f0, 0x6f9, 0x2070, 0x2070, 0x2074,
	0x2079, 0x2080, 0x2089, 0x2488, 0x249b, 0xff10, 0xff19, 0x1d7ce, 0x1d7ff,
	0x1f100, 0x1f10a, 0x1fbf0, 0x1fbf9,
];
const arabicNumber = [
	0x600, 0x605, 0x660, 0x669, 0x66b, 0x66c, 0x6dd, 0x6dd, 0x890, 0x891, 0x8e2,
	0x8e2, 0x10d30, 0x10d39, 0x10e60, 0x10e7e,
];
const separator = [0x2b, 0x2b, 0x2d, 0x2d, 0x207a, 0x207b, 0x208a, 0x208b];
const separators = [0x2212, 0xfb29, 0xfe62, 0xfe63, 0xff0b, 0xff0d];
const terminator = [
	0x23, 0x25, 0xa2, 0xa5, 0xb0, 0xb1, 0x609, 0x60a, 0x66a, 0x66a, 0x9f2, 0x9f3,
	0x9fb, 0x9fb, 0xaf1, 0xaf1, 0xbf9, 0xbf9, 0xe3f, 0xe3f, 0x17db, 0x17db,
	0x2030, 0x2034, 0x20a0, 0x20cf, 0x212e, 0x212e, 0x2213, 0x2213, 0xa838,
	0xa839, 0xfe5f, 0xfe5f, 0xfe69, 0xfe6a, 0xff03, 0xff05, 0xffe0, 0xffe1,
	0xffe5, 0xffe6,
];
const common = [
	0x2c, 0x2c, 0x2e, 0x2f, 0x3a, 0x3a, 0xa0, 0xa0, 0x60c, 0x60c, 0x202f, 0x202f,
	0x2044, 0x2044, 0xfe50, 0xfe50, 0xfe52, 0xfe52, 0xfe55, 0xfe55, 0xff0c,
	0xff0c, 0xff0e, 0xff0f, 0xff1a, 0xff1a,
];
const space = [
	0xc, 0xc, 0x20, 0x20, 0x1680, 0x1680, 0x2000, 0x200a, 0x2028, 0x2028, 0x205f,
	0x205f, 0x3000, 0x3000,
];
const right = [
	0x590, 0x5ff, 0x7c0, 0x85f, 0xfb1d, 0xfb4f, 0x10800, 0x10cff, 0x10d40,
	0x10ebf, 0x10f00, 0x10f2f, 0x10f70, 0x10fff, 0x1e800, 0x1ecff, 0x1ed50,
	0x1edff, 0x1ef00, 0x1efff,
];
const arabic = [
	0x600, 0x7bf, 0x860, 0x8ff, 0xfb50, 0xfdcf, 0xfdf0, 0xfdff, 0xfe70, 0xfefe,
	0x10d00, 0x10d3f, 0x10ec0, 0x10eff, 0x10f30, 0x10f6f, 0x1ec70, 0x1ecbf,
	0x1ed00, 0x1ed4f, 0x1ee00, 0x1eeff,
];
const neutralArabic = [
	0x60e, 0x60f, 0x6de, 0x6de, 0x6e9, 0x6e9, 0xfd3e, 0xfd3f, 0x1eef0, 0x1eef1,
];
const neutralModifier = [
	0x2b9, 0x2ba, 0x2c2, 0x2cf, 0x2d2, 0x2df, 0x2e5, 0x2ed, 0x2ef, 0x2ff,
];

const kindOf = (code: number): Kind => {
	const char = String.fromCodePoint(code);
	if (/[\p{Mn}\p{Me}]/u.test(char)) return "NSM";
	if (within(code, european)) return "EN";
	if (within(code, arabicNumber)) return "AN";
	if (within(code, separator) || separators.includes(code)) return "ES";
	if (within(code, terminator)) return "ET";
	if (within(code, common)) return "CS";
	if (within(code, space)) return "WS";
	if (code === 0x9 || code === 0xb || code === 0x1f) return "S";
	if (code === 0xa || code === 0xd || code === 0x85 || code === 0x2029)
		return "B";
	if (code >= 0x1c && code <= 0x1e) return "B";
	if (/[\p{Cc}\p{Cf}]/u.test(char)) return "BN";
	if (within(code, neutralArabic)) return "ON";
	if (within(code, right)) return "R";
	if (within(code, arabic)) return "AL";
	if (within(code, neutralModifier)) return "ON";
	if (
		/[\p{P}\p{S}\p{No}\p{Zs}]/u.test(char) &&
		/[\p{Script=Zyyy}\p{Script=Zinh}]/u.test(char)
	)
		return "ON";
	return "L";
};

const pairs =
	"()[]{}༺༻༼༽᚛᚜⁅⁆⁽⁾₍₎⌈⌉⌊⌋〈〉❨❩❪❫❬❭❮❯❰❱❲❳❴❵⟅⟆⟦⟧⟨⟩⟪⟫⟬⟭⟮⟯⦃⦄⦅⦆⦇⦈⦉⦊⦋⦌⦍⦎⦏⦐⦑⦒⦓⦔⦕⦖⦗⦘⧘⧙⧚⧛⧼⧽⸢⸣⸤⸥⸦⸧⸨⸩〈〉《》「」『』【】〔〕〖〗〘〙〚〛﹙﹚﹛﹜﹝﹞（）［］｛｝｟｠｢｣";
const opening = new Map<number, number>();
const closing = new Map<number, number>();
for (let k = 0; k < pairs.length; k += 2) {
	const a = pairs.charCodeAt(k);
	const b = pairs.charCodeAt(k + 1);
	opening.set(a, b);
	closing.set(b, a);
}
const canonical = (code: number) =>
	code === 0x2329 ? 0x3008 : code === 0x232a ? 0x3009 : code;

const mirrors = new Map<number, number>([...opening, ...closing]);
for (const [a, b] of [
	[0x3c, 0x3e],
	[0xab, 0xbb],
	[0x2039, 0x203a],
	[0x2264, 0x2265],
])
	mirrors.set(a, b).set(b, a);

export const mirror = (code: number) => mirrors.get(code) ?? code;

const strong = (kind: Kind) =>
	kind === "L"
		? "L"
		: kind === "R" || kind === "EN" || kind === "AN"
			? "R"
			: "";

export const levels = (codes: number[]) => {
	const out = codes.map(() => 0);
	const original = codes.map(kindOf);
	if (!original.some((k) => k === "R" || k === "AL" || k === "AN")) return out;
	const at = original.flatMap((k, i) => (k === "BN" ? [] : [i]));
	const t = at.map((i) => original[i]);
	const n = t.length;
	let previous: Kind = "L";
	for (let k = 0; k < n; k++) {
		if (t[k] === "NSM") t[k] = previous;
		previous = t[k];
	}
	let last: Kind = "L";
	for (let k = 0; k < n; k++) {
		if (t[k] === "L" || t[k] === "R" || t[k] === "AL") last = t[k];
		else if (t[k] === "EN" && last === "AL") t[k] = "AN";
	}
	for (let k = 0; k < n; k++) if (t[k] === "AL") t[k] = "R";
	for (let k = 1; k + 1 < n; k++) {
		if (t[k] === "ES" && t[k - 1] === "EN" && t[k + 1] === "EN") t[k] = "EN";
		else if (
			t[k] === "CS" &&
			t[k - 1] === t[k + 1] &&
			(t[k - 1] === "EN" || t[k - 1] === "AN")
		)
			t[k] = t[k - 1];
	}
	for (let k = 0; k < n; ) {
		if (t[k] !== "ET") {
			k++;
			continue;
		}
		let end = k;
		while (end < n && t[end] === "ET") end++;
		if ((k > 0 && t[k - 1] === "EN") || (end < n && t[end] === "EN"))
			for (let j = k; j < end; j++) t[j] = "EN";
		k = end;
	}
	for (let k = 0; k < n; k++)
		if (t[k] === "ES" || t[k] === "ET" || t[k] === "CS") t[k] = "ON";
	last = "L";
	for (let k = 0; k < n; k++) {
		if (t[k] === "L" || t[k] === "R") last = t[k];
		else if (t[k] === "EN" && last === "L") t[k] = "L";
	}
	const found: [number, number][] = [];
	const stack: [number, number][] = [];
	for (let k = 0; k < n; k++) {
		if (t[k] !== "ON") continue;
		const code = canonical(codes[at[k]]);
		const close = opening.get(code);
		if (close !== undefined) {
			if (stack.length === 63) break;
			stack.push([canonical(close), k]);
			continue;
		}
		if (!closing.has(code)) continue;
		for (let s = stack.length - 1; s >= 0; s--)
			if (stack[s][0] === code) {
				found.push([stack[s][1], k]);
				stack.length = s;
				break;
			}
	}
	found.sort((a, b) => a[0] - b[0]);
	for (const [open, close] of found) {
		let inside = "";
		for (let k = open + 1; k < close; k++) {
			const s = strong(t[k]);
			if (s === "L") {
				inside = "L";
				break;
			}
			if (s) inside = s;
		}
		if (!inside) continue;
		let set: Kind = "L";
		if (inside === "R") {
			let before = "L";
			for (let k = open - 1; k >= 0; k--) {
				const s = strong(t[k]);
				if (s) {
					before = s;
					break;
				}
			}
			set = before === "R" ? "R" : "L";
		}
		for (const k of [open, close]) {
			t[k] = set;
			for (let j = k + 1; j < n && original[at[j]] === "NSM"; j++) t[j] = set;
		}
	}
	for (let k = 0; k < n; ) {
		if (strong(t[k]) || t[k] === "EN" || t[k] === "AN") {
			k++;
			continue;
		}
		let end = k;
		while (end < n && !strong(t[end])) end++;
		const before = k > 0 ? strong(t[k - 1]) : "L";
		const after = end < n ? strong(t[end]) : "L";
		const set: Kind = before === after ? (before as Kind) : "L";
		for (let j = k; j < end; j++) t[j] = set;
		k = end;
	}
	for (let k = 0; k < n; k++)
		out[at[k]] = t[k] === "R" ? 1 : t[k] === "AN" || t[k] === "EN" ? 2 : 0;
	for (let i = 0; i < codes.length; i++)
		if (original[i] === "BN") out[i] = i > 0 ? out[i - 1] : 0;
	for (let i = codes.length - 1; i >= 0; i--) {
		const k = original[i];
		if (k !== "WS" && k !== "BN" && k !== "S" && k !== "B") break;
		out[i] = 0;
	}
	return out;
};

export const order = (levels: number[]) => {
	const out = levels.map((_, k) => k);
	const top = Math.max(0, ...levels);
	const odd = levels.reduce(
		(a, l) => (l % 2 ? Math.min(a, l) : a),
		Number.POSITIVE_INFINITY,
	);
	for (let level = top; level >= odd; level--)
		for (let k = 0; k < out.length; ) {
			if (levels[out[k]] < level) {
				k++;
				continue;
			}
			let end = k;
			while (end < out.length && levels[out[end]] >= level) end++;
			out.splice(k, end - k, ...out.slice(k, end).reverse());
			k = end;
		}
	return out;
};
