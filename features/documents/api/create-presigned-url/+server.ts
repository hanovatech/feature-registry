import { json, error } from '@sveltejs/kit';
import prisma from '$lib/utils/prisma';
import logger from '$lib/utils/logger';
import { getPresignedUploadUrl } from '$lib/utils/s3';
import { DocumentStatus } from '$lib/generated/prisma/client';
import { createPresignedUrlSchema } from '$lib/types/document';
import type { RequestHandler } from './$types';

/**
 * POST /api/documents/create-presigned-url
 *
 * Creates a pending Document record and returns a presigned S3 URL
 * for the client to upload the file directly.
 *
 * CUSTOMIZE: Add role-based restrictions on which types can be uploaded
 * by which roles.
 */
export const POST: RequestHandler = async ({ request, locals }) => {
	const user = locals.session?.user;

	if (!user) {
		return error(401, 'Unauthorized');
	}

	try {
		const body = await request.json();
		const validationResult = createPresignedUrlSchema.safeParse(body);
		if (!validationResult.success) {
			return error(400, 'Error validating request data');
		}

		const { type, fileName, fileMimeType, fileSize } = validationResult.data;

		// Create a document record in the database
		const documentId = crypto.randomUUID();
		const s3Key = `documents/${documentId}/${fileName}`;

		const document = await prisma.document.create({
			data: {
				id: documentId,
				status: DocumentStatus.PENDING,
				type,
				fileName,
				filePath: s3Key,
				fileMimeType,
				fileSize,
				uploadedBy: { connect: { id: user.id } }
				// CUSTOMIZE: Add your entity relations here, e.g.:
				// project: { connect: { id: validationResult.data.projectId } },
			}
		});

		// Generate presigned URL for client-side upload
		const presignedUrl = await getPresignedUploadUrl(s3Key, fileMimeType, 3600);

		logger.info(
			{ documentId: document.id, userId: user.id },
			'Presigned upload URL generated'
		);

		return json({
			presignedUrl,
			documentId: document.id
		});
	} catch (err) {
		logger.error({ err }, 'Presigned URL error');
		return error(500, 'Failed to generate upload URL');
	}
};
