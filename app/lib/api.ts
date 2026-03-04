import type {
  Post,
  CreatePostInput,
  Folder,
  CreateFolderInput,
  MediaContent,
  CreateMediaInput,
  UpdateMediaInput,
  PresignResponse,
  MediaFilters,
} from '../logged/types';

const API_BASE = process.env.NEXT_PUBLIC_API_URL || '';

async function request<T>(path: string, options?: RequestInit): Promise<T> {
  const res = await fetch(`${API_BASE}${path}`, {
    headers: { 'Content-Type': 'application/json' },
    ...options,
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: res.statusText }));
    throw new Error(err.error || `Request failed: ${res.status}`);
  }
  return res.json();
}

// ── Posts ────────────────────────────────────────────────────────────────

export async function fetchPosts(): Promise<Post[]> {
  const data = await request<{ posts: Post[] }>('/posts');
  return data.posts;
}

export async function createPost(input: CreatePostInput): Promise<Post> {
  const data = await request<{ post: Post }>('/posts', {
    method: 'POST',
    body: JSON.stringify(input),
  });
  return data.post;
}

export async function deletePost(postId: string): Promise<void> {
  await request(`/posts/${postId}`, { method: 'DELETE' });
}

// ── Folders ─────────────────────────────────────────────────────────────

export async function fetchFolders(): Promise<Folder[]> {
  const data = await request<{ folders: RawFolder[] }>('/folders');
  return data.folders.map(normalizeFolder);
}

interface RawFolder {
  folderId: string;
  folderName: string;
  parentId?: string | null;
  mediaIds?: string[];
  createdAt?: string;
}

function normalizeFolder(raw: RawFolder): Folder {
  return {
    idFolder: raw.folderId,
    FolderName: raw.folderName,
    MediaArray: raw.mediaIds || [],
    parentId: raw.parentId ?? null,
  };
}

export async function createFolder(input: CreateFolderInput): Promise<Folder> {
  const data = await request<{ folder: RawFolder }>('/folders', {
    method: 'POST',
    body: JSON.stringify(input),
  });
  return normalizeFolder(data.folder);
}

export async function renameFolder(folderId: string, folderName: string): Promise<Folder> {
  const data = await request<{ folder: RawFolder }>(`/folders/${folderId}`, {
    method: 'PUT',
    body: JSON.stringify({ folderName }),
  });
  return normalizeFolder(data.folder);
}

export async function deleteFolder(folderId: string): Promise<void> {
  await request(`/folders/${folderId}`, { method: 'DELETE' });
}

// ── Media ───────────────────────────────────────────────────────────────

export async function fetchMedia(folderId?: string): Promise<MediaContent[]> {
  const query = folderId ? `?folderId=${encodeURIComponent(folderId)}` : '';
  const data = await request<{ media: MediaContent[] }>(`/media${query}`);
  return data.media;
}

export async function searchMedia(filters: MediaFilters): Promise<MediaContent[]> {
  const params = new URLSearchParams();
  if (filters.folderId) params.set('folderId', filters.folderId);
  if (filters.contentName) params.set('contentName', filters.contentName);
  if (filters.postId) params.set('postId', filters.postId);
  if (filters.dateFrom) params.set('dateFrom', filters.dateFrom);
  const qs = params.toString();
  const data = await request<{ media: MediaContent[] }>(`/media${qs ? '?' + qs : ''}`);
  return data.media;
}

export async function getPresignedUrl(filename: string, contentType: string): Promise<PresignResponse> {
  return request<PresignResponse>('/media/presign', {
    method: 'POST',
    body: JSON.stringify({ filename, contentType }),
  });
}

export async function uploadFileToS3(
  url: string,
  file: File,
  onProgress?: (percent: number) => void
): Promise<void> {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open('PUT', url);
    xhr.setRequestHeader('Content-Type', file.type);

    if (onProgress) {
      xhr.upload.onprogress = (e) => {
        if (e.lengthComputable) {
          onProgress(Math.round((e.loaded / e.total) * 100));
        }
      };
    }

    xhr.onload = () => {
      if (xhr.status >= 200 && xhr.status < 300) resolve();
      else reject(new Error(`S3 upload failed: ${xhr.status}`));
    };
    xhr.onerror = () => reject(new Error('S3 upload network error'));
    xhr.send(file);
  });
}

export async function createMedia(input: CreateMediaInput): Promise<MediaContent> {
  const data = await request<{ media: MediaContent }>('/media', {
    method: 'POST',
    body: JSON.stringify(input),
  });
  return data.media;
}

export async function updateMedia(mediaId: string, input: UpdateMediaInput): Promise<MediaContent> {
  const data = await request<{ media: MediaContent }>(`/media/${mediaId}`, {
    method: 'PUT',
    body: JSON.stringify(input),
  });
  return data.media;
}

export async function moveMedia(mediaId: string, targetFolderId: string): Promise<void> {
  await request(`/media/${mediaId}/move`, {
    method: 'PUT',
    body: JSON.stringify({ targetFolderId }),
  });
}

export async function deleteMedia(mediaId: string): Promise<void> {
  await request(`/media/${mediaId}`, { method: 'DELETE' });
}
