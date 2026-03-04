'use client';

import React, { FC } from 'react';
import { MediaContent } from '../types';

interface MediaCardProps {
  media: MediaContent;
  onSelect: (media: MediaContent) => void;
  onEdit: (media: MediaContent) => void;
  onMove: (media: MediaContent) => void;
  onDelete: (mediaId: string) => void;
  isMenuOpen: boolean;
  onToggleMenu: () => void;
}

function resolveDisplayUrl(media: MediaContent): string {
  return media.cdnUrl || media.contentSrc || '';
}

const MediaCard: FC<MediaCardProps> = ({
  media,
  onSelect,
  onEdit,
  onMove,
  onDelete,
  isMenuOpen,
  onToggleMenu,
}) => {
  const displayUrl = resolveDisplayUrl(media);

  return (
    <div className="border rounded-lg overflow-hidden hover:shadow-lg transition-shadow relative group">
      <div
        className="aspect-video bg-gray-200 cursor-pointer"
        onClick={() => onSelect(media)}
      >
        <img
          src={displayUrl}
          alt={media.contentName}
          className="w-full h-full object-cover"
          onError={(e) => {
            (e.target as HTMLImageElement).src = 'https://via.placeholder.com/400x300?text=Image+Error';
          }}
        />
      </div>
      <div className="p-2">
        <p className="text-sm font-medium text-gray-700 truncate">{media.contentName}</p>
        <p className="text-xs text-gray-500">{media.mediaId}</p>
        {media.type && (
          <span className={`text-xs px-1.5 py-0.5 rounded-full ${
            media.type === 'uploaded' ? 'bg-green-100 text-green-700' : 'bg-blue-100 text-blue-700'
          }`}>
            {media.type === 'uploaded' ? 'Subida' : 'Externa'}
          </span>
        )}
      </div>
      <div className="absolute top-2 right-2">
        <button
          onClick={(e) => {
            e.stopPropagation();
            onToggleMenu();
          }}
          className="cursor-pointer bg-white rounded-full w-8 h-8 flex items-center justify-center shadow-md hover:bg-gray-100"
        >
          <span className="text-gray-600 px-3">⋮</span>
        </button>
        {isMenuOpen && (
          <div className="absolute right-0 mt-1 bg-white border rounded-md shadow-lg z-10 min-w-[120px]">
            <button
              onClick={(e) => {
                e.stopPropagation();
                onEdit(media);
                onToggleMenu();
              }}
              className="cursor-pointer block w-full text-left px-4 py-2 hover:bg-gray-100 text-sm text-gray-600"
            >
              Edit
            </button>
            <button
              onClick={(e) => {
                e.stopPropagation();
                onMove(media);
                onToggleMenu();
              }}
              className="cursor-pointer block w-full text-left px-4 py-2 hover:bg-gray-100 text-sm text-gray-600"
            >
              Move
            </button>
            <button
              onClick={(e) => {
                e.stopPropagation();
                onDelete(media.mediaId);
                onToggleMenu();
              }}
              className="cursor-pointer block w-full text-left px-4 py-2 hover:bg-gray-100 text-sm text-red-600"
            >
              Delete
            </button>
          </div>
        )}
      </div>
    </div>
  );
};

export default MediaCard;
