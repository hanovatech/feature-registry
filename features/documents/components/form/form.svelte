<script lang="ts">
	import { invalidateAll } from '$app/navigation';
	import { t } from '$lib/stores/i18nStore';
	import { toast } from 'svelte-sonner';
	import { Button } from '$lib/components/ui/button';
	import { Label } from '$lib/components/ui/label';
	import * as Alert from '$lib/components/ui/alert';
	import * as Select from '$lib/components/ui/select';
	import AlertCircle from '@lucide/svelte/icons/alert-circle';
	import Upload from '@lucide/svelte/icons/upload';
	import X from '@lucide/svelte/icons/x';
	import { SheetForm } from '$lib/components/registry/sheet';

	interface Props {
		open?: boolean;
		onOpenChange?: (open: boolean) => void;
	}

	let {
		open = $bindable(false),
		onOpenChange
	}: Props = $props();

	interface UploadProgress {
		loaded: number;
		total: number;
		percentage: number;
	}

	// CUSTOMIZE: Adjust allowed types and max size for your use case
	const ALLOWED_MIME_TYPES = ['application/pdf'] as const;
	const MAX_FILE_SIZE = 50 * 1024 * 1024; // 50MB

	let fileInput = $state<HTMLInputElement | undefined>();
	let selectedFile = $state<File | null>(null);
	let isUploading = $state(false);
	let uploadProgress = $state<UploadProgress>({ loaded: 0, total: 0, percentage: 0 });
	let error = $state<string | null>(null);
	let documentType = $state('');

	let canSubmit = $derived(!!selectedFile && !!documentType && !isUploading);

	// CUSTOMIZE: Update to match your DocumentType enum
	const getDocumentTypeLabel = () => {
		return documentType
			? ($t.documents.types[documentType as keyof typeof $t.documents.types] || documentType)
			: $t.documents.form.selectDocumentType;
	};

	function formatFileSize(bytes: number): string {
		if (bytes === 0) return '0 Bytes';
		const k = 1024;
		const sizes = ['Bytes', 'KB', 'MB', 'GB'];
		const i = Math.floor(Math.log(bytes) / Math.log(k));
		return Math.round((bytes / Math.pow(k, i)) * 100) / 100 + ' ' + sizes[i];
	}

	function validateFile(file: File): string | null {
		if (file.size > MAX_FILE_SIZE) {
			return `${$t.documents.form.messages.fileSizeExceeds} ${formatFileSize(MAX_FILE_SIZE)}`;
		}
		if (!ALLOWED_MIME_TYPES.includes(file.type as (typeof ALLOWED_MIME_TYPES)[number])) {
			return `${$t.documents.form.messages.fileTypeNotSupported} ${ALLOWED_MIME_TYPES.join(', ')}`;
		}
		return null;
	}

	function handleFileSelect(e: Event) {
		error = null;
		const target = e.target as HTMLInputElement;
		const file = target.files?.[0];
		if (!file) return;

		const validationError = validateFile(file);
		if (validationError) {
			error = validationError;
			selectedFile = null;
			return;
		}
		selectedFile = file;
	}

	async function handleUpload() {
		if (!selectedFile || !documentType) {
			error = $t.documents.form.messages.selectTypeAndFile;
			return;
		}

		const file = selectedFile;
		isUploading = true;
		error = null;

		try {
			// 1. Request presigned URL from backend
			const presignedResponse = await fetch('/api/documents/create-presigned-url', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({
					type: documentType,
					fileName: file.name,
					fileMimeType: file.type,
					fileSize: file.size
					// CUSTOMIZE: Add your entity relations here, e.g.:
					// projectId: selectedProjectId,
				})
			});

			if (!presignedResponse.ok) {
				let errorMessage = $t.documents.form.messages.failedGetUrl;
				try {
					const data = await presignedResponse.json();
					errorMessage = data.message || data.error || errorMessage;
				} catch {
					errorMessage = `Error: ${presignedResponse.status} ${presignedResponse.statusText}`;
				}
				throw new Error(errorMessage);
			}

			const { presignedUrl, documentId } = await presignedResponse.json();

			// 2. Upload file directly to S3 with progress tracking
			await new Promise<void>((resolve, reject) => {
				const xhr = new XMLHttpRequest();

				xhr.upload.addEventListener('progress', (event) => {
					if (event.lengthComputable) {
						uploadProgress = {
							loaded: event.loaded,
							total: event.total,
							percentage: Math.round((event.loaded / event.total) * 100)
						};
					}
				});

				xhr.addEventListener('load', () => {
					if (xhr.status >= 200 && xhr.status < 300) {
						resolve();
					} else {
						reject(new Error($t.documents.form.messages.failedUploadStorage));
					}
				});

				xhr.addEventListener('error', () => {
					reject(new Error($t.documents.form.messages.uploadRequestFailed));
				});

				xhr.open('PUT', presignedUrl);
				xhr.setRequestHeader('Content-Type', file.type);
				xhr.send(file);
			});

			// 3. Confirm upload with backend
			const confirmResponse = await fetch('/api/documents/confirm-presigned-upload', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ documentId })
			});

			if (!confirmResponse.ok) {
				throw new Error($t.documents.form.messages.failedConfirm);
			}

			toast.success($t.documents.form.messages.uploadSuccess.replace('{name}', file.name));
			selectedFile = null;
			documentType = '';
			uploadProgress = { loaded: 0, total: 0, percentage: 0 };
			if (fileInput) fileInput.value = '';
			open = false;
			await invalidateAll();
		} catch (err) {
			error = err instanceof Error ? err.message : $t.documents.form.messages.uploadFailed;
			console.error('Upload error:', err);
		} finally {
			isUploading = false;
		}
	}

	function clearFile() {
		selectedFile = null;
		error = null;
		if (fileInput) fileInput.value = '';
	}

	function handleDragOver(e: DragEvent) {
		e.preventDefault();
		e.stopPropagation();
	}

	function handleDrop(e: DragEvent) {
		e.preventDefault();
		e.stopPropagation();

		const files = e.dataTransfer?.files;
		if (files && files.length > 0) {
			error = null;
			const validationError = validateFile(files[0]);
			if (validationError) {
				error = validationError;
				selectedFile = null;
				return;
			}
			selectedFile = files[0];
		}
	}

	$effect(() => {
		if (!open) {
			error = null;
			selectedFile = null;
			documentType = '';
			uploadProgress = { loaded: 0, total: 0, percentage: 0 };
			if (fileInput) fileInput.value = '';
		}
	});

	function handleFormSubmit(e: SubmitEvent) {
		e.preventDefault();
		handleUpload();
	}
</script>

<SheetForm
	bind:open
	title={$t.documents.form.title}
	description={$t.documents.form.description}
	{onOpenChange}
	onSubmit={handleFormSubmit}
>
	{#snippet footer()}
		<div class="flex justify-end gap-2 pt-4">
			<Button type="button" variant="outline" onclick={() => (open = false)} disabled={isUploading}>
				{$t.common.cancel}
			</Button>
			<Button type="submit" disabled={!canSubmit}>
				{isUploading ? $t.common.uploading : $t.common.upload}
			</Button>
		</div>
	{/snippet}

	<!-- Document Type -->
	<div class="space-y-2">
		<Label for="document-type">
			{$t.documents.form.documentType}<span class="text-red-500">*</span>
		</Label>
		<!-- CUSTOMIZE: Update Select.Item values to match your DocumentType enum -->
		<Select.Root type="single" bind:value={documentType} disabled={isUploading}>
			<Select.Trigger id="document-type" class="w-full">
				<span data-slot="select-value">
					{getDocumentTypeLabel()}
				</span>
			</Select.Trigger>
			<Select.Content>
				<Select.Item value="GENERAL" label={$t.documents.types.GENERAL}>
					{$t.documents.types.GENERAL}
				</Select.Item>
				<Select.Item value="CONTRACT" label={$t.documents.types.CONTRACT}>
					{$t.documents.types.CONTRACT}
				</Select.Item>
				<Select.Item value="REPORT" label={$t.documents.types.REPORT}>
					{$t.documents.types.REPORT}
				</Select.Item>
				<Select.Item value="OTHER" label={$t.documents.types.OTHER}>
					{$t.documents.types.OTHER}
				</Select.Item>
			</Select.Content>
		</Select.Root>
	</div>

	<!-- CUSTOMIZE: Add entity selection fields here, e.g.:
	<div class="space-y-2">
		<Label for="project">Project</Label>
		<Select.Root type="single" bind:value={selectedProjectId}>
			...
		</Select.Root>
	</div>
	-->

	<!-- File Input -->
	{#if !selectedFile}
		<div class="space-y-2">
			<Label for="document">{$t.documents.form.documentInput}</Label>
			<div
				class="relative border-2 border-dashed border-gray-300 rounded-lg p-8 text-center cursor-pointer transition-colors hover:border-gray-400 hover:bg-gray-50"
				ondragover={handleDragOver}
				ondrop={handleDrop}
				role="button"
				tabindex="0"
				onkeydown={(e) => e.key === 'Enter' && fileInput?.click()}
				onclick={() => fileInput?.click()}
			>
				<input
					bind:this={fileInput}
					id="document"
					type="file"
					accept={ALLOWED_MIME_TYPES.join(',')}
					onchange={handleFileSelect}
					class="hidden"
					disabled={isUploading}
				/>
				<div class="space-y-2">
					<Upload class="mx-auto h-8 w-8 text-gray-400" />
					<div>
						<p class="text-sm font-medium text-gray-900">
							{$t.documents.form.dragDrop}
						</p>
						<p class="text-xs text-gray-500 mt-1">
							PDF (max {formatFileSize(MAX_FILE_SIZE)})
						</p>
					</div>
				</div>
			</div>
		</div>
	{:else}
		<Label for="document">{$t.documents.form.documentInput}</Label>
		<div class="border rounded-lg p-4">
			<div class="flex items-start justify-between">
				<div class="flex-1">
					<p class="font-medium text-sm text-gray-900">{selectedFile.name}</p>
					<p class="text-xs text-gray-500 mt-1">{formatFileSize(selectedFile.size)}</p>

					{#if isUploading}
						<div class="mt-3 space-y-2">
							<div class="w-full bg-gray-200 rounded-full h-2">
								<div
									class="bg-blue-600 h-2 rounded-full transition-all duration-300"
									style="width: {uploadProgress.percentage}%"
								></div>
							</div>
							<p class="text-xs text-gray-600">{uploadProgress.percentage}%</p>
						</div>
					{/if}
				</div>

				{#if !isUploading}
					<button
						onclick={clearFile}
						class="ml-4 text-gray-400 hover:text-gray-600 transition-colors"
						type="button"
						aria-label="Remove file"
					>
						<X class="h-5 w-5" />
					</button>
				{/if}
			</div>
		</div>
	{/if}

	<!-- Error Alert -->
	{#if error}
		<Alert.Root variant="destructive">
			<AlertCircle class="h-4 w-4" />
			<Alert.Title>{$t.common.error}</Alert.Title>
			<Alert.Description>{error}</Alert.Description>
		</Alert.Root>
	{/if}
</SheetForm>
