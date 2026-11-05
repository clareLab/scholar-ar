<script lang="ts" module>
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
		at?: Twig;
		link?: (twig: Twig) => string;
		open?: (twig: Twig) => void;
		mark: (twig: Twig) => number | undefined;
		flip: (twig: Twig) => void;
	};

	export const whole = (marks: number[]) =>
		marks.every((m) => m === 2) ? 2 : marks.some(Boolean) ? 1 : 0;

	export const leaves = (twig: Twig): Twig[] =>
		twig.children.length ? twig.children.flatMap(leaves) : [twig];

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
</script>

<script lang="ts">
	import { flag } from "./flags";
	import { fuzzy } from "./search";

	let { trees }: { trees: Tree[] } = $props();

	let list = $state(0);
	let shut = $state(true);
	let query = $state("");
	let spots = $state<(number | string)[][]>([]);

	const tree = $derived(trees[list]);

	const pick = (next: number) => {
		shut = next === list && !shut;
		list = next;
	};

	const ancestry = (twig: Twig): Twig[] =>
		twig.parent ? [...ancestry(twig.parent), twig] : [twig];

	const at = $derived.by(() => {
		if (tree.at) return tree.at;
		let twig = tree.root;
		for (const id of spots[list] ?? []) {
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
			out.push(...level);
			level = level.flatMap((twig) => twig.children);
		}
		return out;
	});

	const items = $derived.by(() => {
		if (query.trim())
			return fuzzy(everyone, (t) => t.name, query).map((twig) => ({
				twig,
				hit: true,
			}));
		return [...ancestry(at), ...at.children].map((twig) => ({
			twig,
			hit: false,
		}));
	});

	let shown = $derived.by(() => {
		void list;
		void query;
		void at;
		return 200;
	});

	let scroller = $state<HTMLElement>();

	const more = (sentinel: Element) => {
		const watch = new IntersectionObserver(
			([entry]) => {
				if (!entry.isIntersecting) return;
				shown += 200;
				watch.unobserve(sentinel);
				watch.observe(sentinel);
			},
			{ root: scroller, rootMargin: "100% 0px" },
		);
		watch.observe(sentinel);
		return () => watch.disconnect();
	};

	const open = (twig: Twig) => {
		query = "";
		if (tree.open) tree.open(twig);
		else
			spots[list] = ancestry(twig)
				.map((t) => t.id)
				.slice(1);
	};

	const enter = (event: MouseEvent, twig: Twig) => {
		if (event.button || event.metaKey || event.ctrlKey || event.shiftKey)
			return;
		event.preventDefault();
		open(twig);
	};

	const mixed = (box: HTMLInputElement, value: boolean) => {
		box.indeterminate = value;
	};
</script>

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
	</div>
	<ul bind:this={scroller}>
		{#each items.slice(0, shown) as { twig, hit }, k (k)}
			{@const value = tree.mark(twig)}
			<li>
				{#if value === undefined}<span class="slot"></span>{:else}<input
						class="box"
						type="checkbox"
						aria-label={twig.name}
						checked={value === 2}
						{@attach (box) => mixed(box, value === 1)}
						onchange={() => tree.flip(twig)}
					/>{/if}{#if tree.link}<a
						class:miss={value === 0}
						href={tree.link(twig)}
						aria-current={twig === at && !hit ? "page" : undefined}
						onclick={(event) => enter(event, twig)}>{twig.name}</a
					>{:else}<button
						class:miss={value === 0}
						class:flagged={twig.code !== undefined}
						aria-current={twig === at && !hit ? "true" : undefined}
						onclick={() =>
							twig.children.length ? open(twig) : tree.flip(twig)}
						>{#if twig.code !== undefined}{#if flag(twig.code)}<img
									class="flag"
									src={flag(twig.code)}
									alt=""
								/>{:else}<span class="flag"></span>{/if}{/if}{twig.name}</button
					>{/if}
				{#if hit && twig.parent}
					<span class="miss">{twig.parent.name}</span>
				{/if}
			</li>
		{/each}
		{#if shown < items.length}
			<li {@attach more}></li>
		{/if}
	</ul>
</nav>
