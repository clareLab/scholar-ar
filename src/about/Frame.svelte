<script lang="ts">
	import type { Snippet } from "svelte";

	let {
		print = false,
		width = $bindable(0),
		readout = "",
		controls,
		children,
	}: {
		print?: boolean;
		width?: number;
		readout?: string | [string, string];
		controls?: Snippet;
		children: Snippet;
	} = $props();

	let ready = $state(false);

	$effect(() => {
		document.fonts.ready.then(() => (ready = true));
	});
</script>

{#if print}
	{@render children()}
{:else}
	<div class="plot" bind:clientWidth={width}>
		<div class="controls">
			{@render controls?.()}
			<span class="readout"
				>{#if typeof readout === "string"}{readout}{:else}<span class="who"
						>{readout[0]}</span
					><span>{readout[1]}</span>{/if}</span
			>
		</div>
		{#if width && ready}
			{@render children()}
		{/if}
	</div>
{/if}
