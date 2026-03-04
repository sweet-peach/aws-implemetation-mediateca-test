'use client';

import React, { useEffect, useState } from 'react';
import Image from 'next/image';
import { fetchPosts, ensureAbsoluteMediaUrl } from './lib/api';
import type { Post } from './logged/types';

function resolveImageSrc(post: Post): string {
  const media = post.media?.[0];
  if (!media) return '';
  return ensureAbsoluteMediaUrl(media.cdnUrl || media.contentSrc || '');
}

const PostList: React.FC = () => {
  const [posts, setPosts] = useState<Post[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchPosts()
      .then(setPosts)
      .catch(err => setError(err.message))
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <div className="flex justify-center py-12">
        <p className="text-gray-500">Cargando posts...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex justify-center py-12">
        <p className="text-red-500">Error: {error}</p>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6 p-6">
      {posts.map((post) => {
        const mediaSrc = resolveImageSrc(post);
        return (
          <div
            key={post.postId}
            className="bg-white rounded-lg shadow-md overflow-hidden hover:shadow-lg transition-shadow"
          >
            {mediaSrc && (
              <div className="relative w-full h-48">
                <Image
                  src={mediaSrc}
                  alt={post.title}
                  fill
                  className="object-cover"
                  sizes="(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 33vw"
                />
              </div>
            )}
            <div className="p-4">
              <h3 className="text-xl font-bold text-gray-800 mb-2">{post.title}</h3>
              <p className="text-gray-600 text-sm">{post.subtitle}</p>
            </div>
          </div>
        );
      })}
      {posts.length === 0 && (
        <p className="col-span-full text-center text-gray-500 py-8">No hay posts para mostrar</p>
      )}
    </div>
  );
};

export default PostList;
