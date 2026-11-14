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
		share: (twig: Twig, near: boolean) => number | undefined;
		tag?: (twig: Twig) => string | undefined;
	};

	const percent = (share?: number) => {
		if (share === undefined) return "";
		const p = share * 100;
		if (!p) return "0%";
		if (p < 0.01) return "<0.01%";
		return `${p < 9.95 ? p.toPrecision(2) : Math.round(p)}%`;
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
	import { MediaQuery } from "svelte/reactivity";
	import { plain } from "./page";
	import { fuzzy } from "./search";

	let { trees, tail }: { trees: Tree[]; tail: Snippet } = $props();

	let list = $state(0);
	let shut = $state(true);
	const narrow = new MediaQuery("(width < 760px)");
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

	let seen = $state.raw(new Set<Twig>());
	const rows = new Map<Element, Twig>();
	const near = new Set<Element>();
	let settle: ReturnType<typeof setTimeout> | undefined;
	let watch: IntersectionObserver | undefined;

	const rest = () => {
		clearTimeout(settle);
		settle = setTimeout(() => {
			seen = new Set([...near].map((row) => rows.get(row) as Twig));
		}, 256);
	};

	const sight = (twig: Twig) => (row: Element) => {
		watch ??= new IntersectionObserver((entries) => {
			for (const { target, isIntersecting } of entries)
				if (isIntersecting) near.add(target);
				else near.delete(target);
			rest();
		});
		rows.set(row, twig);
		watch.observe(row);
		return () => {
			watch?.unobserve(row);
			rows.delete(row);
			near.delete(row);
		};
	};

	$effect(() => () => {
		watch?.disconnect();
		clearTimeout(settle);
	});

	const figure = (twig: Twig, listed: boolean) => {
		const tag = listed && query.trim() ? tree.tag?.(twig) : undefined;
		return tag ?? percent(tree.share(twig, seen.has(twig)));
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
	<span class="label"
		><input
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
		{#if listed && query.trim() && !tree.tag && twig.parent?.parent}
			<span class="miss kin">{twig.parent.name}</span>
		{/if}</span
	><span class="share" class:miss={listed && value === 0}
		>{figure(twig, listed)}</span
	>
{/snippet}

<nav class={["panel", { shut }]}>
	<input type="search" placeholder="Search" bind:value={query} />
	<div class="lists">
		{#each trees as { name }, k (name)}
			<button
				class:on={list === k}
				aria-expanded={narrow.current ? list === k && !shut : undefined}
				onclick={() => pick(k)}>{name}</button
			>
		{/each}
		{@render tail()}
	</div>
	{#if path.length}
		<ul class="path">
			{#each path as twig (twig.id)}
				<li class:up={twig !== ink} {@attach sight(twig)}>
					{@render item(twig, false)}
				</li>
			{/each}
		</ul>
	{/if}
	<ul bind:this={scroller}>
		{#each items.slice(0, shown) as twig, k (k)}
			<li {@attach sight(twig)}>{@render item(twig, true)}</li>
		{/each}
		{#if shown < items.length}
			<li {@attach more(() => (shown *= 2), scroller)}></li>
		{/if}
	</ul>
</nav>
