<script lang="ts">
	import { ChatTextIcon } from "phosphor-svelte";
	import { untrack } from "svelte";

	import { getConversations } from "$lib/chat/conversations-context.svelte";
	import { Button } from "$lib/components/ui/button";
	import * as Drawer from "$lib/components/ui/drawer";
	import { getSavedPhrasesState } from "$lib/phrases/saved-phrases-state.svelte";
	import { dismissOnBackGesture } from "$lib/platform/back-gesture-event.svelte";
	import ComposerButton from "./ComposerButton.svelte";
	import { getMessageComposerContext } from "./message-composer-context.svelte";

	let {
		onOpen,
		onSelect,
		onFocusInput,
	}: {
		onOpen: () => void;
		onSelect: (text: string) => void;
		onFocusInput: () => void;
	} = $props();
	const phrases = untrack(() =>
		getSavedPhrasesState(getConversations().ourProfileId),
	);
	const { disabled } = $derived(getMessageComposerContext()());
	let open = $state(false);

	dismissOnBackGesture({ active: () => open, dismiss: () => (open = false) });
</script>

<ComposerButton
	class="left-0"
	aria-label="Saved phrases"
	aria-haspopup="dialog"
	aria-expanded={open}
	{disabled}
	onclick={() => {
		onOpen();
		open = true;
		void phrases.refresh();
	}}
>
	{#snippet icon(props)}<ChatTextIcon {...props} />{/snippet}
</ComposerButton>

<Drawer.Root bind:open>
	<Drawer.Content
		class="mx-auto max-h-[70dvh] max-w-120"
		onCloseAutoFocus={(event) => {
			event.preventDefault();
			onFocusInput();
		}}
	>
		<Drawer.Header>
			<Drawer.Title>Saved phrases</Drawer.Title>
			<Drawer.Description
				>Choose a phrase to insert into your draft.</Drawer.Description
			>
		</Drawer.Header>
		<Drawer.Body class="flex flex-col gap-2 px-4">
			{#if phrases.error}
				<p role="alert">Couldn’t load saved phrases.</p>
				<Button variant="outline" onclick={() => void phrases.refresh()}
					>Retry</Button
				>
			{:else if phrases.ordered === null}
				<p role="status">Loading saved phrases…</p>
			{/if}
			{#if phrases.ordered !== null}
				{#if phrases.ordered.length === 0}<p>
						No saved phrases yet.
					</p>{/if}
				{#each phrases.ordered as phrase (phrase.id)}
					<Button
						type="button"
						variant="outline"
						class="h-auto min-h-10 justify-start text-left break-words whitespace-pre-wrap"
						{disabled}
						onclick={() => {
							onSelect(phrase.text);
							open = false;
						}}>{phrase.text}</Button
					>
				{/each}
			{/if}
		</Drawer.Body>
		<Drawer.Footer>
			<Button
				variant="link"
				href="/settings/phrases"
				onclick={() => (open = false)}>Manage in settings</Button
			>
			<Drawer.Close>Close</Drawer.Close>
		</Drawer.Footer>
	</Drawer.Content>
</Drawer.Root>
