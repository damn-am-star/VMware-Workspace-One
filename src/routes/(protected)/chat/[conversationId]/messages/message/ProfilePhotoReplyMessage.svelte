<script lang="ts">
	import type { ProfilePhotoReplyMessage } from "$lib/model/messaging/messages";   
	import MessageBubble from "./MessageBubble.svelte";

	let { message }: { message: ProfilePhotoReplyMessage["body"] } = $props();
</script>

<MessageBubble tone="sent">
	<span class="wrap-anywhere whitespace-pre-wrap">{message.photoContentReply}</span>
</MessageBubble>
