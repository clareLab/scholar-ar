<script lang="ts">
	import Frame from "../Frame.svelte";
	import {
		grouped,
		hair,
		ink,
		measure,
		mute,
		page,
		type Props,
		pointer,
		size,
	} from "../plot";

	let { words, print = false }: Props = $props();
	let width = $state(0);
	const W = $derived(print ? page : width);

	const say = $derived(words.counting);
	const places = ["X", "Y"];
	const authors = ["a", "b", "c"];
	const K = 4;
	let kc = $state(3);
	let ties = $state([
		[true, true],
		[true, false],
		[false, false],
	]);
	const N = $derived(ties.length);

	const gcd = (a: number, b: number): number => (b ? gcd(b, a % b) : a);
	const fraction = (num: number, den: number) => {
		if (!num) return "0";
		const g = gcd(num, den);
		return den / g === 1 ? `${num / g}` : `${num / g}/${den / g}`;
	};

	const den = 2;
	const sums = $derived([
		...places.map((_, c) =>
			ties.reduce((sum, row) => {
				const m = row.filter(Boolean).length;
				return row[c] ? sum + den / m : sum;
			}, 0),
		),
		ties.filter((row) => !row.some(Boolean)).length * den,
	]);
	const table = $derived(
		[...places, say.empty].map((name, c) => {
			const w = Math.round((1e9 * sums[c]) / (N * den));
			return {
				name,
				W: fraction(sums[c], N * den),
				w,
				micro: Math.round((kc * w) / (K * 1000)),
			};
		}),
	);

	const wide = $derived(W >= 560);
	const cellX = (c: number) => 96 + c * 40;
	const rowY = (r: number) => 34 + r * 26;
	const gridH = $derived(rowY(N) + 4);
	const tx = $derived(wide ? Math.max(360, W * 0.48) : 0);
	const ty = $derived(wide ? 0 : gridH + 16);
	const tw = $derived(W - tx);
	const H = $derived(ty + rowY(table.length + 1) + 4);
	const gridW = $derived(Math.min(wide ? 290 : 300, W));
	const cols = $derived.by(() => {
		const most = (texts: string[]) => Math.max(...texts.map((t) => measure(t)));
		const name = most([say.institution, say.empty]);
		const values = [
			most(["W", "1/2", "1/3"]),
			most(["w", grouped(1e9)]),
			most([...say.micro, grouped(750000)]),
		];
		const split = tw - name - values.reduce((a, b) => a + b, 0) < 36;
		if (split) values[2] = most([...say.split, grouped(750000)]);
		const gap = (tw - name - values.reduce((a, b) => a + b, 0)) / 3;
		const r0 = tx + name + gap + values[0];
		const r1 = r0 + gap + values[1];
		return [
			{ head: ["W"], x: r0 },
			{ head: ["w"], x: r1 },
			{ head: split ? say.split : say.micro, x: tx + tw },
		];
	});
	const lift = $derived(cols[2].head.length > 1 ? 17 : 0);

	let hover = $state<[number, number]>();
	const at = (event: PointerEvent): [number, number] | undefined => {
		const [px, py] = pointer(event);
		const r = Math.round((py - 30) / 26);
		const c = Math.round((px - 96) / 40);
		if (r < 0 || r >= N || c < 0 || c >= places.length) return undefined;
		if (Math.abs(px - cellX(c)) > 14 || Math.abs(py - rowY(r) + 4) > 12)
			return undefined;
		return [r, c];
	};
	const flip = (event: PointerEvent) => {
		const hit = at(event);
		if (!hit) return;
		const [r, c] = hit;
		ties = ties.map((row, j) =>
			j === r ? row.map((on, k) => (k === c ? !on : on)) : row,
		);
	};

	const share = (row: boolean[]) => {
		const m = row.filter(Boolean).length;
		return m ? `1/${N * m}` : "";
	};

	const readout = $derived.by(() => {
		if (hover) {
			const [r] = hover;
			const m = ties[r].filter(Boolean).length;
			if (!m) return say.alone(authors[r], N);
			return say.tied(authors[r], m, share(ties[r]));
		}
		return say.idle(N, kc, K);
	});
</script>

<Frame {print} bind:width {readout}>
	{#snippet controls()}
		<label class="slide"
			><i>k</i><sub>c</sub><input
				type="range"
				min="0"
				max={K}
				step="1"
				bind:value={kc}
			/></label
		>
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
		onpointermove={(event) => (hover = at(event))}
		onpointerleave={() => (hover = undefined)}
		onpointerdown={flip}
	>
		<text x={0} y={14} fill={mute}>{say.author}</text>
		{#each places as name, c (name)}
			<text x={cellX(c)} y={14} fill={mute} text-anchor="middle">{name}</text>
		{/each}
		<text x={gridW} y={14} fill={mute} text-anchor="end">{say.per}</text>
		<line x1={0} x2={gridW} y1={20} y2={20} stroke={ink} />
		{#each ties as row, r (r)}
			<text x={0} y={rowY(r)}>{authors[r]}</text>
			{#each row as on, c (c)}
				<circle
					cx={cellX(c)}
					cy={rowY(r) - 4}
					r={6}
					fill={on ? ink : "#fff"}
					stroke={hover?.[0] === r && hover[1] === c ? ink : on ? ink : hair}
					style:cursor={print ? undefined : "pointer"}
				/>
			{/each}
			<text x={gridW} y={rowY(r)} text-anchor="end">{share(row)}</text>
		{/each}
		<text x={tx} y={ty + 14} fill={mute}>{say.institution}</text>
		{#each cols as col (col.x)}
			{#each col.head as line, l (l)}
				<text
					x={col.x}
					y={ty + 14 - lift + 17 * l}
					fill={mute}
					text-anchor="end">{line}</text
				>
			{/each}
		{/each}
		<line x1={tx} x2={tx + tw} y1={ty + 20} y2={ty + 20} stroke={ink} />
		{#each table as t, r (t.name)}
			{@const y = ty + rowY(r)}
			{@const fill = r < places.length ? ink : mute}
			<text x={tx} {y} {fill}>{t.name}</text>
			<text x={cols[0].x} {y} {fill} text-anchor="end">{t.W}</text>
			<text x={cols[1].x} {y} {fill} text-anchor="end">{grouped(t.w)}</text>
			<text x={cols[2].x} {y} {fill} text-anchor="end">{grouped(t.micro)}</text>
		{/each}
		<line
			x1={tx}
			x2={tx + tw}
			y1={ty + rowY(table.length) - 17}
			y2={ty + rowY(table.length) - 17}
			stroke={hair}
		/>
		<text x={tx} y={ty + rowY(table.length)} fill={mute}>{say.sum}</text>
		<text
			x={cols[0].x}
			y={ty + rowY(table.length)}
			text-anchor="end"
			fill={mute}
			>{fraction(
				sums.reduce((a, b) => a + b, 0),
				N * den,
			)}</text
		>
		<text
			x={cols[1].x}
			y={ty + rowY(table.length)}
			text-anchor="end"
			fill={mute}>{grouped(table.reduce((a, t) => a + t.w, 0))}</text
		>
		<text
			x={cols[2].x}
			y={ty + rowY(table.length)}
			text-anchor="end"
			fill={mute}>{grouped(table.reduce((a, t) => a + t.micro, 0))}</text
		>
	</svg>
</Frame>
