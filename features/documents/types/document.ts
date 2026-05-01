import { z } from 'zod';
import { DocumentType } from '$lib/generated/prisma/client';

// CUSTOMIZE: Adjust allowed MIME types for your use case
export const ALLOWED_MIME_TYPES = ['application/pdf'] as const;
export const MAX_FILE_SIZE = 1024 * 1024 * 50; // 50MB

export const createPresignedUrlSchema = z.object({
	type: z.enum(DocumentType),
	fileName: z.string().min(1).max(255),
	fileMimeType: z
		.string()
		.refine((val) => ALLOWED_MIME_TYPES.includes(val as (typeof ALLOWED_MIME_TYPES)[number]), {
			message: `Allowed MIME types: ${ALLOWED_MIME_TYPES.join(', ')}`
		}),
	fileSize: z.number().int().positive().max(MAX_FILE_SIZE)
	// CUSTOMIZE: Add fields for your entity relations, e.g.:
	// projectId: z.uuid().optional(),
});

export type CreatePresignedUrl = z.infer<typeof createPresignedUrlSchema>;

export const confirmS3UploadRequestSchema = z.object({
	documentId: z.uuid()
});

export type ConfirmS3UploadRequest = z.infer<typeof confirmS3UploadRequestSchema>;
