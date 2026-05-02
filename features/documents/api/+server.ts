import { json, error } from '@sveltejs/kit';
import logger from '$lib/utils/logger';
import prisma from '$lib/utils/prisma';
import { DocumentType, DocumentStatus } from '$lib/generated/prisma/client';
import type { RequestHandler } from './$types';
import type { DocumentWhereInput } from '$lib/generated/prisma/models';

/**
 * GET /api/documents — List documents with pagination and filters.
 *
 * Access:
 *  - ADMIN: sees all documents
 *  - Other roles: see only documents they uploaded
 *
 * CUSTOMIZE: Adjust role-based filtering for your domain (e.g. project members,
 * team leads, etc.)
 */
export const GET: RequestHandler = async ({ locals, url }) => {
  const user = locals.session?.user;
  logger.debug({ userId: user?.id }, 'GET /api/documents');

  if (!user) {
    return error(401, 'Unauthorized');
  }

  try {
    const whereClause: DocumentWhereInput = {
      deletedAt: null,
    };

    // CUSTOMIZE: Add role-based scoping for your domain

    // Filter by type
    const typeParam = url.searchParams.get('type');
    if (typeParam && Object.values(DocumentType).includes(typeParam as DocumentType)) {
      whereClause.type = typeParam as DocumentType;
    }

    // Filter by status
    const statusParam = url.searchParams.get('status');
    if (statusParam && Object.values(DocumentStatus).includes(statusParam as DocumentStatus)) {
      whereClause.status = statusParam as DocumentStatus;
    }

    // Pagination
    const page = Math.max(1, parseInt(url.searchParams.get('page') || '1'));
    const limit = Math.min(100, Math.max(1, parseInt(url.searchParams.get('limit') || '10')));
    const skip = (page - 1) * limit;

    const [documents, total] = await Promise.all([
      prisma.document.findMany({
        where: whereClause,
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
      }),
      prisma.document.count({ where: whereClause }),
    ]);

    logger.info({ total, page, limit, userId: user.id }, 'Documents list retrieved successfully');

    return json({
      data: documents,
      meta: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    });
  } catch (err) {
    logger.error({ err, userId: user.id }, 'Error fetching documents');
    return error(500, 'Internal Server Error');
  }
};
