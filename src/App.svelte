<script lang="ts">
	import { tick, untrack } from "svelte";
	import {
		api,
		bundle,
		count,
		drop,
		ends,
		forget,
		type Group,
		groups,
		having,
		expect,
		hundredths,
		leaves,
		type Meta,
		micro,
		type Node,
		type People,
		read as part,
		retry,
		shelve,
		slot,
		stalls,
		starts,
		swaps,
		tally,
		topics,
		whole as every,
	} from "./data";
	import { continents } from "./continents";
	import { words } from "./about/words";
	import { country, flag } from "./flags";
	import {
		about as described,
		apply,
		plain,
		save,
		type Ssr,
		view as viewed,
	} from "./page";
	import {
		years as bounds,
		means,
		type Mean,
		read as decode,
		selection,
		sorts,
		type State,
		type Tab,
		tiers,
		url as encode,
		where,
	} from "./state";
	import * as tables from "./tables";
	import Panel, {
		badge,
		more,
		rooted,
		type Tree,
		type Twig,
		whole,
	} from "./Panel.svelte";

	let {
		meta,
		empty = new Set(),
		ssr,
		onready,
		onfail,
	}: {
		meta: Meta;
		empty?: Set<number>;
		ssr?: Ssr;
		onready?: () => void;
		onfail?: () => void;
	} = $props();

	const { nodes, institutions, venues } = $derived(meta);
	const tabs = [
		["institutions", "Institutions"],
		["venues", "Venues"],
		["about", "About"],
	] as const;

	const fit = (k: number) => 2 ** Math.max(6, Math.ceil(Math.log2(k + 1)));

	const lands = $derived(tables.lands(meta));

	const read = (
		at: { pathname: string; search: string } = ssr
			? { pathname: ssr.path, search: "" }
			: location,
	) => decode(at, nodes, lands);

	const url = (state: State) => encode(state, lands);

	const first = read();

	let s = $state(first);

	let placed = where(first);

	$effect(() => {
		const next = url(s);
		const path = where(s);
		if (next !== location.pathname + location.search)
			history[path === placed ? "replaceState" : "pushState"](null, "", next);
		placed = path;
	});

	const rescope = (view: number, off: number[]) => {
		let at = nodes.get(view) as Node;
		while (empty.has(at.id) && at.parent) at = at.parent;
		s = { ...s, view: at.id, flip: [], off };
	};

	const flipped = <T,>(keys: T[], key: T) =>
		keys.includes(key) ? keys.filter((k) => k !== key) : [...keys, key];

	const node = $derived(nodes.get(s.view) as Node);
	const years = $derived(tables.span(s.from, s.to));
	const base = $derived(`views/${node.level}/${node.id}`);
	const range = $derived(`${s.from}-${s.to}`);
	const chosen = $derived(new Set(s.tiers));
	const flips = $derived(new Set(s.flip));
	const off = $derived(new Set(s.off));
	const under = $derived(topics(node, s.off));
	const at = $derived(new Set(s.at));
	const above = $derived(new Set(s.above));
	const place = $derived(new Map(institutions.id.map((id, k) => [id, k])));
	const open = $derived(s.inst === undefined ? -1 : (place.get(s.inst) ?? -1));
	const seat = $derived(
		s.venue === undefined ? -1 : venues.id.indexOf(s.venue),
	);
	const nested = $derived(
		s.firm === undefined ? -1 : (place.get(s.firm) ?? -1),
	);
	const host = $derived(
		s.tab === "institutions"
			? open
			: s.tab === "venues" && seat >= 0
				? nested
				: -1,
	);
	const land = $derived(tables.lander(at, lands));
	const picked = $derived(tables.picker(chosen, flips, venues.id));
	const all = $derived(every(node, off));

	let got = $derived.by(() => {
		void base;
		return new Map<string, unknown>();
	});

	$effect(() => forget(base));

	let failed = $state.raw(new Set<string>());
	const flying = new Set<string>();
	let kept = new Set<string>();

	const stale = (key: string) => {
		const file = key.match(/^(?:venue|institution)\/\d+\./)?.[0];
		return file !== undefined && !kept.has(file);
	};

	const take = <T,>(key: string, make: () => Promise<T>) => {
		if (got.has(key)) return got.get(key) as T;
		if (ssr) {
			if (ssr.got.has(key)) return ssr.got.get(key) as T;
			if (!ssr.wait.has(key)) ssr.wait.set(key, make());
			return;
		}
		const view = base;
		const flight = `${view} ${key}`;
		if (failed.has(key) || flying.has(flight)) return;
		flying.add(flight);
		retry(make).then(
			(value) => {
				flying.delete(flight);
				if (view === base && !got.has(key) && !stale(key))
					got = new Map(got).set(key, value);
			},
			(error) => {
				flying.delete(flight);
				console.error(error);
				failed = new Set(failed).add(key);
			},
		);
	};

	$effect(() => {
		void url(s);
		untrack(() => {
			if (failed.size) failed = new Set();
		});
	});

	const broken = $derived(failed.size > 0);

	const cells = $derived(
		take(`${base}/venues ${range}`, () => stalls(node, years, true)),
	);
	const sliced = $derived(`${base}/venues ${range} split`);
	const parted = () => take(sliced, () => stalls(node, years, false));
	const wares = $derived(
		!node.children.length || all
			? cells
			: node.children.every((child) => off.has(child.id))
				? []
				: parted(),
	);
	const marks = $derived(
		s.tab !== "venues"
			? undefined
			: !node.children.length || all
				? take(`${base}/countries ${range}`, () =>
						stalls(node, years, true, ["countries"]),
					)
				: node.children.every((child) => off.has(child.id))
					? []
					: take(`${base}/countries ${range} split`, () =>
							stalls(node, years, false, ["countries"]),
						),
	);
	const counts = $derived(
		take(`${base}/counts ${range} ${s.tiers} ${all}`, () =>
			ends(node, "counts", "n", [s.from, s.to], all, { tier: [...s.tiers] }),
		),
	);
	const faculty = $derived(
		take(`${base}/faculty ${range} ${all}`, () =>
			ends(node, "faculty", "f", [s.from, s.to], all),
		),
	);

	let shelved: Group[] = [];

	const shelf = $derived.by(() => {
		shelved = cells ?? shelved;
		return shelve(cells ?? (broken ? [] : shelved), venues.id);
	});

	const bundles = $derived(
		(cells ? swaps(shelf, flips, chosen, years) : []).map(
			({ key, sign, read }) => ({
				sign,
				files: take(`${key} ${range}`, read),
			}),
		),
	);

	const scores = $derived(
		s.tab === "venues"
			? take(`scores ${s.to}`, () =>
					groups("scores.parquet", having({ year: [s.to] })),
				)
			: undefined,
	);

	const ready = $derived(
		[cells, counts, faculty].every(Boolean) &&
			bundles.every((b) => b.files) &&
			(s.tab !== "venues" || Boolean(wares && marks && scores)),
	);

	const mean = <T,>(rows: T[], value: (row: T) => number) =>
		rows.reduce((sum, row) => sum + value(row), 0) / rows.length;

	const sums = $derived(
		ready
			? count(
					counts ?? [[], []],
					bundles.map(({ sign, files }) => ({ sign, files: files ?? [] })),
					under,
					off,
					institutions.id.length,
				)
			: undefined,
	);

	const listed = $derived.by(() => {
		if (!sums) return undefined;
		const people = tally(faculty ?? [[], []], institutions.id.length, "f", off);
		const expected = expect(sums, people);
		return tables.listing(meta, sums, people, expected, years.length, land);
	});

	let last: tables.Row[] = [];

	const table = $derived.by(() => {
		const rows = listed;
		if (!rows) return broken ? [] : last;
		const floors = (["count", "authors"] as const)
			.filter((key) => above.has(key))
			.map((key) => [key, mean(rows, (row) => row[key])] as const);
		last = tables.rank(
			rows
				.filter((row) => floors.every(([key, m]) => row[key] > m))
				.map((row) => ({ ...row })),
			(row) => row[s.sort],
			(a, b) => tables.collate(a.name, b.name),
		);
		return last;
	});

	const counted = (v: number, year: number) => {
		const t = shelf.tier.get(slot(v, year));
		return t !== undefined && picked(t, v);
	};

	const sought = $derived.by(() => {
		const out = new Map<number, number[]>();
		for (const [key, t] of shelf.tier) {
			const v = Math.floor(key / 4096);
			const year = key % 4096;
			if (!picked(t, v)) continue;
			const list = out.get(year) ?? [];
			list.push(v);
			out.set(year, list);
		}
		for (const list of out.values()) list.sort((a, b) => a - b);
		return out;
	});

	const bound = (list: number[], value: number) => {
		let lo = 0;
		let hi = list.length;
		while (lo < hi) {
			const mid = (lo + hi) >> 1;
			if (list[mid] < value) lo = mid + 1;
			else hi = mid;
		}
		return lo;
	};

	const holds = (list: number[] | undefined, [low, high]: number[]) => {
		if (!list) return false;
		const lo = bound(list, low);
		return lo < list.length && list[lo] <= high;
	};

	const stays = $derived(
		seat < 0 ? [] : years.filter((year) => counted(seat, year)),
	);
	const inside = $derived(s.tab === "venues" ? seat : -1);

	const crew = $derived.by(() => {
		if (host < 0 || !cells) return undefined;
		const want =
			inside < 0 ? sought : new Map(stays.map((year) => [year, [inside]]));
		return take(
			`institution/${host}. ${base} ${range} ${s.tiers} ${s.flip} ${inside}`,
			() =>
				groups(`institution/${host}.parquet`, (stat) =>
					holds(want.get(stat("year")[0]), stat("v")),
				),
		);
	});
	const roll = $derived(`institution/${host}.people.parquet`);
	const roster = $derived(
		host < 0
			? undefined
			: take(`institution/${host}. roster`, () => starts(roll)),
	);

	const team = $derived.by(() => {
		if (!crew || !roster) return [];
		return tables.team(crew, under, counted, inside, roster[roster.length - 1]);
	});

	let crowd = $derived.by(() => {
		void team;
		return 64;
	});

	const edge = $derived.by(() => {
		let k = Math.min(crowd, team.length);
		while (k && k < team.length && team[k].n === team[k - 1].n) k++;
		return k;
	});

	const folk = $derived.by(() => {
		const names = new Map<number, [number, string]>();
		if (!roster) return names;
		const need = new Set<number>();
		for (const { a } of team.slice(0, edge)) {
			let k = 0;
			while (roster[k + 1] <= a) k++;
			need.add(k);
		}
		for (const k of need) {
			const got = take(`institution/${host}. people ${k}`, () =>
				part<People>(roll, k, ["a", "name"]),
			);
			got?.a.forEach((id, j) => {
				names.set(roster[k] + j, [id, got.name[j]]);
			});
		}
		return names;
	});

	const known = $derived.by(() => {
		let n = 0;
		for (let k = 0; k < edge && folk.has(team[k].a); k++)
			if (k + 1 === edge || team[k + 1].n !== team[k].n) n = k + 1;
		return n;
	});

	const named = (a: number) => folk.get(a)?.[1] ?? "";

	const staff = $derived(
		team
			.slice(0, known)
			.sort((a, b) => b.n - a.n || tables.collate(named(a.a), named(b.a)))
			.slice(0, crowd),
	);

	const pick = $derived(
		s.author === undefined
			? -1
			: staff.findIndex((row) => folk.get(row.a)?.[0] === s.author),
	);

	const paths = $derived.by(() => {
		if (pick < 0 || inside >= 0 || !crew) return [];
		return tables.paths(meta, crew, under, counted, staff[pick].a);
	});

	let reach = $derived.by(() => {
		void paths;
		return 64;
	});

	const index = $derived.by(() => {
		if (host < 0 || s.author === undefined) return undefined;
		const files = take(`institution/${host}. ids`, () =>
			groups<{ a: number[] }>(roll, () => true, ["a"]),
		);
		if (!files) return undefined;
		let at = 0;
		for (const { a } of files) {
			const k = a.indexOf(s.author);
			if (k >= 0) return at + k;
			at += a.length;
		}
		return -1;
	});

	$effect(() => {
		if (s.tab !== "institutions" || s.author === undefined) return;
		const wait = !crew || !roster || known < edge;
		if (open >= 0 && (wait || pick >= 0)) return;
		if (open >= 0 && index === undefined) return;
		const k = open < 0 ? -1 : team.findIndex((row) => row.a === index);
		if (k < 0) {
			s.author = undefined;
			crowd = 64;
			return;
		}
		let g = k;
		while (g && team[g - 1].n === team[k].n) g--;
		crowd = Math.max(crowd * 2, fit(g));
	});

	const score = (v: number) => {
		for (const group of scores ?? []) {
			const k = bound(group.v, v);
			if (group.v[k] === v) return group.score[k];
		}
	};

	const four = (n?: number) =>
		n === undefined
			? ""
			: `${Math.floor(n / 1e4)}.${`${n % 1e4}`.padStart(4, "0")}`;

	let stocked: tables.Stock[] = [];

	const stock = $derived.by(() => {
		if (!wares || !marks) return broken ? [] : stocked;
		if (!scores && broken) return [];
		const listed = tables.stock(wares, marks, off, years, picked, land, score);
		const floor = above.has("venues")
			? mean(listed, (row) => row.n)
			: Number.NEGATIVE_INFINITY;
		stocked = tables.rank(
			listed.filter((row) => row.n > floor),
			s.by === "score"
				? (row) => row.score ?? Number.NEGATIVE_INFINITY
				: (row) => row.n,
			(a, b) => tables.collate(venues.name[a.v], venues.name[b.v]),
		);
		return stocked;
	});

	const yields = $derived.by(() => {
		if (seat < 0 || !cells) return undefined;
		return take(`venue/${seat}. ${stays}`, () => bundle(seat, stays));
	});

	const firms = $derived.by(() => {
		if (!yields) return [];
		return tables.firms(meta, yields, under, off, land);
	});

	let throng = $derived.by(() => {
		void firms;
		return 64;
	});

	$effect(() => {
		if (s.tab !== "venues" || s.firm === undefined) return;
		if (seat >= 0 && !yields) return;
		const k = firms.findIndex((row) => row.i === nested);
		if (k < 0) s.firm = undefined;
		else untrack(() => (throng = Math.max(throng, fit(k))));
	});

	const busy = $derived(
		!broken &&
			(!ready ||
				(host >= 0 && (!crew || !roster || known < edge)) ||
				(s.tab === "venues"
					? seat >= 0 && !yields
					: s.author !== undefined && pick < 0)),
	);

	const used = $derived.by(() => {
		const files = new Set<string>();
		for (const key of flips) {
			const cell = shelf.mass.get(key);
			if (cell) files.add(`venue/${cell[1]}.`);
		}
		if (seat >= 0) files.add(`venue/${seat}.`);
		for (const i of [open, nested]) if (i >= 0) files.add(`institution/${i}.`);
		return files;
	});

	$effect(() => {
		const files = used;
		if (host < 0) void staff;
		if (seat < 0) void firms;
		untrack(() => {
			const gone = [...kept].filter((file) => !files.has(file));
			kept = files;
			if (!gone.length) return;
			for (const file of gone) drop(file);
			got = new Map(
				[...got].filter(([key]) => !gone.some((file) => key.startsWith(file))),
			);
		});
	});

	const mark = (t: number) => {
		const all = shelf.listings[t - 1];
		const on = all.filter((l) => picked(t, l.v)).length;
		if (!all.length) return chosen.has(t) ? 2 : 0;
		return on === all.length ? 2 : on ? 1 : 0;
	};

	const tier = (t: number) => {
		const on = mark(t) !== 2;
		s.tiers = tiers.filter((x) => (x === t ? on : s.tiers.includes(x)));
		s.flip = s.flip.filter((key) => !key.startsWith(`${t}.`));
	};

	const sow = (twig: Twig) => (off.has(twig.id as number) ? 0 : 2);
	const sown = $derived(whole(node.children.map(sow)));

	const ids = (twigs: Twig[]) =>
		twigs.map((twig) => twig.id as number).sort((a, b) => a - b);

	const areas: Tree = $derived({
		name: "Areas",
		root: nodes.get(0) as Node,
		scope: node,
		href: (twig) => url({ ...s, view: twig.id as number, flip: [], off: [] }),
		mark: (twig) =>
			twig === node ? sown : twig.parent === node ? sow(twig) : 0,
		flip: (twig, listed) => {
			const parent = twig.parent as Twig;
			if (twig === node) s.off = sown === 2 ? ids(node.children) : [];
			else if (listed && parent === node)
				s.off = flipped(s.off, twig.id as number).sort((a, b) => a - b);
			else if (listed)
				rescope(
					parent.id as number,
					ids(parent.children.filter((c) => c !== twig)),
				);
			else rescope(twig.id as number, []);
		},
		share: (twig, near) => {
			const parent = twig.parent as Node | undefined;
			if (!parent) return undefined;
			if (parent !== node) return portion(parent, twig.id as number, near);
			if (!near && !got.has(sliced)) return undefined;
			return own?.sum
				? (own.parts.get(twig.id as number) ?? 0) / own.sum
				: undefined;
		},
	});

	type Portion = { parts: Map<number, number[]>; sum: number[] };

	let portions = $state.raw(new Map<string, Portion>());
	const asked = new Set<string>();

	let worker: Worker | undefined;

	const spawn = () => {
		const next = new Worker(new URL("./portion.ts", import.meta.url), {
			type: "module",
		});
		next.onmessage = ({ data: { key, parts, sum } }) => {
			if (parts) portions = new Map(portions).set(key, { parts, sum });
			else asked.delete(key);
		};
		return next;
	};

	const ask = (parent: Node, key: string, span: number[]) => {
		if (ssr || asked.has(key)) return;
		asked.add(key);
		worker ??= spawn();
		worker.postMessage({
			key,
			level: parent.level,
			id: parent.id,
			span: [...span],
		});
	};

	const portion = (parent: Node, child: number, near: boolean) => {
		const key = `${parent.id} ${range}`;
		const hit = portions.get(key);
		if (!hit) {
			if (near) ask(parent, key, years);
			return undefined;
		}
		let part = 0;
		let sum = 0;
		for (const t of s.tiers) {
			part += hit.parts.get(child)?.[t] ?? 0;
			sum += hit.sum[t];
		}
		return sum ? part / sum : undefined;
	};

	const own = $derived.by(() => {
		const files = node.children.length ? parted() : undefined;
		if (!files) return undefined;
		const parts = new Map<number, number>();
		let sum = 0;
		for (const { child, v, tier: t, mass } of files)
			for (let r = 0; r < v.length; r++) {
				if (!picked(t[r], v[r])) continue;
				parts.set(child[r], (parts.get(child[r]) ?? 0) + mass[r]);
				sum += mass[r];
			}
		return { parts, sum };
	});

	let heaped = { by: new Map<number, number>(), sum: [0, 0, 0, 0, 0] };

	const heaps = $derived.by(() => {
		if (!wares)
			return broken
				? { by: new Map<number, number>(), sum: [0, 0, 0, 0, 0] }
				: heaped;
		const by = new Map<number, number>();
		const sum = [0, 0, 0, 0, 0];
		for (const { child, v, tier: t, mass } of wares)
			for (let r = 0; r < v.length; r++) {
				if (child && off.has(child[r])) continue;
				const key = v[r] * 8 + t[r];
				by.set(key, (by.get(key) ?? 0) + mass[r]);
				sum[t[r]] += mass[r];
			}
		heaped = { by, sum };
		return heaped;
	});

	const shelves: Tree = $derived({
		name: "Venues",
		root: rooted({
			id: 0,
			name: "All",
			children: tiers.map((t) => ({
				id: t,
				name: `T${t}`,
				children: shelf.listings[t - 1].map((l) => ({
					id: l.key,
					name: venues.name[l.v],
					code: venues.country[l.v],
					children: [],
				})),
			})),
		}),
		mark: (twig) => {
			if (twig.id === 0) return whole(tiers.map(mark));
			if (typeof twig.id === "number") return mark(twig.id);
			const [t, v] = shelf.mass.get(twig.id) as number[];
			return picked(t, v) ? 2 : 0;
		},
		flip: (twig) => {
			if (typeof twig.id === "string") s.flip = flipped(s.flip, twig.id);
			else if (twig.id) tier(twig.id);
			else {
				s.tiers = whole(tiers.map(mark)) === 2 ? [] : tiers;
				s.flip = [];
			}
		},
		share: (twig) => {
			if (!twig.parent) return undefined;
			const { by, sum } = heaps;
			if (typeof twig.id === "number") {
				const total = sum.reduce((a, b) => a + b, 0);
				return total ? sum[twig.id] / total : undefined;
			}
			const [t, v] = shelf.mass.get(twig.id) as number[];
			return sum[t] ? (by.get(v * 8 + t) ?? 0) / sum[t] : undefined;
		},
		tag: (twig) => (twig.parent?.parent ? twig.parent.name : undefined),
	});

	let weighed = { by: new Map<string, number>(), sum: 0 };

	const weights = $derived.by(() => {
		if (!sums)
			return broken ? { by: new Map<string, number>(), sum: 0 } : weighed;
		weighed = tables.shares(meta, sums);
		return weighed;
	});

	const held = (twig: Twig) =>
		whole(leaves(twig).map((l) => (at.has(l.id as string) ? 2 : 0)));

	const nations: Tree = $derived({
		name: "Countries",
		root: rooted({
			id: 0,
			name: "All",
			children: continents
				.map(([name, codes]) => ({
					id: name,
					name,
					children: codes
						.split(" ")
						.filter((code) => lands.includes(code))
						.map((code) => ({
							id: code,
							name: country(code),
							code,
							children: [] as Twig[],
						}))
						.sort((a, b) => tables.collate(a.name, b.name)),
				}))
				.filter((continent) => continent.children.length),
		}),
		mark: held,
		flip: (twig) => {
			const on = held(twig) !== 2;
			const codes = new Set(leaves(twig).map((l) => l.id));
			s.at = lands.filter((code) => (codes.has(code) ? on : at.has(code)));
		},
		share: (twig) => {
			const { by, sum } = weights;
			if (!twig.parent || !sum) return undefined;
			let n = 0;
			for (const leaf of leaves(twig)) n += by.get(leaf.id as string) ?? 0;
			return n / sum;
		},
	});

	const size = $derived(s.tab === "institutions" ? table.length : stock.length);

	let shown = $derived.by(() => {
		void base;
		void s.tab;
		return ssr?.rows ?? 64;
	});

	const wide = (v: number) =>
		(v < 9.995 ? 1 : Math.floor(Math.log10(v + 0.005)) + 1) + 2.5;

	const widths = $derived.by(() => {
		let [count, authors, ratio, high, low] = [0, 0, 0, 0, 0];
		for (const row of table) {
			count = Math.max(count, row.count);
			authors = Math.max(authors, row.authors);
			ratio = Math.max(ratio, row.ratio);
			high = Math.max(high, row.excess);
			low = Math.min(low, row.excess);
		}
		return [
			wide(count / 1e6),
			wide(authors / 1e6),
			wide(ratio),
			Math.max(wide(high / 1e6), wide(-low / 1e6)) + 1.13,
		].map((w) => `${w}ch`);
	});

	const signed = (n: number) => {
		const text = micro(Math.abs(n));
		if (n > 0) return `+${text}`;
		return n < 0 ? `\u2212${text}` : `\u2007${text}`;
	};

	const ratio = (row: tables.Row) =>
		row.people ? hundredths(row.count * years.length, row.people) : "0.00";

	const voice = (rank: number, name: string, figures: [string, string][]) =>
		ssr
			? undefined
			: [
					`${rank} ${name}`,
					...figures.filter(([, value]) => value).map((pair) => pair.join(" ")),
				].join(", ");

	const said = (row: tables.Row) =>
		voice(row.rank, row.name, [
			["Count", micro(row.count)],
			["Authors", micro(row.authors)],
			["Per author", row.authors ? ratio(row) : ""],
			["Excess", signed(row.excess)],
		]);

	const told = (row: tables.Stock) =>
		voice(row.rank, venues.name[row.v], [
			["Tier", row.tiers.join(" ").trim()],
			["Score", four(row.score)],
			["Count", micro(row.n)],
		]);

	const backs: Partial<Record<Tab, number>> = {};

	const fold = async (event: MouseEvent, change: () => void) => {
		const row = event.currentTarget as HTMLElement;
		const shut = row.classList.contains("open");
		const top = row.getBoundingClientRect().top;
		const tab = s.tab;
		change();
		await tick();
		const back = backs[tab];
		if (shut) {
			if (back !== undefined) scrollTo(0, back);
			backs[tab] = undefined;
			return;
		}
		const group = document.querySelector("main .group") as HTMLElement;
		scrollBy(0, group.getBoundingClientRect().top - top);
		backs[tab] = scrollY;
	};

	const expand = (event: MouseEvent, i: number) =>
		fold(event, () => {
			const id = institutions.id[i];
			s.inst = s.inst === id ? undefined : id;
			s.author = undefined;
		});

	const unfold = (event: MouseEvent, v: number) =>
		fold(event, () => {
			const id = venues.id[v];
			s.venue = s.venue === id ? undefined : id;
			s.firm = undefined;
		});

	const nest = async (event: MouseEvent, change: () => void) => {
		const row = (event.currentTarget as HTMLElement).closest(".row");
		change();
		await tick();
		const stuck = document.querySelector("main .open");
		if (!row || !stuck) return;
		const top = row.getBoundingClientRect().top;
		const floor = stuck.getBoundingClientRect().bottom;
		if (top < floor) scrollBy(0, top - floor);
	};

	type Move = "arrive" | "scope" | "sift";

	let follow = $state<Move | undefined>(
		(
			first.tab === "institutions"
				? first.inst !== undefined
				: first.tab === "venues" && first.venue !== undefined
		)
			? "arrive"
			: undefined,
	);

	let landing = $state(false);

	const sift = $derived(
		JSON.stringify([
			s.from,
			s.to,
			s.tiers,
			s.flip,
			s.off,
			s.at,
			s.above,
			s.sort,
			s.by,
		]),
	);

	let scope: number | undefined;
	let sifted: string | undefined;

	$effect(() => {
		const view = s.view;
		const now = sift;
		const move: Move | undefined =
			scope === undefined
				? undefined
				: view !== scope
					? "scope"
					: now !== sifted
						? "sift"
						: undefined;
		[scope, sifted] = [view, now];
		if (!move) return;
		untrack(() => {
			backs.institutions = undefined;
			backs.venues = undefined;
			const held = s.tab === "institutions" ? s.inst : s.venue;
			if (held !== undefined) follow = move;
			else if (move === "scope") scrollTo(0, 0);
		});
	});

	$effect(() => {
		if (!follow || !ready) return;
		const move = follow;
		follow = undefined;
		const k =
			s.tab === "institutions"
				? table.findIndex((row) => row.i === open)
				: stock.findIndex((row) => row.v === seat);
		if (k < 0) {
			if (s.tab === "institutions") s.inst = undefined;
			else s.venue = undefined;
			if (move === "scope") scrollTo(0, 0);
			return;
		}
		shown = Math.max(shown, fit(k));
		landing = true;
	});

	$effect(() => {
		if (!landing || busy) return;
		landing = false;
		tick().then(async () => {
			await document.fonts.ready;
			const group = document.querySelector("main .group");
			const row = group?.querySelector(".open");
			if (!group || !row) return;
			const top = Number.parseFloat(getComputedStyle(row).top);
			scrollTo(0, scrollY + group.getBoundingClientRect().top - top);
			const lit = group.querySelector(".lit");
			if (lit)
				scrollBy(
					0,
					lit.getBoundingClientRect().top - row.getBoundingClientRect().bottom,
				);
		});
	});

	const lazy = $derived(
		s.tab === "about"
			? take("about", () => import("./about/About.svelte"))
			: undefined,
	);

	const page = $derived.by(() => {
		if (s.tab === "about")
			return lazy && described(s.lang, lazy.built[s.lang].paper);
		const rows = ready ? 32 : 0;
		return viewed(
			s.tab,
			node,
			s.from,
			s.to,
			s.tiers,
			s.tab === "institutions"
				? table.slice(0, rows).map((row) => [row.rank, row.name])
				: stock.slice(0, rows).map((row) => [row.rank, venues.name[row.v]]),
			where(s),
		);
	});

	untrack(() => {
		if (ssr) ssr.head = () => page;
	});

	$effect(() => {
		if (page) apply(page);
	});

	$effect(() => {
		if (broken) onfail?.();
		else if (s.tab === "about" ? lazy : ready) onready?.();
	});

	const csv = () => {
		const cell = (value: string | number) =>
			/[",\n]/.test(`${value}`) ? `"${`${value}`.replace(/"/g, '""')}"` : value;
		const lines =
			s.tab === "institutions"
				? [
						[
							"Rank",
							"Institution",
							"Country",
							"Count",
							"Authors",
							"Per author",
							"Excess",
						],
						...table.map((row) => [
							row.rank,
							row.name,
							institutions.country[row.i],
							micro(row.count),
							micro(row.authors),
							ratio(row),
							micro(row.excess),
						]),
					]
				: [
						["Rank", "Venue", "Country", ...years, "Score", "Count"],
						...stock.map((row) => [
							row.rank,
							venues.name[row.v],
							venues.country[row.v],
							...row.tiers,
							four(row.score),
							micro(row.n),
						]),
					];
		save(
			new Blob(
				[`\ufeff${lines.map((line) => line.map(cell).join(",")).join("\n")}\n`],
				{ type: "text/csv" },
			),
			`allrankings-${node.level}-${node.id}-${s.tab}-${range}.csv`,
		);
	};

	let making = $state(false);

	const blank = $derived(ready && !table.length);

	const poster = async () => {
		if (making || blank) return;
		making = true;
		try {
			const { make } = await import("./poster/make");
			await make(selection(s), api, flag, save);
		} catch (error) {
			console.error(error);
		}
		making = false;
	};
</script>

<svelte:window
	onpopstate={() => {
		s = read();
		placed = where(s);
	}}
/>

{#snippet tab(key: Tab, label: string)}
	<a
		class:on={s.tab === key}
		href={url({ ...s, tab: key })}
		aria-current={s.tab === key ? "page" : undefined}
		onclick={(event) => {
			if (!plain(event)) return;
			event.preventDefault();
			s.tab = key;
		}}>{label}</a
	>
{/snippet}

{#snippet icon(d: string)}
	<svg viewBox="0 0 16 16" aria-hidden="true"
		><path fill="none" stroke="currentColor" stroke-width="1.5" {d} /></svg
	>
{/snippet}

{#snippet name(code: string, text: string)}
	<span class="name">{@render badge(code)}{text}</span>
{/snippet}

{#snippet floor(key: Mean, title: string)}
	<input
		class="box"
		type="checkbox"
		{title}
		aria-label={title}
		checked={above.has(key)}
		onchange={() =>
			(s.above = means.filter((k) =>
				k === key ? !above.has(k) : above.has(k),
			))}
	/>
{/snippet}

{#snippet order(
	on: boolean,
	label: string,
	pick: () => void,
	key?: Mean,
	title = "",
)}
	<span class="sort"
		><span
			>{#if key}{@render floor(key, title)}{/if}<button
				class:on
				aria-pressed={on}
				onclick={pick}>{label}</button
			></span
		></span
	>
{/snippet}

{#snippet venue(row: tables.Stock)}
	<span class="rank">{row.rank}</span>
	<span class="entry">
		{@render name(venues.country[row.v], venues.name[row.v])}
		<span class="figures">
			<span class="strip">
				{#each row.tiers as t, y (y)}
					<span>{t || "\u2007"}</span>
				{/each}
			</span>
			<span class="num">{four(row.score)}</span>
			<span class="num">{micro(row.n)}</span>
		</span>
	</span>
{/snippet}

{#snippet author(rank: number, id: number, label: string)}
	<span class="name"
		><span class="seq">{rank}</span><a
			class="flag out"
			href="https://openalex.org/A{id}"
			target="_blank"
			rel="noopener"
			title="OpenAlex"
			aria-label="OpenAlex"
			><svg viewBox="0 0 16 12" aria-hidden="true"
				><path
					fill="none"
					stroke="currentColor"
					stroke-width="1.25"
					d="M7.5 2.5h-4v8h8v-4M9.5 1.5h4v4M13.5 1.5l-6 6"
				/></svg
			></a
		>{label}</span
	>
{/snippet}

{#snippet line(row: tables.Row)}
	<span class="rank">{row.rank}</span>
	{@render name(institutions.country[row.i], row.name)}
	<span class="num">{micro(row.count)}</span>
	<span class="num">{micro(row.authors)}</span>
	<span class="num">{row.authors ? ratio(row) : ""}</span>
	<span class="num">{signed(row.excess)}</span>
{/snippet}

<header class="bar">
	<div class="side">
		<h1><a href="/institutions/">AllRankings</a></h1>
		{@render tab("about", "About")}
	</div>
	<div class="tools">
		<span class="tabs">
			{#each tabs.slice(0, 2) as [key, label] (key)}
				{@render tab(key, label)}
			{/each}
		</span>
		<span class="icons">
			{#if s.tab === "about"}
				<a
					href="{import.meta.env.BASE_URL}{words[s.lang].pdf}"
					download
					title="Download PDF"
					aria-label="Download PDF"
					>{@render icon("M8 1.5v9M4 7l4 4 4-4M2 14.5h12")}</a
				>
			{:else}
				<button
					aria-disabled={making || blank}
					aria-busy={making}
					title="Download poster"
					aria-label="Download poster"
					onclick={poster}
					>{@render icon(
						"M3.25 1.75h9.5v12.5h-9.5zM5.5 4.75h5M5.5 11.5l1.75-2 1.5 1.25 1.75-2.5",
					)}</button
				>
				<button
					disabled={!ready}
					title="Download CSV"
					aria-label="Download CSV"
					onclick={csv}
					>{@render icon(
						"M1.75 2.75h12.5v10.5H1.75zM1.75 6.25h12.5M1.75 9.75h12.5M6 2.75v10.5",
					)}</button
				>
			{/if}
			<a
				href="https://github.com/clareLab/scholar-ar"
				target="_blank"
				rel="noopener"
				title="GitHub"
				aria-label="GitHub"
				><svg viewBox="0 0 16 16" aria-hidden="true"
					><path
						fill="currentColor"
						d="M6.766 11.328c-2.063-.25-3.516-1.734-3.516-3.656 0-.781.281-1.625.75-2.188-.203-.515-.172-1.609.063-2.062.625-.078 1.468.25 1.968.703.594-.187 1.219-.281 1.985-.281.765 0 1.39.094 1.953.265.484-.437 1.344-.765 1.969-.687.218.422.25 1.515.046 2.047.5.593.766 1.39.766 2.203 0 1.922-1.453 3.375-3.547 3.64.531.344.89 1.094.89 1.954v1.625c0 .468.391.734.86.547C13.781 14.359 16 11.53 16 8.03 16 3.61 12.406 0 7.984 0 3.563 0 0 3.61 0 8.031a7.88 7.88 0 0 0 5.172 7.422c.422.156.828-.125.828-.547v-1.25c-.219.094-.5.156-.75.156-1.031 0-1.64-.562-2.078-1.609-.172-.422-.36-.672-.719-.719-.187-.015-.25-.093-.25-.187 0-.188.313-.328.625-.328.453 0 .844.281 1.25.86.313.452.64.655 1.031.655s.641-.14 1-.5c.266-.265.47-.5.657-.656"
					/></svg
				></a
			>
			<a
				class="home"
				href="https://clarelab.moe"
				target="_blank"
				rel="noopener"
				title="clareLab"
				aria-label="clareLab"
				><svg viewBox="5 1 22 30" aria-hidden="true"
					><path d="M16 1Q21 9 27 16Q21 23 16 31Q11 23 5 16Q11 9 16 1Z" /></svg
				></a
			>
		</span>
	</div>
</header>

{#if s.tab === "about"}
	{#if lazy}
		<lazy.default bind:lang={s.lang} />
	{/if}
{:else}
	<Panel trees={[areas, nations, shelves]}>
		{#snippet tail()}
			<span class="years">
				<select bind:value={s.from} aria-label="From">
					{#each tables.span(bounds[0], s.to) as year (year)}
						<option value={year}>{year}</option>
					{/each}
				</select>
				–
				<select bind:value={s.to} aria-label="To">
					{#each tables.span(s.from, bounds[1]) as year (year)}
						<option value={year}>{year}</option>
					{/each}
				</select>
			</span>
		{/snippet}
	</Panel>

	<main
		class={[s.tab, { busy }]}
		aria-busy={busy}
		style:--years={years.length}
		style:--digits={String(size).length}
		style:--w1={widths[0]}
		style:--w2={widths[1]}
		style:--w3={widths[2]}
		style:--w4={widths[3]}
	>
		<div class="row head">
			{#if s.tab === "institutions"}
				<span class="rank">#</span><span class="title">Institution</span>
				{#each sorts as [key, label] (key)}
					{@render order(
						s.sort === key,
						label,
						() => (s.sort = key),
						key === "count" || key === "authors" ? key : undefined,
						`Only institutions above the mean ${label}`,
					)}
				{/each}
			{:else}
				<span class="rank">#</span>
				<span class="entry">
					<span class="name title">Venue</span>
					<span class="figures">
						<span class="strip"><span class="num">Tier</span></span>
						{@render order(s.by === "score", "Score", () => (s.by = "score"))}
						{@render order(
							s.by === "count",
							"Count",
							() => (s.by = "count"),
							"venues",
							"Only venues above the mean Count",
						)}
					</span>
				</span>
			{/if}
		</div>
		{#if s.tab === "institutions"}
			{#each table.slice(0, shown) as row (row.i)}
				{#if row.i === open}
					<div class="group">
						<button
							class="row open"
							aria-expanded="true"
							aria-label={said(row)}
							onclick={(event) => expand(event, row.i)}
							>{@render line(row)}</button
						>
						{#each staff as person (person.a)}
							{@const [id, label] = folk.get(person.a) ?? [0, ""]}
							{@const lit = id === s.author}
							<div class={["row sub", { lit }]}>
								<span class="rank"></span>
								{@render author(person.rank, id, label)}
								<span class="num">{micro(person.n)}</span>
								<button
									class="hit"
									aria-expanded={lit}
									aria-label={label}
									onclick={(event) =>
										nest(event, () => (s.author = lit ? undefined : id))}
								></button>
							</div>
							{#if lit}
								{#each paths.slice(0, reach) as path (path.v)}
									<div class="row sub deep">
										<span class="rank"></span>
										<span class="name"
											><span class="seq">{path.rank}</span>{@render badge(
												venues.country[path.v],
											)}{venues.name[path.v]}</span
										>
										<span class="num">{micro(path.n)}</span>
									</div>
								{/each}
								{#if reach < paths.length}
									<div {@attach more(() => (reach *= 2))}></div>
								{/if}
							{/if}
						{/each}
						{#if known === edge && crowd < team.length}
							<div {@attach more(() => (crowd *= 2))}></div>
						{/if}
					</div>
				{:else}
					<button
						class="row"
						aria-expanded="false"
						aria-label={said(row)}
						onclick={(event) => expand(event, row.i)}
						>{@render line(row)}</button
					>
				{/if}
			{/each}
		{:else}
			{#each stock.slice(0, shown) as row (row.v)}
				{#if row.v === seat}
					<div class="group">
						<button
							class="row open"
							aria-expanded="true"
							aria-label={told(row)}
							onclick={(event) => unfold(event, row.v)}
							>{@render venue(row)}</button
						>
						{#each firms.slice(0, throng) as firm (firm.i)}
							{@const lit = firm.i === nested}
							<button
								class={["row sub", { lit }]}
								aria-expanded={lit}
								aria-label={voice(firm.rank, institutions.name[firm.i], [
									["Count", micro(firm.n)],
								])}
								onclick={(event) =>
									nest(
										event,
										() => (s.firm = lit ? undefined : institutions.id[firm.i]),
									)}
							>
								<span class="rank"></span>
								<span class="entry">
									<span class="name"
										><span class="seq">{firm.rank}</span>{@render badge(
											institutions.country[firm.i],
										)}{institutions.name[firm.i]}</span
									>
									<span class="figures">
										<span class="num">{micro(firm.n)}</span>
									</span>
								</span>
							</button>
							{#if lit}
								{#each staff as person (person.a)}
									{@const [id, label] = folk.get(person.a) ?? [0, ""]}
									<div class="row sub deep">
										<span class="rank"></span>
										<span class="entry">
											{@render author(person.rank, id, label)}
											<span class="figures">
												<span class="num">{micro(person.n)}</span>
											</span>
										</span>
									</div>
								{/each}
								{#if known === edge && crowd < team.length}
									<div {@attach more(() => (crowd *= 2))}></div>
								{/if}
							{/if}
						{/each}
						{#if throng < firms.length}
							<div {@attach more(() => (throng *= 2))}></div>
						{/if}
					</div>
				{:else}
					<button
						class="row"
						aria-expanded="false"
						aria-label={told(row)}
						onclick={(event) => unfold(event, row.v)}
						>{@render venue(row)}</button
					>
				{/if}
			{/each}
		{/if}
		{#if shown < size}
			<div {@attach more(() => (shown *= 2))}></div>
		{/if}
	</main>
{/if}
