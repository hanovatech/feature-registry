import { json, error } from '@sveltejs/kit';
import logger from '$lib/utils/logger';
import prisma from '$lib/utils/prisma';
import { getPresignedUrl } from '$lib/utils/s3';
import type { RequestHandler } from './$types';

/**
 * GET /api/documents/[id]/file — Generate a presigned URL to view or download a file.
 *
 * Query params:
 *  - download=true → sets Content-Disposition: attachment
 *
 * Access: ADMIN or document owner.
 *
 * CUSTOMIZE: Adjust access rules for your domain (e.g. project members,
 * team access, etc.)
 */
export const GET: RequestHandler = async ({ locals, params, url }) => {
  const user = locals.session?.user;
  const isDownload = url.searchParams.get('download');

  logger.debug({ userId: user?.id, documentId: params.id }, 'GET /api/documents/[id]/file');

  if (!user) {
    return error(401, 'Unauthorized');
  }

  try {
    const document = await prisma.document.findUniqueOrThrow({
      where: { id: params.id },
    });

    // Authorization: admin or uploader
    // CUSTOMIZE: Add your own access rules here
    if (user.role !== 'ADMIN') {
      return error(403, 'Forbidden');
    }

    // Generate presigned URL
    const presignedUrl = await getPresignedUrl(
      document.filePath,
      3600,
      isDownload
        ? {
            ResponseContentDisposition: `attachment; filename="${document.fileName}"`,
          }
        : undefined
    );

    logger.info({ documentId: params.id, userId: user.id }, 'Presigned URL generated for document');

    return json({
      downloadUrl: presignedUrl,
      fileName: document.fileName,
    });
  } catch (err) {
    logger.error({ err, documentId: params.id, userId: user.id }, 'Error generating download URL');
    return error(500, 'Failed to generate download URL');
  }
};
