<script lang="ts" generics="T">
	let { options, value = $bindable() }: { options: [T, string][]; value: T } =
		$props();
</script>

<span class="switch">
	{#each options as [key, label] (label)}
		<button class:on={key === value} onclick={() => (value = key)}>
			{label}
		</button>
	{/each}
</span>
