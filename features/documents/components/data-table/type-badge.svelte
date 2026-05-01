<script lang="ts">
	import { t } from '$lib/stores/i18nStore';
	import { Badge, type BadgeVariant } from '$lib/components/ui/badge';
	import type { DocumentType } from '$lib/generated/prisma/client';

	interface Props {
		type: DocumentType;
	}

	let { type }: Props = $props();

	// CUSTOMIZE: Update this config to match your DocumentType enum values and
	// choose colors that make sense for your document types.
	const config = $derived.by(() => {
		const typeConfig: Record<string, { label: string; variant: BadgeVariant; color: string }> = {
			GENERAL: {
				label: $t.documents.types.GENERAL,
				variant: 'secondary',
				color: 'bg-blue-100 text-blue-800'
			},
			CONTRACT: {
				label: $t.documents.types.CONTRACT,
				variant: 'default',
				color: 'bg-green-100 text-green-800'
			},
			REPORT: {
				label: $t.documents.types.REPORT,
				variant: 'default',
				color: 'bg-purple-100 text-purple-800'
			},
			OTHER: {
				label: $t.documents.types.OTHER,
				variant: 'outline',
				color: 'bg-gray-100 text-gray-800'
			}
		};
		return typeConfig[type] || { label: type, variant: 'secondary', color: 'bg-gray-100 text-gray-800' };
	});
</script>

<Badge variant={config.variant} class={config.color}>
	{config.label}
</Badge>
