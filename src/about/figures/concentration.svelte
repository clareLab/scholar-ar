<script lang="ts">
	import Frame from "../Frame.svelte";
	import {
		faint,
		fit,
		hair,
		ink,
		logScale,
		logSpan,
		logTicks,
		mute,
		named,
		near,
		page,
		path,
		type Props,
		pct,
		pointer,
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

	const say = $derived(words.concentration);
	let mode = $state<"lorenz" | "top">("top");
	const rows = $derived(
		[...about.concentration]
			.sort((a, b) =>
				a.view === "all" ? -1 : b.view === "all" ? 1 : b.top100 - a.top100,
			)
			.map((c) => ({
				...c,
				name: named(about, c.view),
				curve:
					mode === "lorenz"
						? c.lorenz
						: c.lorenz
								.filter(([x]) => x < 1)
								.map(([x, y]): [number, number] => [1 - x, 1 - y])
								.reverse(),
			})),
	);

	const wide = $derived(W >= 600);
	const head = 26;
	const ax = 40;
	const need = $derived(
		room(
			rows.map((r) => r.name),
			Number.POSITIVE_INFINITY,
		),
	);
	const S = $derived(
		wide ? Math.max(180, Math.min(290, W - ax - 40 - need - 160)) : W - ax,
	);
	const low = $derived(
		logSpan(
			rows.flatMap((r) => r.curve.map(([x]) => x)).filter((x) => x > 0),
		)[0],
	);
	const lx = $derived(
		mode === "lorenz"
			? scale([0, 1], [ax, ax + S])
			: logScale([low, 1], [ax, ax + S]),
	);
	const xt = $derived(
		mode === "lorenz"
			? [0, 0.5, 1]
			: logTicks(low, 1).filter((t) => Number.isInteger(Math.log10(t))),
	);
	const bx = $derived(wide ? ax + S + 40 : 0);
	const by = $derived(wide ? 0 : head + S + 56);
	const row = $derived(print ? 17 : 20);
	const split = 8;
	const btop = $derived(by + 42);
	const rowY = (j: number) => btop + row * j + (j ? split : 0);
	const T = $derived(wide ? Math.max(S, rowY(rows.length) - head - 40) : S);
	const ly = $derived(scale([0, 1], [head + T, head]));
	const label = $derived(Math.min(need, W - bx - 150));
	const peak = $derived(Math.max(...rows.map((r) => r.top100)));
	const marks = $derived(ticks(0, peak, 3));
	const bxs = $derived(
		scale([0, marks[marks.length - 1]], [bx + label + 10, W - 14]),
	);
	const H = $derived(Math.max(head + T + 40, rowY(rows.length) + 2));

	let hover = $state<string>();
	const move = (event: PointerEvent) => {
		const [px, py] = pointer(event);
		if (py >= btop && px >= bx) {
			hover = rows.find((_, k) => py >= rowY(k) && py < rowY(k) + row)?.view;
			return;
		}
		if (px >= ax && px <= ax + S && py >= head && py <= head + T) {
			hover = near(
				rows,
				(r) => ly(near(r.curve, ([x]) => lx(x), px)?.[1] ?? 0),
				py,
			)?.view;
			return;
		}
		hover = undefined;
	};
	const focus = $derived(hover ?? "all");
	const readout = $derived.by(() => {
		const r = rows.find((x) => x.view === focus) ?? rows[0];
		return [
			r.name,
			say.item(pct(r.top10, 1), pct(r.top100, 1), r.gini.toFixed(3)),
		] as [string, string];
	});
	const line = (curve: [number, number][]) =>
		path(
			curve
				.filter(([x]) => mode === "lorenz" || x >= low)
				.map(([x, y]) => [lx(x), ly(y)]),
		);
</script>

<Frame {print} bind:width {readout}>
	{#snippet controls()}
		<Switch
			options={[
				["top", say.top],
				["lorenz", say.lorenz],
			]}
			bind:value={mode}
		/>
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
		<text x={0} y={14} fill={mute}>{say.axis}</text>
		{#each [0, 0.5, 1] as t (t)}
			<line
				x1={ax}
				x2={ax + S}
				y1={ly(t)}
				y2={ly(t)}
				stroke={t ? faint : hair}
			/>
			<text
				x={ax - 6}
				y={ly(t) + 4}
				fill={mute}
				font-size={small}
				text-anchor="end">{pct(t)}</text
			>
		{/each}
		{#each xt as t (t)}
			<line
				x1={lx(t)}
				x2={lx(t)}
				y1={ly(0)}
				y2={ly(1)}
				stroke={t === xt[0] ? hair : faint}
			/>
			<text
				x={lx(t)}
				y={ly(0) + 17}
				fill={mute}
				font-size={small}
				text-anchor={t === xt[xt.length - 1]
					? "end"
					: t === xt[0]
						? "start"
						: "middle"}
				>{pct(t, Math.max(0, -Math.floor(Math.log10(t || 1)) - 2))}</text
			>
		{/each}
		<text x={ax + S} y={ly(0) + 36} fill={mute} text-anchor="end"
			>{mode === "lorenz" ? say.smallest : say.largest}</text
		>
		{#if mode === "lorenz"}
			<line x1={lx(0)} y1={ly(0)} x2={lx(1)} y2={ly(1)} stroke={hair} />
		{/if}
		{#each rows as r (r.view)}
			{#if r.view !== focus}
				<path d={line(r.curve)} fill="none" stroke={hair} />
			{/if}
		{/each}
		{#each rows.filter((r) => r.view === focus) as r (r.view)}
			<path d={line(r.curve)} fill="none" stroke={ink} stroke-width={1.75} />
		{/each}

		<text x={bx} y={by + 34} fill={mute}>{words.area}</text>
		<circle cx={bxs(0) + 4} cy={by + 9.5} r={3.5} fill={ink} />
		<text x={bxs(0) + 12} y={by + 14} fill={mute}>{say.top10}</text>
		<circle cx={bxs(0) + 74} cy={by + 9.5} r={3.5} fill="#fff" stroke={ink} />
		<text x={bxs(0) + 82} y={by + 14} fill={mute}>{say.top100}</text>
		{#each marks as t (t)}
			<line
				x1={bxs(t)}
				x2={bxs(t)}
				y1={btop - 4}
				y2={rowY(rows.length)}
				stroke={t ? faint : hair}
			/>
			<text
				x={bxs(t)}
				y={by + 34}
				fill={mute}
				font-size={small}
				text-anchor={t ? "middle" : "start"}>{pct(t)}</text
			>
		{/each}
		{#each rows as r, j (r.view)}
			{@const y = rowY(j) + row / 2}
			{@const on = r.view === focus}
			<text x={bx} y={y + 4.5} fill={on || !hover ? ink : mute}
				>{fit(r.name, label)}</text
			>
			<line
				x1={bxs(r.top10)}
				x2={bxs(r.top100)}
				y1={y}
				y2={y}
				stroke={on ? ink : hair}
			/>
			<circle
				cx={bxs(r.top10)}
				cy={y}
				r={3.5}
				fill={on || !hover ? ink : mute}
			/>
			<circle
				cx={bxs(r.top100)}
				cy={y}
				r={3.5}
				fill="#fff"
				stroke={on || !hover ? ink : mute}
			/>
		{/each}
	</svg>
</Frame>
