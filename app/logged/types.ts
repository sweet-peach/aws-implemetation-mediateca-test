export interface MediaContent {
  mediaId: string;
  contentName: string;
  publicationTimestamp: string;
  contentSrc: string;
  type?: 'uploaded' | 'external';
  s3Key?: string;
  cdnUrl?: string;
  postId?: string;
  existsIn?: string[];
  folderId?: string;
}

export interface Folder {
  idFolder: string;
  FolderName: string;
  MediaArray: string[];
  parentId?: string | null;
}

export interface Post {
  postId: string;
  title: string;
  subtitle: string;
  mediaIds: string[];
  media?: MediaContent[];
  createdAt?: string;
  updatedAt?: string;
}

export interface CreatePostInput {
  title: string;
  subtitle: string;
  mediaIds: string[];
}

export interface CreateFolderInput {
  folderName: string;
  parentId?: string | null;
}

export interface CreateMediaInput {
  mediaId?: string;
  contentName: string;
  type: 'uploaded' | 'external';
  contentSrc?: string;
  s3Key?: string;
  cdnUrl?: string;
  folderId: string;
}

export interface UpdateMediaInput {
  contentName?: string;
  contentSrc?: string;
}

export interface PresignResponse {
  uploadUrl: string;
  mediaId: string;
  s3Key: string;
  cdnUrl: string;
}

export interface MediaFilters {
  folderId?: string;
  contentName?: string;
  postId?: string;
  dateFrom?: string;
}
