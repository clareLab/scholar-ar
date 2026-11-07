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
		wrap,
	} from "../plot";

	let { about, words, print = false }: Props = $props();
	let width = $state(0);
	const W = $derived(print ? page : width);

	const say = $derived(words.scaling);
	const ex = $derived(about.scaling.example);
	const fit0 = $derived(
		about.scaling.rows.find((r) => r.view === ex.view) ?? about.scaling.rows[0],
	);
	const predict = (a: number) =>
		Math.exp(fit0.intercept + fit0.slope * Math.log(a));
	const signed = (x: number) =>
		x < 0 ? `−${(-x).toFixed(2)}` : `+${x.toFixed(2)}`;

	const rows = $derived.by(() => {
		const list = about.scaling.rows.map((r) => ({
			...r,
			name: named(about, r.view),
		}));
		const [all, ...rest] = [
			...list.filter((r) => r.view === "all"),
			...list.filter((r) => r.view !== "all"),
		];
		return [all, ...rest.sort((a, b) => b.slope - a.slope)];
	});
	const bins = $derived(ex.bins);
	const top = $derived(about.scaling.top);

	const wide = $derived(W >= 600);
	const ax = 44;
	const head = 28;
	const row = $derived(print ? 17 : 19);
	const split = 8;
	const label = $derived(
		Math.min(
			room(
				rows.map((r) => r.name),
				Number.POSITIVE_INFINITY,
			),
			wide ? 178 : W * 0.5,
		),
	);
	const rw = $derived(label + 14 + Math.max(120, W * 0.17));
	const bx = $derived(wide ? W - rw : 0);
	const S = $derived(wide ? bx - 40 - ax : W - ax);
	const tall = $derived(
		wide
			? Math.min(
					1.3 * S,
					Math.max(S, 42 + row * rows.length + split - head - 79),
				)
			: Math.min(1.3 * S, 420),
	);

	const fx = $derived(
		logSpan([
			...ex.points.map(([, , a]) => a),
			...bins.map((b) => b.lo),
			...bins.map((b) => b.hi),
		]),
	);
	const fy = $derived(
		logSpan([
			...ex.points.map(([, c]) => c),
			...bins.filter((b) => b.mean > 0).map((b) => b.mean),
			...top.map((t) => t.count),
		]),
	);
	const x = $derived(logScale(fx, [ax, ax + S]));
	const y = $derived(logScale(fy, [head + tall, head]));
	const decades = (lo: number, hi: number) => {
		const out: number[] = [];
		const last = Math.floor(Math.log10(hi) + 1e-9);
		for (let e = Math.ceil(Math.log10(lo) - 1e-9); e <= last; e++)
			out.push(10 ** e);
		return out;
	};
	const xt = $derived(decades(fx[0], fx[1]));
	const yt = $derived(decades(fy[0], fy[1]));
	const every = (ts: number[], room: number) =>
		Math.max(1, Math.ceil((ts.length * 34) / room));
	const xEvery = $derived(every(xt, S));
	const yEvery = $derived(every(yt, tall * 1.6));
	const shown = (t: number, k: number) => Math.round(Math.log10(t)) % k === 0;
	const tick = (t: number) => (t < 1 ? `${+t.toPrecision(1)}` : short(t));

	const strip = 26;
	const sTop = $derived(head + tall + 14);
	const sBottom = $derived(sTop + strip);
	const xLabels = $derived(sBottom + 17);
	const scatterH = $derived(xLabels + 22);

	const solve = (c: number) =>
		Math.exp((Math.log(c) - fit0.intercept) / fit0.slope);
	const line = $derived(
		[Math.max(fx[0], solve(fy[0])), Math.min(fx[1], solve(fy[1]))].map((a) => [
			x(a),
			y(predict(a)),
		]),
	);
	const tag = $derived({
		x: line[0][0] + 10,
		y: head + tall - 7,
		text: say.expected(fit0.slope.toFixed(2)),
	});

	const label0 = $derived(
		Math.min(
			room(
				top.map((t) => t.name),
				Number.POSITIVE_INFINITY,
				small,
			),
			S * 0.62,
		),
	);
	const marks = $derived.by(() => {
		return top
			.map((t, k) => ({ k, x: x(t.authors), y: y(t.count) }))
			.sort((a, b) => a.y - b.y)
			.map((m, j) => ({ ...m, ly: head + 14 + 16 * j }));
	});
	const lx = $derived(
		wide ? Math.min(...marks.map((m) => m.x)) - 26 : ax + 8 + label0,
	);

	const by = $derived(wide ? 0 : scatterH + 30);
	const btop = $derived(by + 42);
	const lift = 15;
	const names = $derived(rows.map((r) => wrap(r.name, label)));
	const heights = $derived(names.map((n) => row + (n.length - 1) * lift));
	const tops = $derived.by(() => {
		const out = [btop];
		heights.forEach((h, j) => out.push(out[j] + h + (j ? 0 : split)));
		return out;
	});
	const rowY = (j: number) => tops[j];
	const domain = $derived.by(() => {
		const all = rows.map((r) => r.slope);
		return [
			Math.floor(10 * Math.min(1, ...all)) / 10,
			Math.ceil(10 * Math.max(1, ...all)) / 10,
		];
	});
	const range = $derived.by(() => {
		const step = domain[1] - domain[0] > 1 ? 0.5 : 0.2;
		const out: number[] = [];
		for (
			let t = Math.ceil(domain[0] / step - 1e-9) * step;
			t <= domain[1] + 1e-9;
			t += step
		)
			out.push(+t.toFixed(1));
		return out;
	});
	const sx = $derived(scale(domain, [bx + label + 14, W - 8]));
	const H = $derived(Math.max(scatterH, rowY(rows.length) + 2));

	let hover = $state<
		{ point: number } | { top: number } | { bin: number } | { view: string }
	>();
	const move = (event: PointerEvent) => {
		const [px, py] = pointer(event);
		if (px >= bx && py >= btop && (wide || py >= by)) {
			const j = rows.findIndex(
				(_, k) => py >= rowY(k) && py < rowY(k) + heights[k],
			);
			hover = j >= 0 ? { view: rows[j].view } : undefined;
			return;
		}
		if (py >= sTop - 2 && py <= sBottom + 2) {
			const j = bins.findIndex((b) => px >= x(b.lo) && px < x(b.hi));
			hover = j >= 0 ? { bin: j } : undefined;
			return;
		}
		let best: typeof hover;
		let gap = 100;
		const near = (cx: number, cy: number, what: typeof hover, r = 0) => {
			const d = (cx - px) ** 2 + (cy - py) ** 2 - r;
			if (d < gap) {
				gap = d;
				best = what;
			}
		};
		ex.points.forEach(([, c, a], k) => near(x(a), y(c), { point: k }));
		bins.forEach((b, k) => {
			if (b.mean > 0)
				near(x(Math.sqrt(b.lo * b.hi)), y(b.mean), { bin: k }, 20);
		});
		top.forEach((t, k) => near(x(t.authors), y(t.count), { top: k }, 40));
		hover = best;
	};
	const readout = $derived.by((): string | [string, string] => {
		const h = hover;
		if (h && "point" in h) {
			const [name, c, a] = ex.points[h.point];
			const e = predict(a);
			return [
				name,
				say.point(c.toFixed(2), a.toFixed(2), e.toFixed(2), signed(c - e)),
			];
		}
		if (h && "top" in h) {
			const t = top[h.top];
			return [
				t.name,
				say.point(
					t.count.toFixed(2),
					t.authors.toFixed(2),
					t.expected.toFixed(2),
					signed(t.excess),
				),
			];
		}
		if (h && "bin" in h) {
			const b = bins[h.bin];
			return say.bin(
				tick(b.lo),
				tick(b.hi),
				grouped(b.n),
				grouped(b.zeros),
				b.mean < 1 ? b.mean.toPrecision(2) : b.mean.toFixed(2),
			);
		}
		const view = h && "view" in h ? h.view : ex.view;
		const r = rows.find((r) => r.view === view) ?? rows[0];
		return [r.name, say.row(r.slope.toFixed(2), grouped(r.n))];
	});
	const point = $derived(hover && "point" in hover ? hover.point : -1);
	const bin = $derived(hover && "bin" in hover ? hover.bin : -1);
	const lead = $derived(hover && "top" in hover ? hover.top : -1);
	const view = $derived(hover && "view" in hover ? hover.view : undefined);
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
		<text x={0} y={14} fill={mute}>{say.count}</text>
		<g transform="translate({ax + S - measure(say.mean, small) - 14} 10)">
			<rect
				x={-3.5}
				y={-3.5}
				width={7}
				height={7}
				fill={ink}
				transform="rotate(45)"
			/>
			<text x={10} y={4} fill={mute} font-size={small}>{say.mean}</text>
		</g>
		{#each yt as t (t)}
			<line x1={ax} x2={ax + S} y1={y(t)} y2={y(t)} stroke={faint} />
			{#if shown(t, yEvery)}
				<text
					x={ax - 6}
					y={y(t) + 4}
					fill={mute}
					font-size={small}
					text-anchor="end">{tick(t)}</text
				>
			{/if}
		{/each}
		{#each xt as t (t)}
			<line x1={x(t)} x2={x(t)} y1={head} y2={head + tall} stroke={faint} />
			{#if shown(t, xEvery)}
				<text
					x={x(t)}
					y={xLabels}
					fill={mute}
					font-size={small}
					text-anchor="middle">{tick(t)}</text
				>
			{/if}
		{/each}
		<line x1={ax} x2={ax + S} y1={head + tall} y2={head + tall} stroke={hair} />
		<text x={ax + S} y={xLabels + 20} fill={mute} text-anchor="end"
			>{say.authors}</text
		>

		{#each ex.points as [, c, a], k (k)}
			{@const above = c >= predict(a)}
			<circle
				cx={x(a)}
				cy={y(c)}
				r={2.3}
				fill={above ? mute : "#fff"}
				stroke={above ? "none" : soft}
				opacity={above ? 0.7 : 1}
			/>
		{/each}
		<line
			x1={line[0][0]}
			y1={line[0][1]}
			x2={line[1][0]}
			y2={line[1][1]}
			stroke={ink}
			stroke-width={1.5}
		/>
		<text
			x={tag.x}
			y={tag.y}
			font-size={small}
			stroke="#fff"
			stroke-width={3}
			paint-order="stroke">{tag.text}</text
		>
		{#each bins as b, k (k)}
			{#if b.mean > 0}
				{@const cx = x(Math.sqrt(b.lo * b.hi))}
				{@const cy = y(b.mean)}
				<rect
					x={cx - 3.5}
					y={cy - 3.5}
					width={7}
					height={7}
					fill={bin === k ? "#fff" : ink}
					stroke={bin === k ? ink : "#fff"}
					stroke-width={1}
					transform="rotate(45 {cx} {cy})"
				/>
			{/if}
		{/each}
		{#each marks as m (m.k)}
			{@const t = top[m.k]}
			<path
				d="M{m.x - 5},{m.y}L{lx + 4},{m.ly - 4}L{lx},{m.ly - 4}"
				fill="none"
				stroke={hair}
			/>
			<circle
				cx={m.x}
				cy={m.y}
				r={3.5}
				fill={ink}
				stroke="#fff"
				stroke-width={1}
			/>
			<text
				x={wide ? lx - 3 : ax + 8}
				y={m.ly}
				text-anchor={wide ? "end" : "start"}
				font-size={small}
				fill={lead < 0 || lead === m.k ? ink : mute}
				stroke="#fff"
				stroke-width={3}
				paint-order="stroke"
				>{fit(t.name, wide ? lx - ax - 8 : label0, small)}</text
			>
		{/each}
		{#if point >= 0}
			{@const [, c, a] = ex.points[point]}
			<circle cx={x(a)} cy={y(c)} r={4} fill={ink} />
		{/if}

		{#each bins as b, k (k)}
			{@const h = (strip * b.zeros) / b.n}
			<rect
				x={x(b.lo) + 0.5}
				y={sBottom - h}
				width={Math.max(0, x(b.hi) - x(b.lo) - 1)}
				height={h}
				fill={bin === k ? ink : soft}
			/>
		{/each}
		<line x1={ax} x2={ax + S} y1={sBottom} y2={sBottom} stroke={hair} />
		<text
			x={ax - 6}
			y={sTop + 8}
			fill={mute}
			font-size={small}
			text-anchor="end">100%</text
		>
		<text
			x={ax - 6}
			y={sBottom + 1}
			fill={mute}
			font-size={small}
			text-anchor="end">0%</text
		>
		<text
			x={ax + S}
			y={sTop + 8}
			fill={mute}
			font-size={small}
			text-anchor="end">{say.zeros}</text
		>

		<text x={bx} y={by + 34} fill={mute}>{words.area}</text>
		<text x={sx(range[0])} y={by + 14} fill={mute}>{say.beta}</text>
		{#each range as t (t)}
			<line
				x1={sx(t)}
				x2={sx(t)}
				y1={btop - 4}
				y2={rowY(rows.length)}
				stroke={t === 1 ? mute : faint}
				stroke-width={t === 1 ? 0.8 : 1}
			/>
			<text
				x={sx(t)}
				y={by + 34}
				fill={mute}
				font-size={small}
				text-anchor="middle">{t.toFixed(1)}</text
			>
		{/each}
		{#each rows as r, j (r.view)}
			{@const yy = rowY(j) + heights[j] / 2}
			{@const on = view ? view === r.view : r.view === ex.view}
			{#each names[j] as part, l (l)}
				<text
					x={bx}
					y={yy + 4.5 + (l - (names[j].length - 1) / 2) * lift}
					fill={on || !view ? ink : mute}>{part}</text
				>
			{/each}
			<line
				x1={sx(1)}
				x2={sx(r.slope)}
				y1={yy}
				y2={yy}
				stroke={on ? ink : hair}
			/>
			<circle cx={sx(r.slope)} cy={yy} r={3.5} fill={on ? ink : mute} />
		{/each}
	</svg>
</Frame>
