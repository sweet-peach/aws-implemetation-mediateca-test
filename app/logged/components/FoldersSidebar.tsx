'use client';

import React, { FC, useMemo } from 'react';
import { Folder } from '../types';

interface FoldersSidebarProps {
  folders: Folder[];
  selectedFolderId: string | null;
  onSelectFolder: (folderId: string) => void;
  onEditFolder: (folder: Folder) => void;
}

interface FolderNode extends Folder {
  children: FolderNode[];
}

function buildTree(folders: Folder[]): FolderNode[] {
  const map = new Map<string, FolderNode>();
  const roots: FolderNode[] = [];

  for (const folder of folders) {
    map.set(folder.idFolder, { ...folder, children: [] });
  }

  for (const folder of folders) {
    const node = map.get(folder.idFolder)!;
    if (folder.parentId && map.has(folder.parentId)) {
      map.get(folder.parentId)!.children.push(node);
    } else {
      roots.push(node);
    }
  }

  return roots;
}

const FolderItem: FC<{
  node: FolderNode;
  depth: number;
  selectedFolderId: string | null;
  onSelectFolder: (folderId: string) => void;
  onEditFolder: (folder: Folder) => void;
}> = ({ node, depth, selectedFolderId, onSelectFolder, onEditFolder }) => {
  return (
    <>
      <div
        className={`p-3 rounded-md cursor-pointer border ${
          selectedFolderId === node.idFolder
            ? 'bg-blue-100 border-blue-500'
            : 'bg-gray-50 border-gray-200 hover:bg-gray-100'
        }`}
        style={{ marginLeft: depth * 16 }}
      >
        <div className="flex justify-between items-center">
          <div
            onClick={() => onSelectFolder(node.idFolder)}
            className="flex-1"
          >
            <p className="font-medium text-gray-700">
              {depth > 0 && <span className="text-gray-400 mr-1">└</span>}
              {node.FolderName}
            </p>
            <p className="text-sm text-gray-500">{node.MediaArray.length} items</p>
          </div>
          <div className="relative">
            <button
              onClick={(e) => {
                e.stopPropagation();
                onEditFolder(node);
              }}
              className="cursor-pointer text-gray-500 hover:text-gray-700"
            >
              ⋮
            </button>
          </div>
        </div>
      </div>
      {node.children.map((child) => (
        <FolderItem
          key={child.idFolder}
          node={child}
          depth={depth + 1}
          selectedFolderId={selectedFolderId}
          onSelectFolder={onSelectFolder}
          onEditFolder={onEditFolder}
        />
      ))}
    </>
  );
};

const FoldersSidebar: FC<FoldersSidebarProps> = ({
  folders,
  selectedFolderId,
  onSelectFolder,
  onEditFolder,
}) => {
  const tree = useMemo(() => buildTree(folders), [folders]);

  return (
    <div className="w-64 border-r overflow-y-auto p-4">
      <h3 className="font-semibold text-gray-700 mb-3">Carpetas</h3>
      <div className="space-y-2">
        {tree.map((node) => (
          <FolderItem
            key={node.idFolder}
            node={node}
            depth={0}
            selectedFolderId={selectedFolderId}
            onSelectFolder={onSelectFolder}
            onEditFolder={onEditFolder}
          />
        ))}
      </div>
    </div>
  );
};

export default FoldersSidebar;
