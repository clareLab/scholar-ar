<script lang="ts">
	import { tick } from "svelte";
	import {
		credit,
		type Group,
		groups,
		hundredths,
		type Meta,
		micro,
		type Node,
		type People,
		read as part,
		starts,
		topics,
		total,
	} from "./data";
	import { continents } from "./continents";
	import { country, flag } from "./flags";
	import Panel, {
		leaves,
		rooted,
		type Tree,
		type Twig,
		whole,
	} from "./Panel.svelte";

	let { meta }: { meta: Meta } = $props();

	const { index, nodes, institutions, venues } = $derived(meta);
	const release = $derived(index.release);
	const tabs = [
		["institutions", "Institutions"],
		["venues", "Venues"],
	] as const;
	const sorts = [
		["count", "Count"],
		["faculty", "Faculty"],
		["ratio", "Per faculty"],
	] as const;
	const tiers = [1, 2, 3, 4];
	const means = ["count", "faculty", "venues"] as const;

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
		sort: Sort;
		inst?: number;
		venue?: number;
	};

	const span = (from: number, to: number) =>
		Array.from({ length: to - from + 1 }, (_, k) => from + k);

	const list = (value: string | null) =>
		(value ?? "").split(",").filter(Boolean);

	const lands = $derived(
		[...new Set(institutions.country)].filter(Boolean).sort(),
	);

	const read = (): State => {
		const q = new URLSearchParams(location.search);
		const int = (key: string, or: number) => {
			const value = Number(q.get(key) ?? Number.NaN);
			return Number.isInteger(value) ? value : or;
		};
		const [low, high] = index.years;
		const clamp = (year: number) => Math.min(Math.max(year, low), high);
		const from = clamp(int("from", index.default_years[0]));
		const view = int("view", 0);
		return {
			view: nodes.has(view) ? view : 0,
			from,
			to: Math.max(clamp(int("to", index.default_years[1])), from),
			tiers: tiers.filter((t) => (q.get("tiers") ?? "1").includes(`${t}`)),
			flip: list(q.get("flip")).filter((key) => /^[1-4]\.\d+$/.test(key)),
			off: list(q.get("off")).map(Number),
			at: q.has("in")
				? lands.filter((code) => list(q.get("in")).includes(code))
				: lands,
			above: means.filter(
				(key) => !q.has("above") || list(q.get("above")).includes(key),
			),
			tab: tabs.find(([key]) => key === q.get("tab"))?.[0] ?? "institutions",
			sort: sorts.find(([key]) => key === q.get("sort"))?.[0] ?? "count",
			inst: q.has("inst") ? int("inst", -1) : undefined,
			venue: q.has("venue") ? int("venue", -1) : undefined,
		};
	};

	const url = (state: State) => {
		const parts = [];
		if (state.view) parts.push(`view=${state.view}`);
		if (
			state.from !== index.default_years[0] ||
			state.to !== index.default_years[1]
		)
			parts.push(`from=${state.from}`, `to=${state.to}`);
		if (state.tiers.join("") !== "1")
			parts.push(`tiers=${state.tiers.join("")}`);
		if (state.flip.length) parts.push(`flip=${state.flip.join(",")}`);
		if (state.off.length) parts.push(`off=${state.off.join(",")}`);
		if (state.at.length !== lands.length)
			parts.push(`in=${state.at.join(",")}`);
		if (state.above.length !== means.length)
			parts.push(`above=${state.above.join(",")}`);
		if (state.tab !== "institutions") parts.push(`tab=${state.tab}`);
		if (state.sort !== "count") parts.push(`sort=${state.sort}`);
		if (state.inst !== undefined) parts.push(`inst=${state.inst}`);
		if (state.venue !== undefined) parts.push(`venue=${state.venue}`);
		return location.pathname + (parts.length ? `?${parts.join("&")}` : "");
	};

	let s = $state(read());

	$effect(() => {
		const next = url(s);
		if (next !== location.pathname + location.search)
			history.replaceState(null, "", next);
	});

	const link = (view: number) => url({ ...s, view, flip: [], off: [] });

	const go = (view: number) => {
		if (view === s.view) return;
		history.pushState(null, "", link(view));
		s = { ...s, view, flip: [], off: [] };
	};

	const flipped = <T,>(keys: T[], key: T) =>
		keys.includes(key) ? keys.filter((k) => k !== key) : [...keys, key];

	const node = $derived(nodes.get(s.view) as Node);
	const years = $derived(span(s.from, s.to));
	const base = $derived(`${release}/views/${node.level}/${node.id}`);
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
	const within = (year: number) => year >= s.from && year <= s.to;
	const land = (code: string) => at.size === lands.length || at.has(code);
	const ends = (year: number) => year === s.to || year === s.from - 1;
	const sign = (r: number, g: Group) => (g.year[r] === s.to ? 1 : -1);
	const picked = (t: number, v: number) =>
		chosen.has(t) !== flips.has(`${t}.${venues.id[v]}`);
	const fresh = (r: number, g: Group) => !g.child || !off.has(g.child[r]);
	const slot = (v: number, year: number) => v * 4096 + year;

	let got = $state.raw(new Map<string, unknown>());

	const take = <T,>(key: string, make: () => Promise<T>) => {
		if (got.has(key)) return got.get(key) as T;
		make().then((value) => {
			if (!got.has(key)) got = new Map(got).set(key, value);
		});
	};

	const cells = $derived(
		take(`${base}/venues ${range}`, () =>
			groups(`${base}/venues.parquet`, (stat) => within(stat("year")[0])),
		),
	);
	const counts = $derived(
		take(`${base}/counts ${range} ${s.tiers}`, () =>
			groups(
				`${base}/counts.parquet`,
				(stat) => ends(stat("year")[0]) && chosen.has(stat("tier")[0]),
			),
		),
	);
	const faculty = $derived(
		take(`${base}/faculty ${range}`, () =>
			groups(`${base}/faculty.parquet`, (stat) => ends(stat("year")[0])),
		),
	);

	type Listing = { key: string; tier: number; v: number; name: string };

	const shelf = $derived.by(() => {
		const tier = new Map<number, number>();
		const mass = new Map<string, [number, number, number]>();
		for (const { year, v, tier: t, mass: m } of cells ?? []) {
			for (let r = 0; r < v.length; r++) {
				tier.set(slot(v[r], year[r]), t[r]);
				const key = `${t[r]}.${venues.id[v[r]]}`;
				const cell = mass.get(key) ?? [t[r], v[r], 0];
				cell[2] += m[r];
				mass.set(key, cell);
			}
		}
		const listings = tiers.map((): Listing[] => []);
		for (const [key, [t, v]] of [...mass].sort(
			(a, b) => b[1][2] - a[1][2] || a[1][1] - b[1][1],
		))
			listings[t - 1].push({ key, tier: t, v, name: venues.name[v] });
		return { tier, mass, listings };
	});

	const active = $derived(s.flip.filter((key) => shelf.mass.has(key)));

	const bundles = $derived(
		active.map((key) => {
			const [t, v] = shelf.mass.get(key) as [number, number, number];
			const files = take(`${base}/venue ${v} ${t} ${range}`, () =>
				groups(`${release}/venue/${v}.parquet`, (stat) => {
					const year = stat("year")[0];
					return within(year) && shelf.tier.get(slot(v, year)) === t;
				}),
			);
			return { sign: chosen.has(t) ? -1 : 1, files };
		}),
	);

	const ready = $derived(
		cells && counts && faculty && bundles.every((b) => b.files),
	);

	type Row = {
		i: number;
		rank: number;
		count: number;
		faculty: number;
		people: number;
		ratio: number;
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

	let last: Row[] = [];

	const table = $derived.by(() => {
		if (!ready) return last;
		const size = institutions.id.length;
		const value = (key: string) => (r: number, g: Group) =>
			fresh(r, g) ? sign(r, g) * g[key][r] : 0;
		const sums = total(counts ?? [], size, "i", value("n"));
		for (const { sign, files } of bundles)
			credit(files ?? [], under, "i", () => true, sums, sign);
		const people = total(faculty ?? [], size, "i", value("f"));
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
				faculty: f,
				people: sum,
				ratio: f ? n / f : 0,
				name: institutions.name[i],
			});
		}
		const floors = (["count", "faculty"] as const)
			.filter((key) => above.has(key))
			.map((key) => [key, mean(rows, (row) => row[key])] as const);
		last = rank(
			rows.filter((row) => floors.every(([key, m]) => row[key] > m)),
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

	const crew = $derived(
		open < 0 || !cells
			? undefined
			: take(`institution ${open} ${base} ${range} ${s.tiers} ${s.flip}`, () =>
					groups(`${release}/institution/${open}.parquet`, (stat) =>
						holds(sought.get(stat("year")[0]), stat("v")),
					),
				),
	);
	const roll = $derived(`${release}/institution/${open}.people.parquet`);
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
		parts: { year: number; t: number; n: number }[];
	};

	const stock = $derived.by(() => {
		const rows = new Map<number, Stock>();
		for (const { year, v, tier: t, mass } of cells ?? []) {
			for (let r = 0; r < v.length; r++) {
				let row = rows.get(v[r]);
				if (!row) {
					const tiers = years.map(() => "");
					row = { v: v[r], n: 0, rank: 0, tiers, parts: [] };
					rows.set(v[r], row);
				}
				row.tiers[year[r] - s.from] = `${t[r]}`;
				row.parts.push({ year: year[r], t: t[r], n: mass[r] });
				if (picked(t[r], v[r])) row.n += mass[r];
			}
		}
		const listed = [...rows.values()].filter(
			(row) => row.n > 0 && land(venues.country[row.v]),
		);
		const floor = above.has("venues")
			? mean(listed, (row) => row.n)
			: Number.NEGATIVE_INFINITY;
		return rank(
			listed.filter((row) => row.n > floor),
			(row) => row.n,
			(a, b) => venues.name[a.v].localeCompare(venues.name[b.v]),
		);
	});

	const scores = $derived(
		seat < 0
			? undefined
			: take(`scores ${range}`, () =>
					groups(`${release}/scores.parquet`, (stat) =>
						within(stat("year")[0]),
					),
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

	const areas: Tree = $derived({
		name: "Areas",
		root: nodes.get(0) as Node,
		at: node,
		link: (twig) => link(twig.id as number),
		open: (twig) => go(twig.id as number),
		mark: (twig) =>
			twig === node && node.children.length
				? sown
				: twig.parent === node
					? sow(twig)
					: undefined,
		flip: (twig) => {
			const all = sown === 2 ? node.children.map((c) => c.id) : [];
			s.off = (twig === node ? all : flipped(s.off, twig.id as number)).sort(
				(a, b) => a - b,
			);
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
					name: l.name,
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

	const more = (grow: () => void) => (sentinel: Element) => {
		const watch = new IntersectionObserver(
			([entry]) => {
				if (!entry.isIntersecting) return;
				grow();
				watch.unobserve(sentinel);
				watch.observe(sentinel);
			},
			{ rootMargin: "100% 0px" },
		);
		watch.observe(sentinel);
		return () => watch.disconnect();
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
							"Faculty",
							"Per faculty",
						],
						...table.map((row) => [
							row.rank,
							row.name,
							institutions.country[row.i],
							micro(row.count),
							micro(row.faculty),
							ratio(row),
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

{#snippet name(code: string, text: string)}
	<span class="name">
		{#if flag(code)}
			<img class="flag" src={flag(code)} alt="" />
		{:else}
			<span class="flag"></span>
		{/if}{text}
	</span>
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
	<span class="num">{micro(row.faculty)}</span>
	<span class="num">{row.faculty ? ratio(row) : ""}</span>
{/snippet}

<header class="bar">
	<h1>AllRankings</h1>
	<div class="tools">
		<span class="tabs">
			{#each tabs as [tab, label] (tab)}
				<button
					class:on={s.tab === tab}
					aria-pressed={s.tab === tab}
					onclick={() => (s.tab = tab)}>{label}</button
				>
			{/each}
		</span>
		<span class="years">
			<select bind:value={s.from} aria-label="From">
				{#each span(index.years[0], s.to) as year (year)}
					<option value={year}>{year}</option>
				{/each}
			</select>
			–
			<select bind:value={s.to} aria-label="To">
				{#each span(s.from, index.years[1]) as year (year)}
					<option value={year}>{year}</option>
				{/each}
			</select>
		</span>
		<button onclick={csv}>CSV</button>
	</div>
</header>

<Panel trees={[areas, nations, shelves]} />

<main
	class={[s.tab, { busy }]}
	style:--years={years.length}
	style:--digits={String(size).length}
>
	<div class="row head">
		{#if s.tab === "institutions"}
			<span class="rank">#</span><span class="title">Institution</span>
			{#each sorts as [key, label] (key)}
				<span class="sort"
					><span
						>{#if key !== "ratio"}{@render floor(
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
					onclick={(event) => expand(event, row.i)}>{@render line(row)}</button
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
					{#each [...row.parts].sort((a, b) => a.year - b.year) as part (part.year)}
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
					onclick={(event) => unfold(event, row.v)}>{@render venue(row)}</button
				>
			{/if}
		{/each}
	{/if}
	{#if shown < size}
		<div {@attach more(() => (shown += 200))}></div>
	{/if}
</main>
