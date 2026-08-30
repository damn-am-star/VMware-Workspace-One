<script lang="ts">
	import { getMessageContext, getMessageMetaContext } from "./context";
	import MediaImage from "$lib/components/shared/MediaImage.svelte";
	import { profileMediaUrl } from "$lib/util/media";

	let { imageHash }: { imageHash: string } = $props();

	const { isOut } = $derived(getMessageContext()());
	const { clone } = $derived(getMessageMetaContext()());

	const src = $derived(profileMediaUrl({mediaHash: imageHash, size: "thumb"}));
	
</script>

<div
	data-slot="message-quote"
	class={[
		"mb-1 flex max-w-100 items-end",
		{
			"flex-row-reverse": isOut,
			"ms-3": !isOut && !clone,
			"me-3": isOut && !clone,
		},
	]}
>
	<div
		class={[
			"h-4 w-5 flex-none border-t-2 border-muted-foreground/50",
			{
				"rounded-ss-quote-connector border-s-2": !isOut,
				"rounded-se-quote-connector border-e-2": isOut,
			},
		]}
	></div>
	<span
		class="mx-1 min-w-0 rounded-xl bg-muted px-3 py-1.5 text-sm text-muted-foreground"
	>
		<span class="line-clamp-1">Profile photo</span>
		<MediaImage
			{src}
			class="max-w-25 mb-1"
		/>
	</span>
</div>
