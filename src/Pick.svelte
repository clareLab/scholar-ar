<script lang="ts">
	import { outside } from "./page";

	let {
		value = $bindable(),
		years,
		label,
	}: { value: number; years: number[]; label: string } = $props();

	let open = $state(false);
	let trigger: HTMLButtonElement | undefined = $state();
	let box: HTMLDivElement | undefined = $state();

	const shut = (focus: boolean) => {
		open = false;
		if (focus) trigger?.focus();
	};

	$effect(() => {
		if (!open || !box || !trigger) return;
		const style = getComputedStyle(box);
		const at = trigger.getBoundingClientRect();
		const top = at.bottom;
		const gutter = parseFloat(getComputedStyle(document.body).paddingRight);
		box.style.left = `${Math.min(
			at.left -
				parseFloat(style.paddingLeft) -
				parseFloat(style.borderLeftWidth),
			innerWidth - gutter - box.offsetWidth,
		)}px`;
		box.style.top = `${top}px`;
		box.style.maxHeight = `${innerHeight - top}px`;
		const chosen = box.querySelector<HTMLButtonElement>(
			'[aria-selected="true"]',
		);
		chosen?.scrollIntoView({ block: "nearest" });
		chosen?.focus({ preventScroll: true });
	});

	const keys = (event: KeyboardEvent) => {
		const items = [...(box?.querySelectorAll("button") ?? [])];
		const k = items.indexOf(document.activeElement as HTMLButtonElement);
		const next = {
			ArrowDown: k + 1,
			ArrowUp: k - 1,
			Home: 0,
			End: items.length - 1,
		}[event.key];
		if (next !== undefined) {
			event.preventDefault();
			items[Math.max(0, Math.min(items.length - 1, next))]?.focus();
		} else if (event.key === "Escape") {
			event.preventDefault();
			shut(true);
		} else if (event.key === "Tab") shut(false);
	};
</script>

<svelte:window
	onscroll={() => {
		if (open) shut(false);
	}}
	onresize={() => {
		if (open) shut(false);
	}}
/>

<span class="pick">
	<button
		bind:this={trigger}
		aria-haspopup="listbox"
		aria-expanded={open}
		aria-label={`${label} ${value}`}
		onclick={() => (open = !open)}
		onkeydown={(event) => {
			if (event.key === "ArrowDown" || event.key === "ArrowUp") {
				event.preventDefault();
				open = true;
			}
		}}>{value}</button
	>
	{#if open}
		<div
			class="drop"
			role="listbox"
			aria-label={label}
			tabindex="-1"
			bind:this={box}
			use:outside={() => shut(false)}
			onkeydown={keys}
		>
			{#each years as year (year)}
				<button
					role="option"
					aria-selected={year === value}
					class:on={year === value}
					onclick={() => {
						value = year;
						shut(true);
					}}>{year}</button
				>
			{/each}
		</div>
	{/if}
</span>
