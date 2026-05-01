<script lang="ts">
	import { invalidateAll } from '$app/navigation';
	import user from '$lib/stores/userStore';
	import { t } from '$lib/stores/i18nStore';
	import { toast } from 'svelte-sonner';
	import { Button } from '$lib/components/ui/button';
	import * as DropdownMenu from '$lib/components/ui/dropdown-menu';
	import * as Dialog from '$lib/components/ui/dialog';
	import EllipsisVertical from '@lucide/svelte/icons/ellipsis-vertical';
	import Eye from '@lucide/svelte/icons/eye';
	import Download from '@lucide/svelte/icons/download';
	import Trash from '@lucide/svelte/icons/trash-2';
	import type { Document } from '$lib/generated/prisma/client';

	interface Props {
		document: Document;
	}

	let { document: doc }: Props = $props();
	let isDeleteModalOpen = $state(false);

	async function handleView() {
		try {
			const response = await fetch(`/api/documents/${doc.id}/file`);
			if (!response.ok) {
				toast.error($t.documents.messages.viewError);
				return;
			}
			const { downloadUrl } = await response.json();
			window.open(downloadUrl, '_blank');
		} catch (err) {
			console.error('Error viewing document:', err);
			toast.error($t.documents.messages.viewError);
		}
	}

	async function handleDownload() {
		try {
			const response = await fetch(`/api/documents/${doc.id}/file?download=true`);
			if (!response.ok) {
				toast.error($t.documents.messages.downloadError);
				return;
			}
			const { downloadUrl, fileName } = await response.json();

			const link = document.createElement('a');
			link.href = downloadUrl;
			link.download = fileName;
			document.body.appendChild(link);
			link.click();
			document.body.removeChild(link);
		} catch (err) {
			console.error('Error downloading document:', err);
			toast.error($t.documents.messages.downloadError);
		}
	}

	async function confirmDelete() {
		try {
			const response = await fetch(`/api/documents/${doc.id}`, {
				method: 'DELETE'
			});
			if (!response.ok) {
				toast.error($t.documents.messages.deleteError);
				return;
			}
			toast.success($t.documents.messages.deleteSuccess);
			await invalidateAll();
		} catch (err) {
			console.error('Error deleting document:', err);
			toast.error($t.documents.messages.deleteError);
		} finally {
			isDeleteModalOpen = false;
		}
	}

	// CUSTOMIZE: Adjust delete permission logic for your roles
	const canDelete = $derived($user?.role === 'ADMIN');
</script>

<div class="flex gap-2 justify-end">
	<DropdownMenu.Root>
		<DropdownMenu.Trigger>
			<Button variant="ghost" size="icon">
				<EllipsisVertical />
			</Button>
		</DropdownMenu.Trigger>
		<DropdownMenu.Content align="end">
			<DropdownMenu.Item onclick={handleView}>
				<Eye class="mr-2" />
				{$t.documents.actions.view}
			</DropdownMenu.Item>
			<DropdownMenu.Item onclick={handleDownload}>
				<Download class="mr-2" />
				{$t.documents.actions.download}
			</DropdownMenu.Item>
			{#if canDelete}
				<DropdownMenu.Item onclick={() => (isDeleteModalOpen = true)} class="text-red-600">
					<Trash class="mr-2" />
					{$t.documents.actions.delete}
				</DropdownMenu.Item>
			{/if}
		</DropdownMenu.Content>
	</DropdownMenu.Root>
</div>

<Dialog.Root bind:open={isDeleteModalOpen}>
	<Dialog.Content>
		<Dialog.Header>
			<Dialog.Title>{$t.documents.messages.deleteConfirmTitle}</Dialog.Title>
		</Dialog.Header>
		<p>{$t.documents.messages.deleteConfirm}</p>
		<Dialog.Footer>
			<Button variant="outline" onclick={() => (isDeleteModalOpen = false)}>
				{$t.common.cancel}
			</Button>
			<Button variant="destructive" onclick={confirmDelete}>
				{$t.documents.actions.delete}
			</Button>
		</Dialog.Footer>
	</Dialog.Content>
</Dialog.Root>
