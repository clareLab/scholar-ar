<script lang="ts">
	import Frame from "../Frame.svelte";
	import {
		faint,
		fit,
		hair,
		ink,
		mute,
		named,
		order,
		page,
		type Props,
		pct,
		pointer,
		ramp,
		room,
		scale,
		size,
		small,
		ticks,
	} from "../plot";
	import Switch from "../Switch.svelte";

	let { about, words, print = false }: Props = $props();
	let width = $state(0);
	const W = $derived(print ? page : width);

	type Metric = "top10" | "top1" | "fwci";
	const say = $derived(words.validity);
	const metrics: [Metric, string][] = $derived([
		["top10", say.top10],
		["top1", say.top1],
		["fwci", say.fwci],
	]);
	const show = (m: Metric, v: number) =>
		m === "fwci" ? v.toFixed(2) : pct(v, 1);

	const v = $derived(about.validity);
	const rows = $derived(
		order(about, [...new Set(v.rows.map((r) => r.view))]).map((view) => ({
			view,
			name: named(about, view),
			tiers: [1, 2, 3, 4].map(
				(t) =>
					v.rows.find(
						(r) => r.view === view && r.tier === t,
					) as (typeof v.rows)[number],
			),
		})),
	);

	let metric = $state<Metric>("top10");
	const wide = $derived(W >= 600);
	const gap = 22;
	const label = $derived(
		room(
			rows.map((r) => r.name),
			W * (wide ? 0.4 : 0.42),
		),
	);
	const shown = $derived(
		wide ? metrics : metrics.filter(([m]) => m === metric),
	);
	const top = 42;
	const row = $derived(print ? 17 : 20);
	const split = 8;
	const rowY = (j: number) => top + row * j + (j ? split : 0);
	const H = $derived(rowY(rows.length) + 2);
	const panels = $derived.by(() => {
		const pw = (W - label - gap * shown.length) / shown.length;
		return shown.map(([m, title], k) => {
			const peak = Math.max(...rows.flatMap((r) => r.tiers.map((t) => t[m])));
			const marks = ticks(0, peak, m === "fwci" ? 3 : 2);
			const x0 = label + gap + k * (pw + gap);
			return {
				m,
				title,
				marks,
				x: scale([0, marks[marks.length - 1]], [x0 + 4, x0 + pw - 18]),
				x0,
				pw,
			};
		});
	});

	let hover = $state<number>();
	const move = (event: PointerEvent) => {
		const [, y] = pointer(event);
		const j = rows.findIndex((_, k) => y >= rowY(k) && y < rowY(k) + row);
		hover = j >= 0 ? j : undefined;
	};
	const readout = $derived.by(() => {
		const r = rows[hover ?? 0];
		const list = (wide ? metrics : metrics.filter(([m]) => m === metric))
			.map(
				([m, title]) =>
					`${title} ${r.tiers.map((t) => show(m, t[m])).join(" ")}`,
			)
			.join(words.list);
		return [r.name, say.item(list)] as [string, string];
	});
</script>

<Frame {print} bind:width {readout}>
	{#snippet controls()}
		{#if !wide}
			<Switch options={metrics} bind:value={metric} />
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
		<text x={0} y={34} fill={mute}>{words.area}</text>
		{#each ramp as color, t (t)}
			<circle cx={t * 40 + 4} cy={9.5} r={3.5} fill={color} />
			<text x={t * 40 + 12} y={14} fill={mute}>T{t + 1}</text>
		{/each}
		{#each panels as p (p.m)}
			{#if wide}
				<text x={p.x(0)} y={14} fill={mute}>{p.title}</text>
			{/if}
			{#each p.marks as t (t)}
				<line
					x1={p.x(t)}
					x2={p.x(t)}
					y1={top - 4}
					y2={H}
					stroke={t ? faint : hair}
				/>
				<text
					x={p.x(t)}
					y={34}
					fill={mute}
					font-size={small}
					text-anchor={t ? "middle" : "start"}
					>{p.m === "fwci" ? t : pct(t)}</text
				>
			{/each}
		{/each}
		{#each rows as r, j (r.view)}
			{@const y = rowY(j) + row / 2}
			{@const on = hover === undefined || hover === j}
			<text x={0} y={y + 4.5} fill={on ? ink : mute}
				>{fit(r.name, label - 4)}</text
			>
			{#each panels as p (p.m)}
				{@const xs = r.tiers.map((t) => p.x(t[p.m]))}
				<line
					x1={Math.min(...xs)}
					x2={Math.max(...xs)}
					y1={y}
					y2={y}
					stroke={on ? hair : faint}
				/>
				{#each [3, 2, 1, 0] as t (t)}
					<circle
						cx={xs[t]}
						cy={y}
						r={3.5}
						fill={ramp[t]}
						opacity={on ? 1 : 0.4}
					/>
				{/each}
			{/each}
		{/each}
	</svg>
</Frame>
