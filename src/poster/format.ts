import { names } from "./names";

const two = new Intl.NumberFormat("en-GB", {
	minimumFractionDigits: 2,
	maximumFractionDigits: 2,
});
const integer = new Intl.NumberFormat("en-GB", { maximumFractionDigits: 0 });

export const minus = "−";
export const figure = " ";

export const cents = (micro: number) => Math.round((100 * micro) / 1e6);
export const fixed = (micro: number) => two.format(cents(micro) / 100);
export const hundredths = (c: number) => two.format(c / 100);
export const signed = (micro: number) => {
	const text = two.format(cents(Math.abs(micro)) / 100);
	return micro > 0
		? `+${text}`
		: micro < 0
			? `${minus}${text}`
			: `${figure}${text}`;
};
export const whole = (n: number) => integer.format(n);
export const percent = (x: number) =>
	`${two.format(Math.round(x * 1e4) / 100)}%`;
export const papers = (micro: number) => micro / 1e6;

export const nation = (code: string) =>
	code ? (names[code] ?? code) : "No country";

export const plural = (n: number, one: string, many: string) =>
	`${whole(n)} ${n === 1 ? one : many}`;

export const list = (items: string[]) =>
	new Intl.ListFormat("en-GB", { type: "conjunction" }).format(items);

export const tick = (value: number) => {
	if (value === 0) return "0";
	const sign = value > 0 ? "+" : minus;
	const a = Math.abs(value);
	const text =
		a >= 1
			? integer.format(a)
			: a.toFixed(Math.max(0, -Math.floor(Math.log10(a) + 1e-9)));
	return `${sign}${text}`;
};

export const decade = (value: number) =>
	value >= 1
		? integer.format(value)
		: value.toFixed(Math.max(0, -Math.floor(Math.log10(value) + 1e-9)));

export const scale = [
	8, 10, 12, 14, 16, 20, 24, 28, 32, 40, 48, 56, 64, 80, 96, 112, 128, 160, 192,
	224, 256, 320, 384,
];

export const snap = (size: number) => {
	let out = scale[0];
	for (const s of scale) if (s <= size + 1e-6) out = s;
	return out;
};

export const clean = (name: string) => name.replace(/&amp;?/g, "&");

export const venueName = (name: string) =>
	clean(name).replace(/\b([A-Z][a-z]+) s (?=\S)/g, "$1's ");

const minor = new Set([
	"a",
	"an",
	"and",
	"at",
	"for",
	"in",
	"of",
	"on",
	"or",
	"the",
	"to",
]);

export const titled = (name: string) =>
	name === name.toLowerCase()
		? name
				.split(" ")
				.map((w, k) =>
					k && minor.has(w) ? w : w.charAt(0).toUpperCase() + w.slice(1),
				)
				.join(" ")
		: name;
