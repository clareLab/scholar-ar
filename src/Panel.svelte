<script lang="ts" module>
	import { flag } from "./flags";

	export { badge };

	export type Twig = {
		id: number | string;
		name: string;
		code?: string;
		parent?: Twig;
		children: Twig[];
	};

	export type Tree = {
		name: string;
		root: Twig;
		scope?: Twig;
		href?: (twig: Twig) => string;
		mark: (twig: Twig) => number;
		flip: (twig: Twig, listed: boolean) => void;
	};

	export const whole = (marks: number[]) =>
		marks.every((m) => m === 2) ? 2 : marks.some(Boolean) ? 1 : 0;

	export const rooted = (root: Twig) => {
		const walk = (twig: Twig) => {
			for (const child of twig.children) {
				child.parent = twig;
				walk(child);
			}
		};
		walk(root);
		return root;
	};

	export const more =
		(grow: () => void, root?: Element) => (sentinel: Element) => {
			const watch = new IntersectionObserver(
				([entry]) => {
					if (!entry.isIntersecting) return;
					grow();
					watch.unobserve(sentinel);
					watch.observe(sentinel);
				},
				{ root, rootMargin: "100% 0px" },
			);
			watch.observe(sentinel);
			return () => watch.disconnect();
		};
</script>

<script lang="ts">
	import type { Snippet } from "svelte";
	import { plain } from "./page";
	import { fuzzy } from "./search";

	let { trees, tail }: { trees: Tree[]; tail: Snippet } = $props();

	let list = $state(0);
	let shut = $state(true);
	let query = $state("");
	let spots = $state<
		({ scope?: number | string; ids: (number | string)[] } | undefined)[]
	>([]);

	const tree = $derived(trees[list]);

	const pick = (next: number) => {
		shut = next === list && !shut;
		list = next;
	};

	const ancestry = (twig: Twig): Twig[] =>
		twig.parent ? [...ancestry(twig.parent), twig] : [twig];

	const trail = (twig: Twig) =>
		ancestry(twig)
			.slice(1)
			.map((t) => t.id);

	$effect.pre(() => {
		trees.forEach(({ scope }, k) => {
			if (spots[k] && spots[k].scope !== scope?.id) spots[k] = undefined;
		});
	});

	const at = $derived.by(() => {
		let twig = tree.root;
		const spot = spots[list];
		const ids =
			spot && spot.scope === tree.scope?.id
				? spot.ids
				: tree.scope
					? trail(tree.scope)
					: [];
		for (const id of ids) {
			const next = twig.children.find((c) => c.id === id);
			if (!next) break;
			twig = next;
		}
		return twig;
	});

	const everyone = $derived.by(() => {
		const out: Twig[] = [];
		let level = tree.root.children;
		while (level.length) {
			for (const twig of level) out.push(twig);
			level = level.flatMap((twig) => twig.children);
		}
		return out;
	});

	const path = $derived(query.trim() ? [] : ancestry(at));

	const items = $derived(
		query.trim() ? fuzzy(everyone, (t) => t.name, query) : at.children,
	);

	let shown = $derived.by(() => {
		void list;
		void query;
		void at;
		return 64;
	});

	let scroller = $state<HTMLElement>();

	$effect(() => {
		void items;
		if (scroller) scroller.scrollTop = 0;
	});

	const ink = $derived(tree.scope ?? at);

	const open = (twig: Twig) => {
		query = "";
		spots[list] = { scope: tree.scope?.id, ids: trail(twig) };
	};

	const flip = (
		box: HTMLInputElement,
		value: number,
		twig: Twig,
		listed: boolean,
	) => {
		box.checked = value === 2;
		box.indeterminate = value === 1;
		const ids = trail(at);
		tree.flip(twig, listed);
		spots[list] = { scope: tree.scope?.id, ids };
	};

	const mixed = (box: HTMLInputElement, value: boolean) => {
		box.indeterminate = value;
	};
</script>

{#snippet badge(code: string)}
	{@const src = flag(code)}
	{#if src}
		<img class="flag" {src} alt="" />
	{:else}
		<span class="flag"></span>
	{/if}
{/snippet}

{#snippet item(twig: Twig, listed: boolean)}
	{@const value = tree.mark(twig)}
	<input
		class="box"
		type="checkbox"
		aria-label={twig.name}
		checked={value === 2}
		{@attach (box) => mixed(box, value === 1)}
		onchange={(event) => flip(event.currentTarget, value, twig, listed)}
	/>{#if tree.href}<a
			class:miss={listed && value === 0}
			href={tree.href(twig)}
			aria-current={twig === ink && !listed ? "true" : undefined}
			onclick={(event) => {
				if (!plain(event)) return;
				event.preventDefault();
				open(twig);
			}}>{twig.name}</a
		>{:else}<button
			class:miss={listed && value === 0}
			class:flagged={twig.code !== undefined}
			aria-current={twig === ink && !listed ? "true" : undefined}
			onclick={() => open(twig)}
			>{#if twig.code !== undefined}{@render badge(
					twig.code,
				)}{/if}{twig.name}</button
		>{/if}
{/snippet}

<nav class={["panel", { shut }]}>
	<input type="search" placeholder="Search" bind:value={query} />
	<div class="lists">
		{#each trees as { name }, k (name)}
			<button
				class:on={list === k}
				aria-expanded={list === k && !shut}
				onclick={() => pick(k)}>{name}</button
			>
		{/each}
		{@render tail()}
	</div>
	{#if path.length}
		<ul class="path">
			{#each path as twig (twig.id)}
				<li class:up={twig !== ink}>{@render item(twig, false)}</li>
			{/each}
		</ul>
	{/if}
	<ul bind:this={scroller}>
		{#each items.slice(0, shown) as twig, k (k)}
			<li>
				{@render item(twig, true)}
				{#if query.trim() && twig.parent}
					<span class="miss">{twig.parent.name}</span>
				{/if}
			</li>
		{/each}
		{#if shown < items.length}
			<li {@attach more(() => (shown *= 2), scroller)}></li>
		{/if}
	</ul>
</nav>
