<script lang="ts">
	import Frame from "../Frame.svelte";
	import {
		faint,
		fit,
		hair,
		ink,
		measure,
		mute,
		named,
		near,
		page,
		path,
		type Props,
		pointer,
		room,
		scale,
		size,
		small,
		soft,
		ticks,
		wrap,
	} from "../plot";

	let { about, words, print = false }: Props = $props();
	let width = $state(0);
	const W = $derived(print ? page : width);

	const lines = $derived(
		about.stability.map((s) => ({ ...s, name: named(about, s.view) })),
	);
	const marked = $derived([
		"all",
		...lines
			.filter((l) => l.view !== "all")
			.sort((a, b) => a.mean - b.mean)
			.slice(0, 3)
			.map((l) => l.view),
	]);
	const years = $derived(lines[0].rho.map(([year]) => year));
	const values = $derived(lines.flatMap((l) => l.rho.map(([, r]) => r)));
	const yt = $derived(ticks(Math.min(...values), Math.max(...values), 4));
	const say = $derived(words.stability);
	const left = 36;
	const right = $derived(
		room(
			lines.filter((l) => marked.includes(l.view)).map((l) => l.name),
			Math.min(200, Math.round(0.35 * W) - 10),
			small,
		) + 10,
	);
	const text = (name: string) => {
		const lines = wrap(name, right - 10, small);
		return lines.length <= 2
			? lines
			: [lines[0], fit(lines.slice(1).join(" "), right - 10, small)];
	};
	const top = 28;
	const tall = 280;
	const H = top + tall + 26;
	const x = $derived(
		scale([years[0], years[years.length - 1]], [left, W - right]),
	);
	const y = $derived(scale([yt[0], yt[yt.length - 1]], [top + tall, top]));
	const xt = $derived(
		years.filter(
			(year) => year % (x(years[0] + 5) - x(years[0]) >= 40 ? 5 : 10) === 0,
		),
	);

	let hover = $state<{ view: string; year: number }>();
	const move = (event: PointerEvent) => {
		const [px, py] = pointer(event);
		const year = near(years, (yr) => x(yr), px) as number;
		const k = years.indexOf(year);
		const hit = near(lines, (l) => y(l.rho[k][1]), py);
		hover = hit && { view: hit.view, year };
	};
	const focus = $derived(hover?.view ?? "all");
	const end = (l: (typeof lines)[number]) => y(l.rho[l.rho.length - 1][1]);
	const labels = $derived.by(() => {
		const out = lines
			.filter((l) => marked.includes(l.view))
			.map((l) => ({
				view: l.view,
				text: text(l.name),
				end: end(l),
				y: end(l) + 4,
			}))
			.sort((a, b) => a.y - b.y);
		for (let k = 1; k < out.length; k++)
			out[k].y = Math.max(out[k].y, out[k - 1].y + 16 * out[k - 1].text.length);
		const last = out[out.length - 1];
		if (last) last.y = Math.min(last.y, H - 4 - 16 * (last.text.length - 1));
		for (let k = out.length - 2; k >= 0; k--)
			out[k].y = Math.min(out[k].y, out[k + 1].y - 16 * out[k].text.length);
		return out.map((l) => ({
			...l,
			lead: path([
				[W - right + 1, l.end],
				[W - right + 5, l.y - 4],
				[W - right + 7, l.y - 4],
			]),
		}));
	});
	const tone = (view: string) =>
		hover ? (view === focus ? ink : hair) : marked.includes(view) ? ink : soft;
	const readout = $derived.by(() => {
		const l = lines.find((x) => x.view === focus);
		if (!l) return "";
		if (!hover) {
			const mean = l.rho.reduce((s, [, r]) => s + r, 0) / l.rho.length;
			return [
				l.name,
				say.mean(mean.toFixed(3), years[0], years[years.length - 1]),
			] as [string, string];
		}
		const r = l.rho.find(([year]) => year === hover?.year)?.[1] ?? 0;
		return [l.name, say.year(hover.year - 1, hover.year, r.toFixed(3))] as [
			string,
			string,
		];
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
		<text x={0} y={14} fill={mute}
			>{measure(say.axis) <= W ? say.axis : say.short}</text
		>
		{#each yt as t (t)}
			<line x1={left} x2={W - right} y1={y(t)} y2={y(t)} stroke={faint} />
			<text
				x={left - 6}
				y={y(t) + 4}
				fill={mute}
				font-size={small}
				text-anchor="end">{+t.toFixed(2)}</text
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
		{#each [...lines].sort((a, b) => Number(tone(a.view) === ink) - Number(tone(b.view) === ink)) as l (l.view)}
			<path
				d={path(l.rho.map(([year, r]) => [x(year), y(r)]))}
				fill="none"
				stroke={tone(l.view)}
				stroke-width={tone(l.view) === ink
					? l.view === "all" || hover
						? 2
						: 1.5
					: 1}
			/>
		{/each}
		{#each labels as l (l.view)}
			<path d={l.lead} fill="none" stroke={hair} />
			{#each l.text as line, k (k)}
				<text
					x={W - right + 10}
					y={l.y + 16 * k}
					font-size={small}
					fill={!hover || hover.view === l.view ? ink : mute}>{line}</text
				>
			{/each}
		{/each}
		{#each lines.filter((l) => l.view === focus) as l (l.view)}
			{#if hover}
				{@const k = years.indexOf(hover.year)}
				<circle cx={x(l.rho[k][0])} cy={y(l.rho[k][1])} r={3.5} fill={ink} />
			{/if}
		{/each}
	</svg>
</Frame>
