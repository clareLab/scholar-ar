<script lang="ts">
	import Frame from "../Frame.svelte";
	import {
		faint,
		hair,
		ink,
		land,
		logScale,
		logSpan,
		logTicks,
		mute,
		near,
		page,
		path,
		type Props,
		pct,
		pointer,
		ramp,
		scale,
		size,
		small,
		soft,
		ticks,
	} from "../plot";
	import Switch from "../Switch.svelte";

	let { about, words, print = false }: Props = $props();
	let width = $state(0);
	const W = $derived(print ? page : width);

	const c = $derived(about.countries);
	const say = $derived(words.countries);
	const series = $derived(
		c.series.map((s) => ({ ...s, name: land(words, s.country) })),
	);
	const first = $derived(c.years[0]);
	const last = $derived(c.years[c.years.length - 1]);

	const left = 40;
	const right = $derived(W >= 560 ? 132 : 112);
	const top = 28;
	const tall = $derived(W >= 560 ? 340 : 300);
	const H = $derived(top + tall + 26);
	const pooled = (key: string) => key === "other" || key === "";
	const moved = (share: number[]) =>
		Math.abs(share[share.length - 1] - share[0]);
	const movers = $derived(
		series
			.filter((s) => !pooled(s.country))
			.sort((a, b) => moved(b.share) - moved(a.share))
			.slice(0, 2)
			.map((s) => s.country),
	);
	const tone = (key: string) =>
		key === movers[0] ? ink : key === movers[1] ? ramp[1] : undefined;
	const drawn = $derived(
		[...series].sort(
			(a, b) =>
				Number(hover ? a.country === hover.key : !!tone(a.country)) -
				Number(hover ? b.country === hover.key : !!tone(b.country)),
		),
	);
	const peak = $derived(Math.max(...series.flatMap((s) => s.share)));
	let mode = $state<"log" | "linear">("log");
	const span = $derived(
		logSpan(series.flatMap((s) => s.share).filter((v) => v > 0)),
	);
	const yt = $derived(
		mode === "log" ? logTicks(span[0], span[1]) : ticks(0, peak, 5),
	);
	const x = $derived(scale([first, last], [left, W - right]));
	const y = $derived(
		mode === "log"
			? (v: number) => logScale(span, [top + tall, top])(Math.max(v, span[0]))
			: scale([0, yt[yt.length - 1]], [top + tall, top]),
	);
	const xt = $derived(c.years.filter((year) => year % 5 === 0));

	const labels = $derived.by(() => {
		const out = series
			.map((s) => ({
				key: s.country,
				name: s.name,
				end: y(s.share[s.share.length - 1]),
				y: y(s.share[s.share.length - 1]) + 4,
			}))
			.sort((a, b) => a.y - b.y);
		const step = 16;
		for (let k = 1; k < out.length; k++)
			out[k].y = Math.max(out[k].y, out[k - 1].y + step);
		out[out.length - 1].y = Math.min(out[out.length - 1].y, top + tall);
		for (let k = out.length - 2; k >= 0; k--)
			out[k].y = Math.min(out[k].y, out[k + 1].y - step);
		const edge = W - right;
		return out.map((l) => ({
			...l,
			lead: path([
				[edge + 1, l.end],
				[edge + 5, l.y - 4],
				[edge + 7, l.y - 4],
			]),
		}));
	});

	let hover = $state<{ key: string; year: number }>();
	const move = (event: PointerEvent) => {
		const [px, py] = pointer(event);
		const year = near(c.years, (yr) => x(yr), px) as number;
		const k = c.years.indexOf(year);
		const hit =
			px > W - right
				? near(labels, (l) => l.y - 4, py)?.key
				: near(series, (s) => y(s.share[k]), py)?.country;
		hover = hit === undefined ? undefined : { key: hit, year };
	};
	const readout = $derived.by(() => {
		const at = hover ?? { key: series[0].country, year: last };
		const s = series.find((x) => x.country === at.key) ?? series[0];
		const k = c.years.indexOf(at.year);
		return say.item(s.name, at.year, pct(s.share[k], 1));
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
		{#each yt as t (t)}
			<line
				x1={left}
				x2={W - right}
				y1={y(t)}
				y2={y(t)}
				stroke={t === yt[0] ? hair : faint}
			/>
			<text
				x={left - 6}
				y={y(t) + 4}
				fill={mute}
				font-size={small}
				text-anchor="end"
				>{pct(t, t ? Math.max(0, -Math.floor(Math.log10(t)) - 2) : 0)}</text
			>
		{/each}
		{#each xt as t (t)}
			<text
				x={x(t)}
				y={top + tall + 19}
				fill={mute}
				font-size={small}
				text-anchor="middle">{t}</text
			>
		{/each}
		{#each drawn as s (s.country)}
			{@const on = hover?.key === s.country}
			{@const lead = hover ? undefined : tone(s.country)}
			<path
				d={path(s.share.map((v, k) => [x(c.years[k]), y(v)]))}
				fill="none"
				stroke={on ? ink : hover ? hair : (lead ?? soft)}
				stroke-width={on || lead ? 2 : 1}
				stroke-dasharray={pooled(s.country) && !on ? "3 3" : undefined}
			/>
		{/each}
		{#each labels as l (l.key)}
			<path d={l.lead} fill="none" stroke={hair} />
			<text
				x={W - right + 10}
				y={l.y}
				font-size={small}
				fill={hover
					? hover.key === l.key
						? ink
						: mute
					: (tone(l.key) ?? mute)}>{l.name}</text
			>
		{/each}
		{#if hover}
			{@const s = series.find((x) => x.country === hover?.key)}
			{#if s}
				<circle
					cx={x(hover.year)}
					cy={y(s.share[c.years.indexOf(hover.year)])}
					r={3.5}
					fill={ink}
				/>
			{/if}
		{/if}
	</svg>
</Frame>
