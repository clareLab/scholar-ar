<script lang="ts">
	import Frame from "../Frame.svelte";
	import {
		fit,
		grouped,
		ink,
		measure,
		mute,
		named,
		order,
		page,
		type Props,
		pct,
		pointer,
		ramp,
		room,
		size,
	} from "../plot";
	import Switch from "../Switch.svelte";

	let { about, words, print = false }: Props = $props();
	let width = $state(0);
	const W = $derived(print ? page : width);

	const say = $derived(words.composition);
	let sort = $state<"field" | "share">("field");
	const rows = $derived.by(() => {
		const sum = (m: number[]) => m.reduce((a, b) => a + b, 0);
		const list = order(
			about,
			about.composition.map((c) => c.view),
		).map((view) => {
			const mass = (
				about.composition.find((c) => c.view === view) as { mass: number[] }
			).mass;
			const total = sum(mass);
			return {
				view,
				name: named(about, view),
				mass,
				total,
				shares: mass.map((m) => m / total),
			};
		});
		if (sort === "share") {
			const [all, ...rest] = list;
			return [all, ...rest.sort((a, b) => b.shares[0] - a.shares[0])];
		}
		return list;
	});

	const top = 24;
	const row = $derived(print ? 17 : 20);
	const split = 8;
	const rowY = (j: number) => top + row * j + (j ? split : 0);
	const label = $derived(
		room(
			rows.map((r) => r.name),
			W * 0.4,
		),
	);
	const x0 = $derived(label + 10);
	const x1 = $derived(W - 56);
	const H = $derived(rowY(rows.length) + 2);
	const marks = $derived.by(() => {
		const first = rows[0].shares;
		let at = x0;
		const half = measure("T1", size) / 2;
		let edge = x0 - 4;
		return first.map((s, t) => {
			const mid = Math.max(at + ((x1 - x0) * s) / 2, edge + 4 + half);
			at += (x1 - x0) * s;
			edge = mid + half;
			return { t, mid };
		});
	});

	let hover = $state<number>();
	const move = (event: PointerEvent) => {
		const [, y] = pointer(event);
		const j = rows.findIndex((_, k) => y >= rowY(k) && y < rowY(k) + row);
		hover = j >= 0 ? j : undefined;
	};
	const readout = $derived.by(() => {
		const r = hover === undefined ? rows[0] : rows[hover];
		return [
			r.name,
			say.item(
				r.shares.map((s, t) => `T${t + 1} ${pct(s, 1)}`).join(words.sep),
				grouped(r.total),
			),
		] as [string, string];
	});
</script>

<Frame {print} bind:width {readout}>
	{#snippet controls()}
		<Switch
			options={[
				["field", say.field],
				["share", say.share],
			]}
			bind:value={sort}
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
		<text x={0} y={14} fill={mute}>{words.area}</text>
		{#each marks as m (m.t)}
			<text x={m.mid} y={14} fill={mute} text-anchor="middle">T{m.t + 1}</text>
		{/each}
		<text x={W} y={14} fill={mute} text-anchor="end">T1</text>
		{#each rows as r, j (r.view)}
			{@const y = rowY(j)}
			{@const on = hover === undefined || hover === j}
			<text x={0} y={y + row / 2 + 4.5} fill={on ? ink : mute}
				>{fit(r.name, label)}</text
			>
			{#each r.shares as s, t (t)}
				{@const before = r.shares.slice(0, t).reduce((a, b) => a + b, 0)}
				<rect
					x={x0 + (x1 - x0) * before}
					y={y + row / 2 - 5}
					width={(x1 - x0) * s}
					height={10}
					fill={ramp[t]}
					opacity={on ? 1 : 0.45}
				/>
			{/each}
			<text x={W} y={y + row / 2 + 4.5} text-anchor="end" fill={on ? ink : mute}
				>{pct(r.shares[0], 1)}</text
			>
		{/each}
	</svg>
</Frame>
