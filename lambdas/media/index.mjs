import { scan, query, getItem, putItem, deleteItem, updateItem } from '../shared/dynamodb.mjs';
import { jsonResponse, errorResponse, parseBody } from '../shared/response.mjs';
import { MEDIA_TABLE, FOLDERS_TABLE, S3_BUCKET } from '../shared/constants.mjs';
import { S3Client, DeleteObjectCommand } from '@aws-sdk/client-s3';
import crypto from 'node:crypto';

const s3 = new S3Client({});

export async function handler(event) {
  const method = event.httpMethod;
  const resource = event.resource;

  try {
    if (method === 'OPTIONS') {
      return jsonResponse(200, {});
    }

    if (resource === '/media' && method === 'GET') {
      return await listMedia(event);
    }

    if (resource === '/media' && method === 'POST') {
      return await createMedia(event);
    }

    if (resource === '/media/{mediaId}/move' && method === 'PUT') {
      return await moveMedia(event);
    }

    if (resource === '/media/{mediaId}' && method === 'PUT') {
      return await editMedia(event);
    }

    if (resource === '/media/{mediaId}' && method === 'DELETE') {
      return await removeMedia(event);
    }

    return errorResponse(404, 'Not found');
  } catch (err) {
    console.error('Media handler error:', err);
    return errorResponse(500, err.message || 'Internal server error');
  }
}

async function listMedia(event) {
  const params = event.queryStringParameters || {};
  const { folderId, contentName, postId, dateFrom } = params;

  let items;

  if (folderId) {
    items = await query(
      MEDIA_TABLE,
      'folderId-index',
      'folderId = :fid',
      { ':fid': folderId }
    );
  } else {
    items = await scan(MEDIA_TABLE);
  }

  if (contentName) {
    const lower = contentName.toLowerCase();
    items = items.filter(m => m.contentName?.toLowerCase().includes(lower));
  }
  if (postId) {
    const lower = postId.toLowerCase();
    items = items.filter(m => m.postId?.toLowerCase().includes(lower));
  }
  if (dateFrom) {
    items = items.filter(m => m.publicationTimestamp >= dateFrom);
  }

  return jsonResponse(200, { media: items });
}

async function createMedia(event) {
  const body = parseBody(event);
  const { contentName, type, contentSrc, s3Key, cdnUrl, folderId } = body;
  const mediaId = body.mediaId || crypto.randomUUID();

  if (!contentName) return errorResponse(400, 'contentName is required');
  if (!folderId) return errorResponse(400, 'folderId is required');

  const media = {
    mediaId,
    contentName,
    type: type || 'external',
    contentSrc: contentSrc || '',
    s3Key: s3Key || '',
    cdnUrl: cdnUrl || '',
    folderId,
    postId: body.postId || null,
    existsIn: body.existsIn || [],
    publicationTimestamp: new Date().toISOString(),
    createdAt: new Date().toISOString(),
  };

  await putItem(MEDIA_TABLE, media);

  try {
    await updateItem(
      FOLDERS_TABLE,
      { folderId },
      'SET mediaIds = list_append(if_not_exists(mediaIds, :empty), :newId)',
      { ':newId': [mediaId], ':empty': [] }
    );
  } catch (err) {
    console.warn('Could not update folder mediaIds:', err.message);
  }

  return jsonResponse(201, { media });
}

async function editMedia(event) {
  const { mediaId } = event.pathParameters || {};
  if (!mediaId) return errorResponse(400, 'mediaId is required');

  const body = parseBody(event);
  const updates = [];
  const values = {};

  if (body.contentName !== undefined) {
    updates.push('contentName = :name');
    values[':name'] = body.contentName;
  }
  if (body.contentSrc !== undefined) {
    updates.push('contentSrc = :src');
    values[':src'] = body.contentSrc;
  }

  if (!updates.length) return errorResponse(400, 'No fields to update');

  const updated = await updateItem(
    MEDIA_TABLE,
    { mediaId },
    'SET ' + updates.join(', '),
    values
  );

  return jsonResponse(200, { media: updated });
}

async function moveMedia(event) {
  const { mediaId } = event.pathParameters || {};
  if (!mediaId) return errorResponse(400, 'mediaId is required');

  const body = parseBody(event);
  const { targetFolderId } = body;
  if (!targetFolderId) return errorResponse(400, 'targetFolderId is required');

  const existing = await getItem(MEDIA_TABLE, { mediaId });
  if (!existing) return errorResponse(404, 'Media not found');

  const sourceFolderId = existing.folderId;

  await updateItem(
    MEDIA_TABLE,
    { mediaId },
    'SET folderId = :fid',
    { ':fid': targetFolderId }
  );

  if (sourceFolderId) {
    try {
      await updateItem(
        FOLDERS_TABLE,
        { folderId: sourceFolderId },
        'DELETE mediaIds :mid',
        { ':mid': new Set([mediaId]) }
      );
    } catch {
      // SS (String Set) delete may fail if mediaIds is a list; use alternative approach
      const sourceFolder = await getItem(FOLDERS_TABLE, { folderId: sourceFolderId });
      if (sourceFolder?.mediaIds) {
        const filtered = sourceFolder.mediaIds.filter(id => id !== mediaId);
        await updateItem(
          FOLDERS_TABLE,
          { folderId: sourceFolderId },
          'SET mediaIds = :ids',
          { ':ids': filtered }
        );
      }
    }
  }

  try {
    await updateItem(
      FOLDERS_TABLE,
      { folderId: targetFolderId },
      'SET mediaIds = list_append(if_not_exists(mediaIds, :empty), :newId)',
      { ':newId': [mediaId], ':empty': [] }
    );
  } catch (err) {
    console.warn('Could not update target folder mediaIds:', err.message);
  }

  return jsonResponse(200, { success: true });
}

async function removeMedia(event) {
  const { mediaId } = event.pathParameters || {};
  if (!mediaId) return errorResponse(400, 'mediaId is required');

  const existing = await getItem(MEDIA_TABLE, { mediaId });
  if (!existing) return errorResponse(404, 'Media not found');

  await deleteItem(MEDIA_TABLE, { mediaId });

  if (existing.folderId) {
    try {
      const folder = await getItem(FOLDERS_TABLE, { folderId: existing.folderId });
      if (folder?.mediaIds) {
        const filtered = folder.mediaIds.filter(id => id !== mediaId);
        await updateItem(
          FOLDERS_TABLE,
          { folderId: existing.folderId },
          'SET mediaIds = :ids',
          { ':ids': filtered }
        );
      }
    } catch (err) {
      console.warn('Could not update folder mediaIds on delete:', err.message);
    }
  }

  if (existing.type === 'uploaded' && existing.s3Key) {
    try {
      await s3.send(new DeleteObjectCommand({ Bucket: S3_BUCKET, Key: existing.s3Key }));
    } catch (err) {
      console.warn('Could not delete S3 object:', err.message);
    }
  }

  return jsonResponse(200, { success: true });
}
