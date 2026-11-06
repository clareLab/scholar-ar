<script lang="ts">
	import Frame from "../Frame.svelte";
	import {
		faint,
		fit,
		grouped,
		hair,
		ink,
		logScale,
		logTicks,
		measure,
		mute,
		near,
		page,
		path,
		type Props,
		pct,
		pointer,
		ramp,
		scale,
		short,
		size,
		small,
		ticks,
	} from "../plot";
	import Switch from "../Switch.svelte";

	let { about, words, print = false }: Props = $props();
	let width = $state(0);
	const W = $derived(print ? page : width);

	const ex = $derived(about.tier_example);
	const say = $derived(words.tiers);
	const tierOf = (rank: number) => 1 + ex.cuts.filter((c) => rank > c).length;
	const guides = [
		[1 / 27, "1/27"],
		[1 / 9, "1/9"],
		[1 / 3, "1/3"],
	] as const;

	const counts = $derived(
		[0, ...ex.cuts].map((from, k) => [...ex.cuts, ex.pool][k] - from),
	);
	let mode = $state<"log" | "linear">("log");
	const top = 26;
	const tall = $derived(print ? 200 : W >= 560 ? 240 : 200);
	const strip = 5;
	const axis = $derived(top + tall + strip + 19);
	const keys = $derived.by(() => {
		const out = counts.map((n, k) => {
			const text = `T${k + 1} ${grouped(n)}`;
			return { text, w: 14 + measure(text, small), x: 0, y: 0 };
		});
		const wide = out.reduce((s, k) => s + k.w + 16, 0) + 8;
		let [at, row] = [
			0,
			wide + measure(say.ranked) <= W ? axis + 19 : axis + 39,
		];
		for (const key of out) {
			if (at && at + key.w > W) [at, row] = [0, row + 20];
			[key.x, key.y, at] = [at, row, at + key.w + 16];
		}
		return out;
	});
	const listTop = $derived((keys.at(-1)?.y ?? axis) + 27);
	const cols = $derived(Math.max(1, Math.min(3, Math.floor((W + 24) / 344))));
	const named = $derived(ex.named);
	const rows = $derived(Math.ceil(named.length / cols));
	const entry = $derived(print ? 17 : 19);
	const H = $derived(listTop + 24 + rows * entry);

	const floor = $derived(
		10 **
			Math.floor(
				Math.log10(
					Math.min(...ex.curve.map(([, s]) => s).filter((s) => s > 0)),
				),
			),
	);
	const yt = $derived(mode === "log" ? logTicks(floor, 1) : [0, 0.5, 1]);
	const percent = (t: number) =>
		pct(t, Math.max(0, -Math.round(Math.log10(t || 1)) - 2));
	const left = $derived(
		Math.ceil(Math.max(...yt.map((t) => measure(percent(t), small)))) + 10,
	);
	const x = $derived(
		mode === "log"
			? logScale([1, ex.pool], [left, W])
			: scale([0, ex.pool], [left, W]),
	);
	const y = $derived(
		mode === "log"
			? (s: number) =>
					logScale([floor, 1], [top + tall, top])(Math.max(s, floor))
			: scale([0, 1], [top + tall, top]),
	);
	const xt = $derived(
		mode === "log" ? logTicks(1, ex.pool) : ticks(0, ex.pool, 5),
	);

	const pieces = $derived(
		[1, 2, 3, 4].map((t) => {
			const pts = ex.curve.filter(([r]) => {
				const k = tierOf(r);
				return k === t || (k === t + 1 && r === ex.cuts[t - 1] + 1);
			});
			const prev = ex.curve.filter(([r]) => r <= (ex.cuts[t - 2] ?? 0)).at(-1);
			return {
				t,
				d: path((prev ? [prev, ...pts] : pts).map(([r, s]) => [x(r), y(s)])),
			};
		}),
	);
	const bands = $derived(
		[0, ...ex.cuts].map((from, k) => {
			const a = x(Math.max(from, mode === "log" ? 1 : 0));
			const b = x([...ex.cuts, ex.pool][k]);
			const label = measure(`T${k + 1}`, small) + 8 <= b - a;
			return { t: k + 1, a, b, label };
		}),
	);

	const colW = $derived((W - 24 * (cols - 1)) / cols);
	const cell = (j: number) => ({
		x: Math.floor(j / rows) * (colW + 24),
		y: listTop + 24 + (j % rows) * entry,
	});
	const rankW = $derived(measure(grouped(ex.cuts[0]), size) + 4);
	const massW = $derived(
		Math.max(
			measure(say.mass, size),
			measure(named[0]?.mass.toFixed(1) ?? "", size),
		) + 4,
	);
	const phiX = $derived(colW - massW - 16);

	let hover = $state<number>();
	const move = (event: PointerEvent) => {
		const [px, py] = pointer(event);
		if (py <= axis && px >= left) {
			const rank = near(ex.curve, ([r]) => x(r), px)?.[0];
			hover = rank;
			return;
		}
		if (py > listTop + 24) {
			const c = Math.floor(px / (colW + 24));
			const r = Math.floor((py - listTop - 24) / entry);
			const j = c * rows + r;
			hover = j < named.length && r < rows ? named[j].rank : undefined;
			return;
		}
		hover = undefined;
	};

	const share = (rank: number) =>
		ex.curve.find(([r]) => r === rank)?.[1] ??
		near(ex.curve, ([r]) => r, rank)?.[1] ??
		0;

	const readout = $derived.by(() => {
		if (hover === undefined)
			return say.idle(
				grouped(ex.pool),
				grouped(ex.cuts[0]),
				grouped(ex.cuts[1]),
				grouped(ex.cuts[2]),
			);
		const v = [ex.lead, ...ex.named].find((n) => n.rank === hover);
		const tail = say.tail(share(hover).toFixed(4));
		if (!v) return say.at(grouped(hover), tierOf(hover), tail);
		return [
			`${grouped(hover)}. ${v.name}`,
			say.named(v.phi.toFixed(2), v.mass.toFixed(1), v.tier, tail),
		] as [string, string];
	});
</script>

<Frame {print} bind:width {readout}>
	{#snippet controls()}
		<Switch
			options={[
				["log", words.log],
				["linear", words.linear],
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
		<text x={W} y={axis + 19} fill={mute} text-anchor="end">{say.ranked}</text>
		{#each keys as key, k (k)}
			<rect x={key.x} y={key.y - 9} width={9} height={9} fill={ramp[k]} />
			<text x={key.x + 14} y={key.y} font-size={small} fill={mute}
				>{key.text}</text
			>
		{/each}
		{#each yt as t (t)}
			<line x1={left} x2={W} y1={y(t)} y2={y(t)} stroke={faint} />
			<text
				x={left - 6}
				y={y(t) + 4}
				fill={mute}
				font-size={small}
				text-anchor="end">{percent(t)}</text
			>
		{/each}
		{#each guides as [g, label] (label)}
			<line
				x1={left}
				x2={W}
				y1={y(g)}
				y2={y(g)}
				stroke={mute}
				stroke-width={0.6}
			/>
			<text
				x={mode === "log" ? left + 6 : W}
				y={y(g) - 4}
				text-anchor={mode === "log" ? "start" : "end"}
				font-size={small}>{label}</text
			>
		{/each}
		{#each ex.cuts as c, k (k)}
			<line
				x1={x(c)}
				x2={x(c)}
				y1={top}
				y2={top + tall}
				stroke={mute}
				stroke-width={0.6}
			/>
		{/each}
		{#each pieces as p (p.t)}
			<path d={p.d} fill="none" stroke={ramp[p.t - 1]} stroke-width={2} />
		{/each}
		{#each bands as b (b.t)}
			<rect
				x={b.a}
				y={top + tall + 2}
				width={Math.max(0, b.b - b.a)}
				height={strip}
				fill={ramp[b.t - 1]}
			/>
			{#if b.label}
				<text
					x={(b.a + b.b) / 2}
					y={mode === "log" ? top + tall - 6 : top + 16}
					text-anchor="middle"
					font-size={small}
					fill={mute}>T{b.t}</text
				>
			{/if}
		{/each}
		{#each xt as t (t)}
			<text
				x={x(Math.max(t, mode === "log" ? 1 : 0))}
				y={axis}
				fill={mute}
				font-size={small}
				text-anchor="middle">{short(t)}</text
			>
		{/each}
		{#if hover !== undefined}
			<circle cx={x(hover)} cy={y(share(hover))} r={3.5} fill={ink} />
		{/if}
		{#each Array(cols) as _, c (c)}
			<text
				x={c * (colW + 24) + rankW}
				y={listTop + 14}
				fill={mute}
				text-anchor="end">{say.rank}</text
			>
			<text x={c * (colW + 24) + rankW + 10} y={listTop + 14} fill={mute}
				>{say.venue}</text
			>
			<text
				x={c * (colW + 24) + phiX}
				y={listTop + 14}
				fill={mute}
				text-anchor="end">φ</text
			>
			<text
				x={c * (colW + 24) + colW}
				y={listTop + 14}
				fill={mute}
				text-anchor="end">{say.mass}</text
			>
			<line
				x1={c * (colW + 24)}
				x2={c * (colW + 24) + colW}
				y1={listTop + 20.5}
				y2={listTop + 20.5}
				stroke={hair}
			/>
		{/each}
		{#each named as v, j (j)}
			{@const at = cell(j)}
			{@const on = hover === undefined || hover === v.rank}
			<text
				x={at.x + rankW}
				y={at.y + entry / 2 + 4.5}
				text-anchor="end"
				fill={mute}>{grouped(v.rank)}</text
			>
			<text
				x={at.x + rankW + 10}
				y={at.y + entry / 2 + 4.5}
				fill={on ? ink : mute}>{fit(v.name, phiX - rankW - 10 - 52)}</text
			>
			<text
				x={at.x + phiX}
				y={at.y + entry / 2 + 4.5}
				text-anchor="end"
				fill={on ? ink : mute}>{v.phi.toFixed(2)}</text
			>
			<text
				x={at.x + colW}
				y={at.y + entry / 2 + 4.5}
				text-anchor="end"
				fill={on ? ink : mute}>{v.mass.toFixed(1)}</text
			>
		{/each}
	</svg>
</Frame>
