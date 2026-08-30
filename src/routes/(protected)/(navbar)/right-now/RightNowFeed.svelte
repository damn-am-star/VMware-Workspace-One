<script lang="ts">
	import { afterNavigate, beforeNavigate } from "$app/navigation";

	import ApiErrorDisplay from "$lib/components/feedback/ApiErrorDisplay.svelte";
	import { rightNowState } from "$lib/right-now/right-now-state.svelte";
	import RightNowEmptyFeed from "./RightNowEmptyFeed.svelte";
	import RightNowPost from "./RightNowPost.svelte";

	let { ourProfileId }: { ourProfileId: number } = $props();

	$effect.pre(() => {
		rightNowState.load();
	});

	beforeNavigate(() => {
		rightNowState.scrollY = window.scrollY;
	});

	afterNavigate((navigation) => {
		if (navigation.type === "popstate") return;
		if (!rightNowState.loading) {
			window.scrollTo({
				top: rightNowState.scrollY,
				behavior: "instant",
			});
		}
	});

	let scrolled = $state(false);
	$effect(() => {
		if (!scrolled && !rightNowState.loading) {
			scrolled = true;
			window.scrollTo({
				top: rightNowState.scrollY,
				behavior: "instant",
			});
		}
	});
</script>

<div class="relative flex flex-1 flex-col gap-2">
	{#if rightNowState.loading}
		{#each Array.from({ length: 10 })}
			<div
				class="h-20 w-full animate-pulse rounded-md bg-stone-700"
			></div>
		{/each}
	{:else if rightNowState.error}
		<div class="flex p-4">
			<ApiErrorDisplay
				error={rightNowState.error}
				onRetry={() => rightNowState.refresh()}
				class="m-auto"
			/>
		</div>
	{:else if !rightNowState.posts.length}
		<RightNowEmptyFeed />
	{:else}
		{#each rightNowState.posts as post (post.id)}
			<RightNowPost {...post} {ourProfileId} />
		{/each}
	{/if}
</div>
