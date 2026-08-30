<script lang="ts">
	import DataRefreshControl from "$lib/components/feedback/DataRefreshControl.svelte";
	import { rightNowState } from "$lib/right-now/right-now-state.svelte";
	import { restoreScrollOnce } from "$lib/util/scroll-restore.svelte";
	import RightNowFeed from "./RightNowFeed.svelte";
	import TopBar from "./top-bar/TopBar.svelte";

	let { data }: import("./$types").PageProps = $props();
	let feedContainer: HTMLElement | null = $state(null);
	const ourProfileId = $derived(data.ourProfileId);

	restoreScrollOnce(() => feedContainer, rightNowState);
</script>

<div class="screen-nav-host">
	<TopBar />
	<div
		class="pull-scroller"
		bind:this={feedContainer}
		onscroll={() => (rightNowState.scrollY = feedContainer?.scrollTop ?? 0)}
	>
		<div
			class="mx-auto flex min-h-overscrollable w-full max-w-5xl flex-col gap-1 px-4 pt-16 pb-nav-clear"
		>
			<RightNowFeed {ourProfileId} />
		</div>
	</div>
	{#if !rightNowState.loading && !rightNowState.error}
		<DataRefreshControl
			container={feedContainer}
			updating={rightNowState.refreshing}
			position="top"
			onrefresh={() => void rightNowState.refresh()}
		/>
	{/if}
</div>
