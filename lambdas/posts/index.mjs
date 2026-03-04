import { scan, putItem, deleteItem, batchGet } from '../shared/dynamodb.mjs';
import { jsonResponse, errorResponse, parseBody } from '../shared/response.mjs';
import { POSTS_TABLE, MEDIA_TABLE } from '../shared/constants.mjs';
import crypto from 'node:crypto';

export async function handler(event) {
  const method = event.httpMethod;
  const resource = event.resource;

  try {
    if (method === 'OPTIONS') {
      return jsonResponse(200, {});
    }

    if (resource === '/posts' && method === 'GET') {
      return await listPosts();
    }

    if (resource === '/posts' && method === 'POST') {
      return await createPost(event);
    }

    if (resource === '/posts/{postId}' && method === 'DELETE') {
      return await removePost(event);
    }

    return errorResponse(404, 'Not found');
  } catch (err) {
    console.error('Posts handler error:', err);
    return errorResponse(500, err.message || 'Internal server error');
  }
}

async function listPosts() {
  const posts = await scan(POSTS_TABLE);

  const allMediaIds = [...new Set(posts.flatMap(p => p.mediaIds || []))];
  const mediaKeys = allMediaIds.map(id => ({ mediaId: id }));
  const mediaItems = await batchGet(MEDIA_TABLE, mediaKeys);
  const mediaMap = Object.fromEntries(mediaItems.map(m => [m.mediaId, m]));

  const postsWithMedia = posts.map(post => ({
    ...post,
    media: (post.mediaIds || []).map(id => mediaMap[id]).filter(Boolean),
  }));

  return jsonResponse(200, { posts: postsWithMedia });
}

async function createPost(event) {
  const body = parseBody(event);
  const { title, subtitle, mediaIds } = body;

  if (!title) {
    return errorResponse(400, 'title is required');
  }

  const post = {
    postId: crypto.randomUUID(),
    title,
    subtitle: subtitle || '',
    mediaIds: mediaIds || [],
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };

  await putItem(POSTS_TABLE, post);
  return jsonResponse(201, { post });
}

async function removePost(event) {
  const { postId } = event.pathParameters || {};
  if (!postId) {
    return errorResponse(400, 'postId is required');
  }

  await deleteItem(POSTS_TABLE, { postId });
  return jsonResponse(200, { success: true });
}
