<script lang="ts">
	import { untrack } from "svelte";

	import { showErrorToast } from "$lib/api/error-toast";
	import { Button } from "$lib/components/ui/button";
	import { Textarea } from "$lib/components/ui/textarea";
	import { getSavedPhrasesState } from "$lib/phrases/saved-phrases-state.svelte";

	const { data }: import("./$types").PageProps = $props();
	const phrases = untrack(() => getSavedPhrasesState(data.ourProfileId));
	let text = $state("");
	void phrases.refresh();

	async function change(action: () => Promise<boolean>) {
		try {
			return await action();
		} catch (error) {
			showErrorToast({ label: "Failed to update saved phrases", error });
			return false;
		}
	}
</script>

<svelte:head><title>Saved Phrases</title></svelte:head>

<p class="text-sm text-muted-foreground">
	Order is saved on this device and resets on sign-out. To change a phrase,
	add a replacement and delete the original.
</p>

{#if phrases.error}
	<div role="alert" class="flex flex-wrap items-center gap-2">
		<p>Couldn’t load saved phrases.</p>
		<Button variant="outline" onclick={() => void phrases.refresh()}
			>Retry</Button
		>
	</div>
{:else if phrases.ordered === null}
	<p role="status">Loading saved phrases…</p>
{/if}

{#if phrases.ordered !== null}
	{#if phrases.ordered.length === 0}
		<p>No saved phrases yet.</p>
	{:else}
		<ul class="flex flex-col gap-3" aria-label="Saved phrases">
			{#each phrases.ordered as phrase, index (phrase.id)}
				<li data-slot="saved-phrase" class="rounded-2xl border p-3">
					<p class="break-words whitespace-pre-wrap">{phrase.text}</p>
					<div class="mt-2 flex flex-wrap gap-2">
						<Button
							type="button"
							size="sm"
							variant="outline"
							disabled={phrases.pending || index === 0}
							onclick={() =>
								void change(() =>
									phrases.move(index, index - 1),
								)}>Move up</Button
						>
						<Button
							type="button"
							size="sm"
							variant="outline"
							disabled={phrases.pending ||
								index === (phrases.ordered?.length ?? 0) - 1}
							onclick={() =>
								void change(() =>
									phrases.move(index, index + 1),
								)}>Move down</Button
						>
						<Button
							type="button"
							size="sm"
							variant="destructive"
							disabled={phrases.pending}
							onclick={() =>
								void change(() => phrases.remove(phrase.id))}
							>Delete</Button
						>
					</div>
				</li>
			{/each}
		</ul>
	{/if}
{/if}

<form
	class="flex flex-col gap-2"
	onsubmit={async (event) => {
		event.preventDefault();
		if (await change(() => phrases.add(text))) text = "";
	}}
>
	<label for="saved-phrase-text">New phrase</label>
	<Textarea
		id="saved-phrase-text"
		bind:value={text}
		disabled={phrases.pending}
	/>
	<Button
		type="submit"
		disabled={phrases.pending || phrases.ordered === null || !text.trim()}
		>Add phrase</Button
	>
</form>
