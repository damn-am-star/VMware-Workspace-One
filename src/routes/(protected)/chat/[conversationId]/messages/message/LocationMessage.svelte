<script lang="ts">
	import type { LocationMessage } from "$lib/model/messaging/messages";
	import MessageBubble from "./MessageBubble.svelte";
	import Link from "$lib/components/ui/link/Link.svelte";
	import { MapPinIcon } from "phosphor-svelte";

	let { message }: { message: LocationMessage["body"] } = $props();
</script>

<MessageBubble tone="sent">
	<span class="whitespace-pre-wrap wrap-anywhere ">
		<Link href="https://www.google.com/maps/place/{message.lat},{message.lon}">
			<MapPinIcon weight="fill" class="block text-4xl" />
			<span class="font-semibold">Location shared</span>
		</Link>
	</span>
</MessageBubble>
