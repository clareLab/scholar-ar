<script lang="ts">
	import { tick, untrack } from "svelte";
	import {
		count,
		credit,
		defaults,
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
		shelve,
		slot,
		stalls,
		starts,
		swaps,
		tally,
		topics,
		whole as every,
		years as bounds,
	} from "./data";
	import { continents } from "./continents";
	import { type Lang, langs, words } from "./about/words";
	import { country } from "./flags";
	import Panel, {
		badge,
		more,
		rooted,
		type Tree,
		type Twig,
		whole,
	} from "./Panel.svelte";

	let { meta }: { meta: Meta } = $props();

	const { nodes, institutions, venues } = $derived(meta);
	const tabs = [
		["institutions", "Institutions"],
		["venues", "Venues"],
		["about", "About"],
	] as const;
	const sorts = [
		["count", "Count"],
		["authors", "Authors"],
		["ratio", "Per author"],
		["excess", "Excess"],
	] as const;
	const tiers = [1, 2, 3, 4];
	const means = ["count", "authors", "venues"] as const;

	type Tab = (typeof tabs)[number][0];
	type Sort = (typeof sorts)[number][0];
	type Mean = (typeof means)[number];
	type State = {
		view: number;
		from: number;
		to: number;
		tiers: number[];
		flip: string[];
		off: number[];
		at: string[];
		above: Mean[];
		tab: Tab;
		lang: Lang;
		sort: Sort;
		inst?: number;
		venue?: number;
	};

	const span = (from: number, to: number) =>
		Array.from({ length: to - from + 1 }, (_, k) => from + k);

	const list = (value: string | null) =>
		(value ?? "").split(",").filter(Boolean);

	const lands = $derived.by(() => {
		const seen = new Set([...institutions.country, ...venues.country]);
		return continents
			.flatMap(([, codes]) => codes.split(" "))
			.filter((code) => seen.has(code))
			.sort();
	});

	const read = (): State => {
		const q = new URLSearchParams(location.search);
		const int = (key: string, or: number) => {
			const value = Number(q.get(key) ?? Number.NaN);
			return Number.isInteger(value) ? value : or;
		};
		const [low, high] = bounds;
		const clamp = (year: number) => Math.min(Math.max(year, low), high);
		const from = clamp(int("from", defaults[0]));
		const view = int("view", 0);
		return {
			view: nodes.has(view) ? view : 0,
			from,
			to: Math.max(clamp(int("to", defaults[1])), from),
			tiers: tiers.filter((t) => (q.get("tiers") ?? "1").includes(`${t}`)),
			flip: list(q.get("flip")).filter((key) => /^[1-4]\.\d+$/.test(key)),
			off: list(q.get("off")).map(Number),
			at: q.has("in")
				? lands.filter((code) => list(q.get("in")).includes(code))
				: lands,
			above: means.filter((key) => list(q.get("above")).includes(key)),
			tab: tabs.find(([key]) => key === q.get("tab"))?.[0] ?? "institutions",
			lang: langs.find((key) => key === q.get("lang")) ?? "en",
			sort: sorts.find(([key]) => key === q.get("sort"))?.[0] ?? "excess",
			inst: q.has("inst") ? int("inst", -1) : undefined,
			venue: q.has("venue") ? int("venue", -1) : undefined,
		};
	};

	const url = (state: State) => {
		const parts = [];
		if (state.view) parts.push(`view=${state.view}`);
		if (state.from !== defaults[0] || state.to !== defaults[1])
			parts.push(`from=${state.from}`, `to=${state.to}`);
		if (state.tiers.join("") !== "1")
			parts.push(`tiers=${state.tiers.join("")}`);
		if (state.flip.length) parts.push(`flip=${state.flip.join(",")}`);
		if (state.off.length) parts.push(`off=${state.off.join(",")}`);
		if (state.at.length !== lands.length)
			parts.push(`in=${state.at.join(",")}`);
		if (state.above.length) parts.push(`above=${state.above.join(",")}`);
		if (state.tab !== "institutions") parts.push(`tab=${state.tab}`);
		if (state.tab === "about" && state.lang !== "en")
			parts.push(`lang=${state.lang}`);
		if (state.sort !== "excess") parts.push(`sort=${state.sort}`);
		if (state.inst !== undefined) parts.push(`inst=${state.inst}`);
		if (state.venue !== undefined) parts.push(`venue=${state.venue}`);
		return location.pathname + (parts.length ? `?${parts.join("&")}` : "");
	};

	const first = read();

	let s = $state(first);

	$effect(() => {
		const next = url(s);
		if (next !== location.pathname + location.search)
			history.replaceState(null, "", next);
	});

	const rescope = (view: number, off: number[]) => {
		const next = { ...s, view, flip: [], off };
		history.pushState(null, "", url(next));
		s = next;
	};

	const flipped = <T,>(keys: T[], key: T) =>
		keys.includes(key) ? keys.filter((k) => k !== key) : [...keys, key];

	const node = $derived(nodes.get(s.view) as Node);
	const years = $derived(span(s.from, s.to));
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
	const land = (code: string) => at.size === lands.length || at.has(code);
	const picked = (t: number, v: number) =>
		chosen.has(t) !== flips.has(`${t}.${venues.id[v]}`);
	const all = $derived(every(node, off));

	let got = $derived.by(() => {
		void base;
		return new Map<string, unknown>();
	});

	$effect(() => forget(base));

	const take = <T,>(key: string, make: () => Promise<T>) => {
		if (got.has(key)) return got.get(key) as T;
		const view = base;
		make().then((value) => {
			if (view === base && !got.has(key)) got = new Map(got).set(key, value);
		});
	};

	const cells = $derived(
		take(`${base}/venues ${range}`, () => stalls(node, years, true)),
	);
	const wares = $derived(
		!node.children.length || all
			? cells
			: node.children.every((child) => off.has(child.id))
				? []
				: take(`${base}/venues ${range} split`, () =>
						stalls(node, years, false),
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
		return shelve(shelved, venues.id);
	});

	const bundles = $derived(
		(cells ? swaps(shelf, s.flip, chosen, years) : []).map(
			({ key, sign, read }) => ({
				sign,
				files: take(`${base}/venue ${key} ${range}`, read),
			}),
		),
	);

	const ready = $derived(
		[cells, counts, faculty].every(Boolean) &&
			bundles.every((b) => b.files) &&
			(s.tab !== "venues" || Boolean(wares)),
	);

	type Row = {
		i: number;
		rank: number;
		count: number;
		authors: number;
		people: number;
		ratio: number;
		excess: number;
		name: string;
	};

	const mean = <T,>(rows: T[], value: (row: T) => number) =>
		rows.reduce((sum, row) => sum + value(row), 0) / rows.length;

	const rank = <T extends { rank: number }>(
		rows: T[],
		key: (row: T) => number,
		tie: (a: T, b: T) => number,
	) => {
		rows.sort((a, b) => key(b) - key(a) || tie(a, b));
		rows.forEach((row, k) => {
			row.rank = k && key(row) === key(rows[k - 1]) ? rows[k - 1].rank : k + 1;
		});
		return rows;
	};

	const listed = $derived.by(() => {
		if (!ready) return undefined;
		const size = institutions.id.length;
		const sums = count(
			counts ?? [[], []],
			bundles.map(({ sign, files }) => ({ sign, files: files ?? [] })),
			under,
			off,
			size,
		);
		const people = tally(faculty ?? [[], []], size, "f", off);
		const expected = expect(sums, people);
		const rows: Row[] = [];
		for (let i = 0; i < size; i++) {
			const n = sums[i];
			if (n <= 0 || !land(institutions.country[i])) continue;
			const sum = people[i];
			const f = sum / years.length;
			rows.push({
				i,
				rank: 0,
				count: n,
				authors: f,
				people: sum,
				ratio: f ? n / f : 0,
				excess: n - expected[i],
				name: institutions.name[i],
			});
		}
		return rows;
	});

	let last: Row[] = [];

	const table = $derived.by(() => {
		const rows = listed;
		if (!rows) return last;
		const floors = (["count", "authors"] as const)
			.filter((key) => above.has(key))
			.map((key) => [key, mean(rows, (row) => row[key])] as const);
		last = rank(
			rows
				.filter((row) => floors.every(([key, m]) => row[key] > m))
				.map((row) => ({ ...row })),
			(row) => row[s.sort],
			(a, b) => a.name.localeCompare(b.name),
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

	const crew = $derived.by(() => {
		if (open < 0 || !cells) return undefined;
		const want = sought;
		return take(
			`institution ${open} ${base} ${range} ${s.tiers} ${s.flip}`,
			() =>
				groups(`institution/${open}.parquet`, (stat) =>
					holds(want.get(stat("year")[0]), stat("v")),
				),
		);
	});
	const roll = $derived(`institution/${open}.people.parquet`);
	const roster = $derived(
		open < 0 ? undefined : take(`roster ${open}`, () => starts(roll)),
	);

	const team = $derived.by(() => {
		if (!crew || !roster) return [];
		const sums = credit(
			crew,
			under,
			"a",
			(r, g) => counted(g.v[r], g.year[r]),
			new Float64Array(roster[roster.length - 1]),
		);
		const rows: { a: number; n: number; rank: number }[] = [];
		sums.forEach((n, a) => {
			if (n > 0) rows.push({ a, n, rank: 0 });
		});
		return rank(
			rows,
			(row) => row.n,
			(a, b) => a.a - b.a,
		);
	});

	let crowd = $derived.by(() => {
		void team;
		return 200;
	});

	const folk = $derived.by(() => {
		const names = new Map<number, [number, string]>();
		if (!roster) return names;
		const need = new Set<number>();
		for (const { a } of team.slice(0, crowd)) {
			let k = 0;
			while (roster[k + 1] <= a) k++;
			need.add(k);
		}
		for (const k of need) {
			const got = take(`people ${open} ${k}`, () =>
				part<People>(roll, k, ["a", "name"]),
			);
			got?.a.forEach((id, j) => {
				names.set(roster[k] + j, [id, got.name[j]]);
			});
		}
		return names;
	});

	const known = $derived.by(() => {
		const top = Math.min(crowd, team.length);
		let n = 0;
		while (n < top && folk.has(team[n].a)) n++;
		return n;
	});

	type Stock = {
		v: number;
		n: number;
		rank: number;
		tiers: string[];
		parts: Map<number, { year: number; t: number; n: number }>;
	};

	let stocked: Stock[] = [];

	const stock = $derived.by(() => {
		if (!wares) return stocked;
		const rows = new Map<number, Stock>();
		for (const { year, child, v, tier: t, mass } of wares) {
			for (let r = 0; r < v.length; r++) {
				if (child && off.has(child[r])) continue;
				let row = rows.get(v[r]);
				if (!row) {
					const tiers = years.map(() => "");
					row = { v: v[r], n: 0, rank: 0, tiers, parts: new Map() };
					rows.set(v[r], row);
				}
				row.tiers[year[r] - s.from] = `${t[r]}`;
				const part = row.parts.get(year[r]) ?? { year: year[r], t: t[r], n: 0 };
				part.n += mass[r];
				row.parts.set(year[r], part);
				if (picked(t[r], v[r])) row.n += mass[r];
			}
		}
		const listed = [...rows.values()].filter(
			(row) => row.n > 0 && land(venues.country[row.v]),
		);
		const floor = above.has("venues")
			? mean(listed, (row) => row.n)
			: Number.NEGATIVE_INFINITY;
		stocked = rank(
			listed.filter((row) => row.n > floor),
			(row) => row.n,
			(a, b) => venues.name[a.v].localeCompare(venues.name[b.v]),
		);
		return stocked;
	});

	const scores = $derived(
		seat < 0
			? undefined
			: take(`scores ${range}`, () =>
					groups("scores.parquet", having({ year: years })),
				),
	);

	const score = (v: number, year: number) => {
		const group = scores?.find((g) => g.year[0] === year);
		if (!group) return "";
		const k = bound(group.v, v);
		if (group.v[k] !== v) return "";
		const n = group.score[k];
		return `${Math.floor(n / 1e4)}.${`${n % 1e4}`.padStart(4, "0")}`;
	};

	const busy = $derived(
		!ready ||
			(s.tab === "institutions"
				? open >= 0 &&
					(!crew || !roster || known < Math.min(crowd, team.length))
				: seat >= 0 && !scores),
	);

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
						.sort((a, b) => a.name.localeCompare(b.name)),
				}))
				.filter((continent) => continent.children.length),
		}),
		mark: held,
		flip: (twig) => {
			const on = held(twig) !== 2;
			const codes = new Set(leaves(twig).map((l) => l.id));
			s.at = lands.filter((code) => (codes.has(code) ? on : at.has(code)));
		},
	});

	const size = $derived(s.tab === "institutions" ? table.length : stock.length);

	let shown = $derived.by(() => {
		void base;
		void s.tab;
		void s.sort;
		void s.at;
		void s.above;
		return 200;
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

	const ratio = (row: Row) =>
		row.people ? hundredths(row.count * years.length, row.people) : "0.00";

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
		});

	const unfold = (event: MouseEvent, v: number) =>
		fold(event, () => {
			const id = venues.id[v];
			s.venue = s.venue === id ? undefined : id;
		});

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
		shown = Math.max(shown, k + 200);
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
		});
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
						["Rank", "Venue", "Country", ...years, "Count"],
						...stock.map((row) => [
							row.rank,
							venues.name[row.v],
							venues.country[row.v],
							...row.tiers,
							micro(row.n),
						]),
					];
		const file = new Blob(
			[`${lines.map((line) => line.map(cell).join(",")).join("\n")}\n`],
			{ type: "text/csv" },
		);
		const anchor = document.createElement("a");
		anchor.href = URL.createObjectURL(file);
		anchor.download = `allrankings-${node.level}-${node.id}-${s.tab}-${range}.csv`;
		anchor.click();
		URL.revokeObjectURL(anchor.href);
	};
</script>

<svelte:window onpopstate={() => (s = read())} />

{#snippet tab(key: Tab, label: string)}
	<button
		class:on={s.tab === key}
		aria-pressed={s.tab === key}
		onclick={() => (s.tab = key)}>{label}</button
	>
{/snippet}

{#snippet down()}
	<svg viewBox="0 0 16 16" aria-hidden="true"
		><path
			fill="none"
			stroke="currentColor"
			stroke-width="1.5"
			d="M8 1.5v9M4 7l4 4 4-4M2 14.5h12"
		/></svg
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

{#snippet venue(row: Stock)}
	<span class="rank">{row.rank}</span>
	<span class="entry">
		{@render name(venues.country[row.v], venues.name[row.v])}
		<span class="figures">
			<span class="strip">
				{#each row.tiers as t, y (y)}
					<span>{t || "\u2007"}</span>
				{/each}
			</span>
			<span class="num">{micro(row.n)}</span>
		</span>
	</span>
{/snippet}

{#snippet line(row: Row)}
	<span class="rank">{row.rank}</span>
	{@render name(institutions.country[row.i], row.name)}
	<span class="num">{micro(row.count)}</span>
	<span class="num">{micro(row.authors)}</span>
	<span class="num">{row.authors ? ratio(row) : ""}</span>
	<span class="num">{signed(row.excess)}</span>
{/snippet}

<header class="bar">
	<div class="side">
		<h1><a href="./">AllRankings</a></h1>
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
					aria-label="Download PDF">{@render down()}</a
				>
			{:else}
				<button
					disabled={!ready}
					title="Download CSV"
					aria-label="Download CSV"
					onclick={csv}>{@render down()}</button
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
	{#await import("./about/About.svelte") then { default: About }}
		<About bind:lang={s.lang} />
	{/await}
{:else}
	<Panel trees={[areas, nations, shelves]}>
		{#snippet tail()}
			<span class="years">
				<select bind:value={s.from} aria-label="From">
					{#each span(bounds[0], s.to) as year (year)}
						<option value={year}>{year}</option>
					{/each}
				</select>
				–
				<select bind:value={s.to} aria-label="To">
					{#each span(s.from, bounds[1]) as year (year)}
						<option value={year}>{year}</option>
					{/each}
				</select>
			</span>
		{/snippet}
	</Panel>

	<main
		class={[s.tab, { busy }]}
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
					<span class="sort"
						><span
							>{#if key === "count" || key === "authors"}{@render floor(
									key,
									`Only institutions above the mean ${label}`,
								)}{/if}<button
								class:on={s.sort === key}
								aria-pressed={s.sort === key}
								onclick={() => (s.sort = key)}>{label}</button
							></span
						></span
					>
				{/each}
			{:else}
				<span class="rank">#</span>
				<span class="entry">
					<span class="name title">Venue</span>
					<span class="figures">
						<span class="strip"><span class="num">Tier</span></span>
						<span class="sort"
							><span
								>{@render floor(
									"venues",
									"Only venues above the mean Count",
								)}Count</span
							></span
						>
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
							onclick={(event) => expand(event, row.i)}
							>{@render line(row)}</button
						>
						{#each team.slice(0, known) as person (person.a)}
							{@const [id, label] = folk.get(person.a) ?? [0, ""]}
							<div class="row sub">
								<span class="rank"></span>
								<span class="name"
									><span class="seq">{person.rank}</span><a
										href="https://openalex.org/A{id}"
										target="_blank"
										rel="noopener">{label}</a
									></span
								>
								<span class="num">{micro(person.n)}</span>
							</div>
						{/each}
						{#if known === crowd && crowd < team.length}
							<div {@attach more(() => (crowd += 200))}></div>
						{/if}
					</div>
				{:else}
					<button
						class="row"
						aria-expanded="false"
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
							onclick={(event) => unfold(event, row.v)}
							>{@render venue(row)}</button
						>
						{#each [...row.parts.values()].sort((a, b) => a.year - b.year) as part (part.year)}
							<div class={["row part", { miss: !picked(part.t, row.v) }]}>
								<span class="rank"></span>
								<span class="entry">
									{@render name("", `${part.year}`)}
									<span class="figures">
										<span class="score">{score(row.v, part.year)}</span>
										<span class="strip">
											{#each years as year (year)}
												<span>{year === part.year ? part.t : "\u2007"}</span>
											{/each}
										</span>
										<span class="num">{micro(part.n)}</span>
									</span>
								</span>
							</div>
						{/each}
					</div>
				{:else}
					<button
						class="row"
						aria-expanded="false"
						onclick={(event) => unfold(event, row.v)}
						>{@render venue(row)}</button
					>
				{/if}
			{/each}
		{/if}
		{#if shown < size}
			<div {@attach more(() => (shown += 200))}></div>
		{/if}
	</main>
{/if}
