<script lang="ts">
	import Frame from "../Frame.svelte";
	import {
		faint,
		fit,
		hair,
		ink,
		measure,
		mute,
		page,
		type Props,
		pieces,
		pointer,
		room,
		size,
		wrap,
	} from "../plot";
	import Switch from "../Switch.svelte";

	let { about, words, print = false }: Props = $props();
	let width = $state(0);
	const W = $derived(print ? page : width);

	type Level = "topic" | "subfield" | "field" | "domain";
	type Item = { key: string; name: string; k: number; up?: string };

	const ex = $derived(about.example);
	const say = $derived(words.apportion);

	const levels = $derived.by(() => {
		const { names } = about;
		const sum = (
			key: (t: (typeof ex.topics)[number]) => string,
			name: (t: (typeof ex.topics)[number]) => string,
			up?: (t: (typeof ex.topics)[number]) => string,
		) => {
			const out = new Map<string, Item>();
			for (const t of ex.topics) {
				const item = out.get(key(t)) ?? {
					key: key(t),
					name: name(t),
					k: 0,
					up: up?.(t),
				};
				item.k += t.k;
				out.set(item.key, item);
			}
			return [...out.values()];
		};
		const raw = {
			topic: sum(
				(t) => `t${t.topic}`,
				(t) => t.name,
				(t) => `s${t.subfield}`,
			),
			subfield: sum(
				(t) => `s${t.subfield}`,
				(t) => names.subfields[t.subfield],
				(t) => `f${t.field}`,
			),
			field: sum(
				(t) => `f${t.field}`,
				(t) => names.fields[t.field],
				(t) => `d${t.domain}`,
			),
			domain: sum(
				(t) => `d${t.domain}`,
				(t) => names.domains[t.domain],
			),
		} satisfies Record<Level, Item[]>;
		const rank = new Map<string, number>();
		for (const lv of ["domain", "field", "subfield", "topic"] as Level[]) {
			raw[lv].sort(
				(a, b) =>
					(rank.get(a.up ?? "") ?? 0) - (rank.get(b.up ?? "") ?? 0) ||
					b.k - a.k ||
					a.key.localeCompare(b.key),
			);
			raw[lv].forEach((item, j) => rank.set(item.key, j));
		}
		return raw;
	});

	let level = $state<Level>("field");
	const wide = $derived(W >= 560);
	const shown: Level[] = $derived(
		wide ? ["topic", "subfield", "field", "domain"] : ["topic", level],
	);
	const gap = 16;
	const num = 24;
	const top = 28;
	const lead = 17;
	const widths = $derived.by(() => {
		const free = W - gap * (shown.length - 1);
		const names = shown.map((lv) => levels[lv].map((i) => i.name));
		const need = names.map(
			(list) => room(list, Number.POSITIVE_INFINITY) + num,
		);
		const total = need.reduce((a, b) => a + b, 0);
		if (total <= free) return need.map((n) => (free * n) / total);
		const options = names.map((list, c) => {
			const low =
				Math.ceil(
					Math.max(
						...list.flatMap((n) => pieces(n).map((x) => measure(x.trim()))),
					),
				) +
				num +
				8;
			const out: { w: number; h: number; n: number }[] = [];
			for (let w = Math.min(low, need[c]); ; w += 2) {
				const lines = list.map((n) => wrap(n, w - num - 6).length);
				const n = lines.reduce((a, b) => a + b, 0);
				const fits = lines.every((l) => l <= 3) || w >= need[c];
				if (fits && (!out.length || n < out[out.length - 1].n))
					out.push({ w, h: n * lead + 8 * list.length, n });
				if (w >= need[c] || n === list.length) break;
			}
			return out;
		});
		let best = { score: Number.POSITIVE_INFINITY, pick: options.map(() => 0) };
		const search = (c: number, pick: number[], used: number) => {
			if (c === options.length) {
				const chosen = pick.map((k, j) => options[j][k]);
				const score =
					Math.max(...chosen.map((o) => o.h)) +
					6 * chosen.reduce((a, o) => a + o.n, 0);
				if (score < best.score) best = { score, pick: [...pick] };
				return;
			}
			options[c].forEach((o, k) => {
				if (used + o.w <= free) search(c + 1, [...pick, k], used + o.w);
			});
		};
		search(0, [], 0);
		const out = best.pick.map((k, c) => options[c][k].w);
		const used = () => out.reduce((a, b) => a + b, 0);
		out[0] += free - used();
		return out;
	});

	const columns = $derived.by(() => {
		let x = 0;
		return shown.map((lv, c) => {
			const w = widths[c];
			let y = top;
			const items = levels[lv].map((item) => {
				const all = wrap(item.name, w - num - 6);
				const lines = all.slice(0, 3);
				if (all.length > 3) lines[2] = fit(all.slice(2).join(" "), w - num - 6);
				const at = { ...item, lines, y, h: lead * lines.length + 8 };
				y += at.h;
				return at;
			});
			const col = { level: lv, x, w, items, bottom: y };
			x += w + gap;
			return col;
		});
	});

	const H = $derived(Math.max(...columns.map((c) => c.bottom)) + 2);
	const all = $derived(
		new Map(
			Object.values(levels).flatMap((items) => items.map((i) => [i.key, i])),
		),
	);
	const spot = $derived(
		new Map(
			columns.flatMap((col) =>
				col.items.map((item, j) => [item.key, { col, j }] as const),
			),
		),
	);

	const chain = (key: string) => {
		const out = [key];
		let up = all.get(key)?.up;
		while (up) {
			out.push(up);
			up = all.get(up)?.up;
		}
		return out;
	};

	let hover = $state<string>();
	const lit = $derived.by(() => {
		if (!hover) return new Set<string>();
		const out = new Set(chain(hover));
		for (const t of levels.topic) {
			const c = chain(t.key);
			if (c.includes(hover)) for (const key of c) out.add(key);
		}
		return out;
	});

	const target = (item: Item) => {
		let up = item.up;
		while (up && !spot.has(up)) up = all.get(up)?.up;
		return up;
	};

	const links = $derived(
		columns.slice(0, -1).flatMap((col) =>
			col.items.map((item, j) => {
				const to = target(item) as string;
				const end = spot.get(to) as {
					col: (typeof columns)[number];
					j: number;
				};
				const x1 = col.x + col.w + 3;
				const y1 = item.y + 9;
				const x2 = end.col.x - 3;
				const y2 = end.col.items[end.j].y + 9;
				const m = (x1 + x2) / 2;
				return {
					key: `${item.key}-${to}`,
					d: `M${x1},${y1}C${m},${y1} ${m},${y2} ${x2},${y2}`,
					on: lit.has(item.key) && lit.has(to),
				};
			}),
		),
	);

	const move = (event: PointerEvent) => {
		const [x, y] = pointer(event);
		const col = columns.find(
			(c) => x >= c.x - gap / 2 && x <= c.x + c.w + gap / 2,
		);
		hover = col?.items.find((i) => y >= i.y && y < i.y + i.h)?.key;
	};

	const readout = $derived.by(() => {
		const item = hover ? all.get(hover) : undefined;
		if (!item) return say.idle(ex.K, ex.references);
		return [item.name, say.item(item.k, ex.K, (item.k / ex.K).toFixed(3))] as [
			string,
			string,
		];
	});
</script>

<Frame {print} bind:width {readout}>
	{#snippet controls()}
		{#if !wide}
			<Switch
				options={[
					["subfield", say.subfield],
					["field", say.field],
					["domain", say.domain],
				]}
				bind:value={level}
			/>
		{/if}
	{/snippet}
	<svg
		xmlns="http://www.w3.org/2000/svg"
		viewBox="0 0 {W} {H}"
		width={W}
		height={H}
		font-family={words.font}
		font-size={size}
		fill={ink}
		role="img"
		onpointermove={move}
		onpointerdown={move}
		onpointerleave={() => (hover = undefined)}
	>
		{#each links as link (link.key)}
			<path d={link.d} fill="none" stroke={link.on ? ink : hair} />
		{/each}
		{#each columns as col (col.level)}
			<text x={col.x} y={14} fill={mute}>{say[col.level]}</text>
			<text
				x={col.x + col.w}
				y={14}
				fill={mute}
				font-style="italic"
				text-anchor="end">k</text
			>
			<line x1={col.x} x2={col.x + col.w} y1={20.5} y2={20.5} stroke={hair} />
			{#each col.items as item (item.key)}
				{@const on = !hover || lit.has(item.key)}
				{#each item.lines as text, l (l)}
					<text x={col.x} y={item.y + 13 + lead * l} fill={on ? ink : mute}
						>{text}</text
					>
				{/each}
				<text
					x={col.x + col.w}
					y={item.y + 13}
					text-anchor="end"
					fill={on ? ink : mute}>{item.k}</text
				>
				<rect
					x={col.x}
					y={item.y + item.h - 6}
					width={col.w}
					height={4}
					fill={faint}
				/>
				<rect
					x={col.x}
					y={item.y + item.h - 6}
					width={(col.w * item.k) / ex.K}
					height={4}
					fill={hover && !on ? hair : ink}
				/>
			{/each}
		{/each}
	</svg>
</Frame>
