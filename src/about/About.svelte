<script lang="ts" module>
	import en from "./about.md";
	import zh from "./about.zh.md";
	import type { Block, Paper } from "./render";
	import type { About } from "./resolve";
	import { type Lang, langs, words } from "./words";

	export const built = { en, zh } as Record<
		Lang,
		{ paper: Paper; about: About }
	>;
</script>

<script lang="ts">
	import "katex/dist/katex.min.css";
	import "./about.scss";
	import { type Component, tick } from "svelte";
	import { flag } from "../flags";
	import apportion from "./figures/apportion.svelte";
	import composition from "./figures/composition.svelte";
	import concentration from "./figures/concentration.svelte";
	import counting from "./figures/counting.svelte";
	import countries from "./figures/countries.svelte";
	import faculty from "./figures/faculty.svelte";
	import scaling from "./figures/scaling.svelte";
	import tiers from "./figures/tiers.svelte";
	import validity from "./figures/validity.svelte";
	import type { Props } from "./plot";

	let { lang = $bindable("en") }: { lang?: Lang } = $props();

	const figures: Record<string, Component<Props>> = {
		apportion,
		tiers,
		counting,
		faculty,
		composition,
		validity,
		concentration,
		countries,
		scaling,
	};

	const { paper, about } = $derived(built[lang]);
	const say = $derived(words[lang]);

	let current = $state<string>();
	let shut = $state(true);

	const box = (id: string) => {
		const head = document.getElementById(id);
		return (head?.parentElement ?? head)?.getBoundingClientRect();
	};

	const line = () => {
		const edge = document.querySelector<HTMLElement>(".paper > .edge");
		return edge
			? Number.parseFloat(getComputedStyle(edge).top) + edge.offsetHeight
			: 0;
	};

	const spy = () => {
		const ids = paper.sections.map((s) => s.id);
		let at = ids[0];
		for (const id of ids) if ((box(id)?.top ?? 0) <= line() + 1) at = id;
		if (innerHeight + scrollY >= document.body.scrollHeight - 2)
			at = ids[ids.length - 1];
		current = at;
	};

	const choose = async (next: Lang) => {
		if (next === lang) return;
		const k = paper.sections.findIndex((s) => s.id === current);
		const was = scrollY > 0 ? box(current ?? "") : undefined;
		const top = line();
		lang = next;
		await tick();
		const now = box(paper.sections[k]?.id ?? "");
		if (was && now)
			scrollBy(0, now.top + ((top - was.top) / was.height) * now.height - top);
		spy();
	};

	let last = 0;

	const settle = () => {
		const moved = scrollY - last;
		last = scrollY;
		if (Math.abs(moved) < 1) return;
		const top = line();
		const end = document.documentElement.scrollHeight - innerHeight;
		const near = [
			...document.querySelectorAll(".paper :is(.part, .sub) > :is(h2, h3)"),
		]
			.map((h) => h.getBoundingClientRect())
			.map((r) => ({
				d: r.top - top,
				cut: r.top < top && r.bottom > top && top - r.top < moved - 0.5,
			}))
			.filter(
				({ d, cut }) =>
					(cut || (d * moved > 0 && Math.abs(d) <= innerHeight / 8)) &&
					scrollY + d <= end,
			)
			.reduce(
				(a, { d }) => (Math.abs(d) < Math.abs(a) ? d : a),
				Number.POSITIVE_INFINITY,
			);
		if (!Number.isFinite(near) || Math.abs(near) <= 0.5) return;
		last = scrollY + near;
		scrollBy({
			top: near,
			behavior: matchMedia("(prefers-reduced-motion: reduce)").matches
				? "instant"
				: "smooth",
		});
	};

	$effect(() => {
		let frame = 0;
		let idle = 0;
		const rest = "onscrollend" in window ? "scrollend" : "scroll";
		const watch = () => {
			cancelAnimationFrame(frame);
			frame = requestAnimationFrame(spy);
		};
		const still = () => {
			clearTimeout(idle);
			idle = window.setTimeout(settle, rest === "scroll" ? 128 : 0);
		};
		last = scrollY;
		spy();
		addEventListener("scroll", watch, { passive: true });
		addEventListener(rest, still, { passive: true });
		addEventListener("resize", watch);
		return () => {
			removeEventListener("scroll", watch);
			removeEventListener(rest, still);
			removeEventListener("resize", watch);
			clearTimeout(idle);
		};
	});

	const jump = (id: string) => {
		const at = document.getElementById(id);
		(at?.matches("h2, h3") ? at.parentElement : at)?.scrollIntoView();
		shut = true;
	};

	const follow = (article: HTMLElement) => {
		const click = (event: MouseEvent) => {
			const copy = (event.target as Element).closest(".copy");
			if (copy) {
				navigator.clipboard
					.writeText(copy.nextElementSibling?.textContent ?? "")
					.then(() => {
						copy.textContent = say.copied;
						setTimeout(() => {
							copy.textContent = say.copy;
						}, 1500);
					});
				return;
			}
			const href = (event.target as Element).closest("a")?.getAttribute("href");
			if (!href?.startsWith("#")) return;
			event.preventDefault();
			jump(href.slice(1));
		};
		article.addEventListener("click", click);
		return () => article.removeEventListener("click", click);
	};

	const title = (id: string) => {
		const s = paper.sections.find((x) => x.id === id);
		return s ? `${s.number} ${s.title}`.trim() : "";
	};
</script>

{#snippet run(blocks: Block[])}
	{#each blocks as block, k (k)}
		{#if "html" in block}
			{@html block.html}
		{:else}
			{@const Figure = figures[block.figure]}
			<figure id="fig-{block.figure}" class:wide={block.wide}>
				<Figure {about} words={say} />
				<figcaption>
					<span class="label">{say.figure} {block.number}</span>
					{@html block.caption}
				</figcaption>
			</figure>
		{/if}
	{/each}
{/snippet}

<nav class={["toc", { shut }]} style:font-family={say.font}>
	<div class="langs">
		{#each langs as key (key)}
			<button
				class:on={key === lang}
				aria-pressed={key === lang}
				lang={words[key].locale}
				onclick={() => choose(key)}
				><img class="flag" src={flag(words[key].flag)} alt="" />{words[key]
					.name}</button
			>
		{/each}
	</div>
	<button
		class="now"
		lang={say.locale}
		aria-expanded={!shut}
		onclick={() => (shut = !shut)}
	>
		{title(current ?? "")}
	</button>
	<ol lang={say.locale}>
		{#each paper.sections as section (section.id)}
			<li>
				<button
					class:at={section.id === current}
					onclick={() => jump(section.id)}
					><span class="no">{section.number}</span>{section.title}</button
				>
			</li>
		{/each}
	</ol>
</nav>

<article
	class="paper"
	lang={say.locale}
	style:font-family={say.font}
	{@attach follow}
>
	<div class="headline">
		<h1>{paper.title}</h1>
		<a
			class="pdf"
			href="{import.meta.env.BASE_URL}{say.pdf}"
			target="_blank"
			rel="noopener">PDF</a
		>
	</div>
	<header class="by">
		<span
			><span>clareLab</span><a href="mailto:yaho@clarelab.moe"
				>yaho@clarelab.moe</a
			></span
		>
		<span
			><span>{paper.date}</span><span>{say.release(about.release)}</span></span
		>
	</header>
	<hr class="edge" />
	<section class="part abstract">
		<h2>{say.abstract}</h2>
		{@html paper.abstract}
	</section>
	{@render run(paper.lead)}
	{#each paper.parts as part, k (k)}
		<section class="part">
			{@html part.head}
			{@render run(part.blocks)}
			{#each part.subs as sub, j (j)}
				<section class="sub">
					{@html sub.head}
					{@render run(sub.blocks)}
				</section>
			{/each}
		</section>
	{/each}
</article>
