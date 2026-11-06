<script lang="ts">
	import Frame from "../Frame.svelte";
	import {
		faint,
		fit,
		grouped,
		hair,
		ink,
		logScale,
		logSpan,
		logTicks,
		measure,
		mute,
		named,
		page,
		type Props,
		pointer,
		room,
		scale,
		short,
		size,
		small,
		soft,
		ticks,
	} from "../plot";

	let { about, words, print = false }: Props = $props();
	let width = $state(0);
	const W = $derived(print ? page : width);

	const ex = $derived(about.scaling.example);
	const say = $derived(words.scaling);
	const rows = $derived(
		[...about.scaling.rows]
			.sort((a, b) => b.slope - a.slope)
			.map((r) => ({ ...r, name: named(about, r.view) })),
	);

	const wide = $derived(W >= 600);
	const ax = 40;
	const head = 26;
	const need = $derived(
		room(
			rows.map((r) => r.name),
			Number.POSITIVE_INFINITY,
		),
	);
	const S = $derived(
		wide ? Math.max(180, Math.min(300, W - ax - 40 - need - 160)) : W - ax,
	);
	const fx = $derived(logSpan(ex.points.map(([, , f]) => f)));
	const line = $derived(about.scaling.rows.find((r) => r.view === ex.view));
	const predict = (f: number) =>
		line ? Math.exp(line.intercept + line.slope * Math.log(f)) : f;
	const fy = $derived(
		logSpan([...ex.points.map(([, c]) => c), ...fx.map(predict)]),
	);
	const x = $derived(logScale(fx, [ax, ax + S]));
	const y = $derived(logScale(fy, [head + S, head]));

	const sparse = (ts: number[]) =>
		ts.length > 6 ? ts.filter((_, k) => (ts.length - 1 - k) % 2 === 0) : ts;
	const fitted = $derived(fx.map((f) => [x(f), y(predict(f))]));

	const bx = $derived(wide ? ax + S + 40 : 0);
	const by = $derived(wide ? 0 : head + S + 56);
	const btop = $derived(by + 42);
	const row = $derived(print ? 17 : 20);
	const label = $derived(Math.min(need, W - bx - 150));
	const marks = $derived(ticks(0, Math.max(...rows.map((r) => r.slope)), 3));
	const sx = $derived(
		scale([0, marks[marks.length - 1]], [bx + label + 10, W - 14]),
	);
	const H = $derived(Math.max(head + S + 40, btop + row * rows.length + 2));
	const tag = $derived.by(() => {
		if (!line) return undefined;
		const f = fx[0] * (fx[1] / fx[0]) ** 0.55;
		const angle =
			(Math.atan2(y(predict(f * 1.01)) - y(predict(f)), x(f * 1.01) - x(f)) *
				180) /
			Math.PI;
		const full = say.fit(grouped(line.n), line.slope.toFixed(2));
		const text =
			measure(full, small) < S * 0.8 ? full : say.short(line.slope.toFixed(2));
		return { x: x(f), y: y(predict(f)), angle, text };
	});

	let hover = $state<{ point?: number; view?: string }>();
	const move = (event: PointerEvent) => {
		const [px, py] = pointer(event);
		if (px >= bx && py >= btop) {
			const j = Math.floor((py - btop) / row);
			hover = rows[j] && { view: rows[j].view };
			return;
		}
		let best = -1;
		let gap = 144;
		ex.points.forEach(([, c, f], k) => {
			const d = (x(f) - px) ** 2 + (y(c) - py) ** 2;
			if (d < gap) {
				gap = d;
				best = k;
			}
		});
		hover = best >= 0 ? { point: best } : undefined;
	};
	const readout = $derived.by(() => {
		if (hover?.point !== undefined) {
			const [name, c, f] = ex.points[hover.point];
			return [
				name,
				say.point(c.toFixed(2), f.toFixed(2), (c / f).toFixed(2)),
			] as [string, string];
		}
		const r = rows.find((r) => r.view === (hover?.view ?? ex.view)) ?? rows[0];
		return [
			r.name,
			say.row(r.slope.toFixed(2), r.r2.toFixed(2), grouped(r.n)),
		] as [string, string];
	});
</script>

<Frame {print} bind:width {readout}>
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
		<text x={0} y={14} fill={mute}>{say.count(named(about, ex.view))}</text>
		{#each sparse(logTicks(fy[0], fy[1])) as t (t)}
			<line x1={ax} x2={ax + S} y1={y(t)} y2={y(t)} stroke={faint} />
			<text
				x={ax - 6}
				y={y(t) + 4}
				fill={mute}
				font-size={small}
				text-anchor="end">{short(t)}</text
			>
		{/each}
		{#each sparse(logTicks(fx[0], fx[1])) as t (t)}
			<line x1={x(t)} x2={x(t)} y1={head} y2={head + S} stroke={faint} />
			<text
				x={x(t)}
				y={head + S + 17}
				fill={mute}
				font-size={small}
				text-anchor="middle">{short(t)}</text
			>
		{/each}
		<text x={ax + S} y={head + S + 36} fill={mute} text-anchor="end"
			>{say.authors}</text
		>
		{#each ex.points as [, c, f], k (k)}
			<circle
				cx={x(f)}
				cy={y(c)}
				r={2.4}
				fill={hover?.point === k ? ink : soft}
				opacity={0.8}
			/>
		{/each}
		{#if line}
			<line
				x1={fitted[0][0]}
				y1={fitted[0][1]}
				x2={fitted[1][0]}
				y2={fitted[1][1]}
				stroke={ink}
				stroke-width={1.25}
			/>
		{/if}
		{#if tag && line}
			<text
				x={tag.x}
				y={tag.y}
				dy={-6}
				text-anchor="middle"
				font-size={small}
				stroke="#fff"
				stroke-width={3}
				paint-order="stroke"
				transform="rotate({tag.angle} {tag.x} {tag.y})">{tag.text}</text
			>
		{/if}
		{#if hover?.point !== undefined}
			{@const [, c, f] = ex.points[hover.point]}
			<circle cx={x(f)} cy={y(c)} r={4} fill={ink} />
		{/if}

		<text x={bx} y={by + 34} fill={mute}>{words.area}</text>
		<text x={sx(0)} y={by + 14} fill={mute}>{say.slope}</text>
		{#each marks as t (t)}
			<line
				x1={sx(t)}
				x2={sx(t)}
				y1={btop - 4}
				y2={btop + row * rows.length}
				stroke={t && t !== 1 ? faint : hair}
			/>
			<text
				x={sx(t)}
				y={by + 34}
				fill={mute}
				font-size={small}
				text-anchor={t ? "middle" : "start"}>{t}</text
			>
		{/each}
		{#each rows as r, j (r.view)}
			{@const yy = btop + row * j + row / 2}
			{@const on = hover?.view ? hover.view === r.view : r.view === ex.view}
			<text x={bx} y={yy + 4.5} fill={on || !hover?.view ? ink : mute}
				>{fit(r.name, label)}</text
			>
			<line
				x1={sx(0)}
				x2={sx(r.slope)}
				y1={yy}
				y2={yy}
				stroke={on ? ink : hair}
			/>
			<circle cx={sx(r.slope)} cy={yy} r={3.5} fill={on ? ink : soft} />
		{/each}
	</svg>
</Frame>
