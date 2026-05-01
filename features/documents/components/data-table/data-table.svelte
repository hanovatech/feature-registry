<script lang="ts">
	import type { ColumnDef } from '@tanstack/table-core';
	import type { Document } from '$lib/generated/prisma/client';
	import type { Snippet } from 'svelte';
	import { t } from '$lib/stores/i18nStore';
	import { createSvelteTable, FlexRender } from '$lib/components/ui/data-table';
	import * as Table from '$lib/components/ui/table';
	import { getCoreRowModel } from '@tanstack/table-core';
	import SelectFilter from '$lib/components/registry/select-filter/select-filter.svelte';
	import Pagination from '$lib/components/registry/pagination/pagination.svelte';

	interface Props {
		data: {
			documents: Document[];
			meta: { total: number; limit: number };
		};
		columns: ColumnDef<Document>[];
		children?: Snippet;
	}

	let { data, columns, children }: Props = $props();

	const table = createSvelteTable({
		get data() {
			return data.documents;
		},
		get columns() {
			return columns;
		},
		getCoreRowModel: getCoreRowModel()
	});

	// CUSTOMIZE: Update these options to match your DocumentType enum values
	const typeFilterOptions = $derived([
		{ value: '', label: $t.documents.allTypes },
		{ value: 'GENERAL', label: $t.documents.types.GENERAL },
		{ value: 'CONTRACT', label: $t.documents.types.CONTRACT },
		{ value: 'REPORT', label: $t.documents.types.REPORT },
		{ value: 'OTHER', label: $t.documents.types.OTHER }
	]);
</script>

<div class="space-y-4">
	<!-- Filters -->
	<div class="flex flex-col sm:flex-row gap-3 justify-between">
		<SelectFilter
			key="type"
			placeholder={$t.documents.allTypes}
			options={typeFilterOptions}
		/>
		{#if children}
			<div class="flex items-center gap-2 flex-wrap">
				{@render children()}
			</div>
		{/if}
	</div>

	<div class="overflow-x-auto border rounded-lg">
		<Table.Root>
			<Table.Header>
				{#each table.getHeaderGroups() as headerGroup (headerGroup.id)}
					<Table.Row>
						{#each headerGroup.headers as header (header.id)}
							<Table.Head>
								{#if !header.isPlaceholder}
									<FlexRender
										content={header.column.columnDef.header}
										context={header.getContext()}
									/>
								{/if}
							</Table.Head>
						{/each}
					</Table.Row>
				{/each}
			</Table.Header>
			<Table.Body>
				{#each table.getRowModel().rows as row (row.id)}
					<Table.Row>
						{#each row.getVisibleCells() as cell (cell.id)}
							<Table.Cell>
								<FlexRender
									content={cell.column.columnDef.cell}
									context={cell.getContext()}
								/>
							</Table.Cell>
						{/each}
					</Table.Row>
				{/each}
				{#if table.getRowModel().rows.length === 0}
					<Table.Row>
						<Table.Cell colspan={columns.length} class="h-24 text-center">
							{$t.common.noResults}
						</Table.Cell>
					</Table.Row>
				{/if}
			</Table.Body>
		</Table.Root>
	</div>

	<Pagination total={data.meta.total} perPage={data.meta.limit} />
</div>
