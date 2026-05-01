import { json, error } from '@sveltejs/kit';
import logger from '$lib/utils/logger';
import prisma from '$lib/utils/prisma';
import type { RequestHandler } from './$types';

/**
 * DELETE /api/documents/[id] — Soft-delete a document.
 *
 * Access: ADMIN only (by default).
 *
 * CUSTOMIZE: Adjust access rules — e.g. allow document owner to delete,
 * or prevent deletion of certain document types.
 */
export const DELETE: RequestHandler = async ({ locals, params }) => {
	const user = locals.session?.user;
	logger.debug({ userId: user?.id, documentId: params.id }, 'DELETE /api/documents/[id]');

	if (!user) return error(401, 'Unauthorized');
	if (user.role !== 'ADMIN') return error(403, 'Forbidden');

	try {
		const document = await prisma.document.findUniqueOrThrow({
			where: { id: params.id }
		});

		// CUSTOMIZE: Add type-based deletion restrictions, e.g.:
		// if (document.type === 'INVOICE') {
		//   return error(400, 'Cannot delete invoice documents');
		// }

		// Soft delete
		await prisma.document.update({
			where: { id: params.id },
			data: { deletedAt: new Date() }
		});

		logger.info({ documentId: params.id, userId: user.id }, 'Document deleted successfully');

		return json({
			success: true,
			message: 'Document deleted successfully'
		});
	} catch (err) {
		logger.error({ err, documentId: params.id, userId: user.id }, 'Error deleting document');
		return error(500, 'Failed to delete document');
	}
};
