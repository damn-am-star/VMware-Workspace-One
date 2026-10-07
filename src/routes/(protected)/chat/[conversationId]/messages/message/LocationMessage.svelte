<script lang="ts">
	import { MapPinIcon } from "phosphor-svelte";

	import Link from "$lib/components/ui/link/Link.svelte";
	import type { LocationMessage } from "$lib/model/messaging/messages";
	import MessageBubble from "./MessageBubble.svelte";

	let { message }: { message: LocationMessage["body"] } = $props();

	const mapUrl = $derived(
		`https://www.google.com/maps/search/?api=1&query=${message.lat}%2C${message.lon}`,
	);
</script>

<MessageBubble tone="sent">
	<div class="flex items-center gap-3">
		<MapPinIcon size={28} weight="fill" aria-hidden="true" />
		<div>
			<div class="font-medium">Location</div>
			<div class="text-xs opacity-70">
				{message.lat.toFixed(5)}, {message.lon.toFixed(5)}
			</div>
			<Link href={mapUrl} class="text-sm underline underline-offset-2">
				Open map
			</Link>
		</div>
	</div>
</MessageBubble>
