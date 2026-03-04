import { scan, putItem, deleteItem, updateItem } from '../shared/dynamodb.mjs';
import { jsonResponse, errorResponse, parseBody } from '../shared/response.mjs';
import { FOLDERS_TABLE } from '../shared/constants.mjs';
import crypto from 'node:crypto';

export async function handler(event) {
  const method = event.httpMethod;
  const resource = event.resource;

  try {
    if (method === 'OPTIONS') {
      return jsonResponse(200, {});
    }

    if (resource === '/folders' && method === 'GET') {
      return await listFolders();
    }

    if (resource === '/folders' && method === 'POST') {
      return await createFolder(event);
    }

    if (resource === '/folders/{folderId}' && method === 'PUT') {
      return await renameFolder(event);
    }

    if (resource === '/folders/{folderId}' && method === 'DELETE') {
      return await removeFolder(event);
    }

    return errorResponse(404, 'Not found');
  } catch (err) {
    console.error('Folders handler error:', err);
    return errorResponse(500, err.message || 'Internal server error');
  }
}

async function listFolders() {
  const folders = await scan(FOLDERS_TABLE);
  return jsonResponse(200, { folders });
}

async function createFolder(event) {
  const body = parseBody(event);
  const { folderName, parentId } = body;

  if (!folderName) {
    return errorResponse(400, 'folderName is required');
  }

  const folder = {
    folderId: crypto.randomUUID(),
    folderName,
    parentId: parentId || undefined,
    mediaIds: [],
    createdAt: new Date().toISOString(),
  };

  await putItem(FOLDERS_TABLE, folder);
  return jsonResponse(201, { folder });
}

async function renameFolder(event) {
  const { folderId } = event.pathParameters || {};
  const body = parseBody(event);
  const { folderName } = body;

  if (!folderId) return errorResponse(400, 'folderId is required');
  if (!folderName) return errorResponse(400, 'folderName is required');

  const updated = await updateItem(
    FOLDERS_TABLE,
    { folderId },
    'SET folderName = :name',
    { ':name': folderName }
  );

  return jsonResponse(200, { folder: updated });
}

async function removeFolder(event) {
  const { folderId } = event.pathParameters || {};
  if (!folderId) return errorResponse(400, 'folderId is required');

  await deleteItem(FOLDERS_TABLE, { folderId });
  return jsonResponse(200, { success: true });
}
