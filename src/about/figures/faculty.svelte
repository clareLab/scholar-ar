<script lang="ts">
	import Frame from "../Frame.svelte";
	import { hair, ink, mute, page, type Props, pointer, size } from "../plot";

	let { words, print = false }: Props = $props();
	let width = $state(0);
	const W = $derived(print ? page : width);

	const say = $derived(words.faculty);
	const children = $derived(say.children);
	const people = ["a", "b"];
	const shares = [
		[0.75, 0.25],
		[0.5, 0.5],
	];
	const papers = [
		{ person: 0, paper: 0, at: ["X", "Y"], part: 0.5 },
		{ person: 0, paper: 1, at: ["X"], part: 0.5 },
		{ person: 1, paper: 0, at: ["X"], part: 1 },
	];
	const leaves = papers.flatMap((p, j) =>
		p.at.map((place) => ({ entry: j, place, part: p.part / p.at.length })),
	);
	const totals = ["X", "Y"].map((place) => {
		const mine = leaves.filter((l) => l.place === place);
		return {
			place,
			total: mine.reduce((sum, l) => sum + l.part, 0),
			parts: [0, 1].map((c) =>
				mine.reduce(
					(sum, l) => sum + l.part * shares[papers[l.entry].paper][c],
					0,
				),
			),
		};
	});
	const num = (x: number) => `${+x.toFixed(4)}`;

	const wide = $derived(W >= 600);
	const aw = $derived(wide ? W * 0.54 : W);
	const row = 24;
	const top = 26;
	const leafY = (k: number) => top + k * row + 14;
	const middle = (ks: number[]) =>
		(leafY(ks[0]) + leafY(ks[ks.length - 1])) / 2;
	const paperY = (j: number) =>
		middle(leaves.flatMap((l, k) => (l.entry === j ? [k] : [])));
	const personY = (a: number) =>
		middle(leaves.flatMap((l, k) => (papers[l.entry].person === a ? [k] : [])));
	const xs = $derived([0, aw * 0.36, aw * 0.72]);
	const tx = $derived(wide ? aw + 64 : 0);
	const tw = $derived(W - tx);
	const tableTop = $derived(wide ? 0 : leafY(leaves.length - 1) + 22);
	const columns = $derived([tx + tw * 0.4, tx + tw * 0.7, W]);
	const H = $derived(
		Math.max(leafY(leaves.length - 1) + 10, tableTop + 20 + 2 * row + 4),
	);

	let hover = $state<string>();
	const move = (event: PointerEvent) => {
		const [px, py] = pointer(event);
		hover = undefined;
		if (px > aw + 8) return;
		const hit = leaves.findIndex(
			(_, j) => Math.abs(py - leafY(j) + 4) < row / 2,
		);
		if (px >= xs[2] - 10 && hit >= 0) hover = `l${hit}`;
		else if (px >= xs[1] - 10 && px < xs[2] - 10) {
			const j = papers.findIndex(
				(_, j) => Math.abs(py - paperY(j) + 4) < row / 2,
			);
			if (j >= 0) hover = `p${j}`;
		}
	};

	const readout = $derived.by(() => {
		if (hover?.startsWith("l")) {
			const l = leaves[Number(hover.slice(1))];
			const p = papers[l.entry];
			return say.leaf(people[p.person], p.paper + 1, l.place, num(l.part));
		}
		if (hover?.startsWith("p")) {
			const p = papers[Number(hover.slice(1))];
			const s = shares[p.paper];
			return say.entry(people[p.person], p.paper + 1, num(p.part), s, children);
		}
		return say.idle(totals.map((t) => [t.place, num(t.total)]));
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
		<text x={xs[0]} y={14} fill={mute}>{say.person}</text>
		<text x={xs[1]} y={14} fill={mute}>{say.paper}</text>
		<text x={xs[2]} y={14} fill={mute}>{say.institution}</text>
		{#each papers as p, j (j)}
			<path
				d="M{xs[0] + 22},{personY(p.person) - 4}C{xs[1] - 30},{personY(
					p.person,
				) - 4} {xs[1] - 40},{paperY(j) - 4} {xs[1] - 6},{paperY(j) - 4}"
				fill="none"
				stroke={hover === `p${j}` ? ink : hair}
			/>
		{/each}
		{#each leaves as l, j (j)}
			<path
				d="M{xs[1] + 54},{paperY(l.entry) - 4}C{xs[2] - 30},{paperY(l.entry) -
					4} {xs[2] - 40},{leafY(j) - 4} {xs[2] - 6},{leafY(j) - 4}"
				fill="none"
				stroke={hover === `l${j}` || hover === `p${l.entry}` ? ink : hair}
			/>
			<text x={xs[2]} y={leafY(j)}>{l.place}</text>
			<text x={aw} y={leafY(j)} text-anchor="end">{num(l.part)}</text>
		{/each}
		{#each people as name, a (name)}
			<text x={xs[0]} y={personY(a)}>{name}</text>
		{/each}
		{#each papers as p, j (j)}
			<text x={xs[1]} y={paperY(j)}>{p.paper + 1}</text>
			<text x={xs[1] + 48} y={paperY(j)} text-anchor="end">{num(p.part)}</text>
		{/each}
		<text x={tx} y={tableTop + 14} fill={mute}>{say.authors}</text>
		{#each [say.total, ...children] as head, c (head)}
			<text x={columns[c]} y={tableTop + 14} fill={mute} text-anchor="end"
				>{head}</text
			>
		{/each}
		<line x1={tx} x2={W} y1={tableTop + 20} y2={tableTop + 20} stroke={ink} />
		{#each totals as t, r (t.place)}
			{@const y = tableTop + 20 + (r + 1) * row - 6}
			<text x={tx} {y}>{t.place}</text>
			{#each [t.total, ...t.parts] as part, c (c)}
				<text x={columns[c]} {y} text-anchor="end">{num(part)}</text>
			{/each}
		{/each}
	</svg>
</Frame>
