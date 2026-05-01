import { renderComponent } from '$lib/components/ui/data-table';
import DataTableActions from './data-table-actions.svelte';
import TypeBadge from './type-badge.svelte';
import moment from 'moment';
import type { ColumnDef } from '@tanstack/table-core';
import type { Document } from '$lib/generated/prisma/client';
import type { Translations } from '$lib/types/i18n';

export function getColumns(translations: Translations): ColumnDef<Document>[] {
	return [
		{
			accessorKey: 'fileName',
			header: translations.documents.columns.fileName,
			cell: ({ row }) => row.original.fileName || '-'
		},
		{
			accessorKey: 'type',
			header: translations.documents.columns.type,
			cell: ({ row }) => {
				return renderComponent(TypeBadge, { type: row.original.type });
			}
		},
		{
			accessorKey: 'fileSize',
			header: translations.documents.columns.fileSize,
			cell: ({ row }) => {
				const bytes = row.original.fileSize;
				if (bytes === 0) return '0 Bytes';
				const k = 1024;
				const sizes = ['Bytes', 'KB', 'MB', 'GB'];
				const i = Math.floor(Math.log(bytes) / Math.log(k));
				return (bytes / Math.pow(k, i)).toFixed(2) + ' ' + sizes[i];
			}
		},
		{
			accessorKey: 'createdAt',
			header: translations.documents.columns.createdAt,
			cell: ({ row }) => moment(row.original.createdAt).format('DD.MM.YYYY, HH:mm')
		},
		{
			id: 'actions',
			cell: ({ row }) => {
				return renderComponent(DataTableActions, {
					document: row.original
				});
			}
		}
	];
}
