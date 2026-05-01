import { json, error } from '@sveltejs/kit';
import prisma from '$lib/utils/prisma';
import logger from '$lib/utils/logger';
import { headObject } from '$lib/utils/s3';
import { DocumentStatus } from '$lib/generated/prisma/client';
import { confirmS3UploadRequestSchema } from '$lib/types/document';
import type { RequestHandler } from './$types';

/**
 * POST /api/documents/confirm-presigned-upload
 *
 * After the client uploads a file directly to S3 via presigned URL,
 * this endpoint verifies the file exists in S3 and updates the
 * document status from PENDING to UPLOADED (or FAILED).
 */
export const POST: RequestHandler = async ({ request, locals }) => {
	const user = locals.session?.user;

	if (!user) {
		return error(401, 'Unauthorized');
	}

	let documentId: string | undefined;

	try {
		const body = await request.json();

		const validationResult = confirmS3UploadRequestSchema.safeParse(body);
		if (!validationResult.success) {
			return error(400, 'Error validating request data');
		}

		documentId = validationResult.data.documentId;

		// Verify document exists
		const document = await prisma.document.findUnique({
			where: { id: documentId }
		});

		if (!document) {
			return error(404, 'Document not found');
		}

		// Verify file exists in S3
		await headObject(document.filePath);

		// Update document status to UPLOADED
		const updatedDocument = await prisma.document.update({
			where: { id: documentId },
			data: {
				status: DocumentStatus.UPLOADED
			}
		});

		logger.info({ documentId, userId: user.id }, 'Document upload confirmed');

		return json({
			success: true,
			document: updatedDocument
		});
	} catch (err) {
		logger.error({ err, documentId }, 'Confirm upload error');

		// Mark document as FAILED if verification failed
		if (documentId) {
			try {
				await prisma.document.update({
					where: { id: documentId },
					data: { status: DocumentStatus.FAILED }
				});
			} catch {
				logger.error({ documentId }, 'Failed to update document status to FAILED');
			}
		}

		return error(500, 'Failed to confirm upload');
	}
};
