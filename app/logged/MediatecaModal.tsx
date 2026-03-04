'use client';

import React, { FC, useState, useEffect, useCallback } from 'react';
import { MediaContent, Folder } from './types';
import {
  fetchFolders,
  fetchMedia,
  createFolder as apiCreateFolder,
  renameFolder as apiRenameFolder,
  deleteFolder as apiDeleteFolder,
  createMedia as apiCreateMedia,
  updateMedia as apiUpdateMedia,
  moveMedia as apiMoveMedia,
  deleteMedia as apiDeleteMedia,
  getPresignedUrl,
  uploadFileToS3,
} from '../lib/api';
import FoldersSidebar from './components/FoldersSidebar';
import MediaGrid from './components/MediaGrid';
import SearchBar from './components/SearchBar';
import ConfirmCloseModal from './modals/ConfirmCloseModal';
import CreateFolderModal from './modals/CreateFolderModal';
import AddMediaModal from './modals/AddMediaModal';
import EditMediaModal from './modals/EditMediaModal';
import MoveMediaModal from './modals/MoveMediaModal';
import DeleteConfirmModal from './modals/DeleteConfirmModal';
import EditFolderModal from './modals/EditFolderModal';

interface MediatecaModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSelectMedia?: (media: MediaContent) => void;
}

const MediatecaModal: FC<MediatecaModalProps> = ({ isOpen, onClose, onSelectMedia }) => {
  const [folders, setFolders] = useState<Folder[]>([]);
  const [contents, setContents] = useState<MediaContent[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [selectedFolderId, setSelectedFolderId] = useState<string | null>(null);
  const [mediaIdFilter, setMediaIdFilter] = useState('');
  const [contentNameFilter, setContentNameFilter] = useState('');
  const [publicationDateFilter, setPublicationDateFilter] = useState('');
  const [postIdFilter, setPostIdFilter] = useState('');
  const [showCreateFolder, setShowCreateFolder] = useState(false);
  const [showAddMedia, setShowAddMedia] = useState(false);
  const [showConfirmClose, setShowConfirmClose] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [showDeleteFolderConfirm, setShowDeleteFolderConfirm] = useState(false);
  const [itemToDelete, setItemToDelete] = useState<{ type: 'media' | 'folder'; id: string } | null>(null);
  const [showEditMedia, setShowEditMedia] = useState(false);
  const [showMoveMedia, setShowMoveMedia] = useState(false);
  const [showEditFolder, setShowEditFolder] = useState(false);
  const [editingMedia, setEditingMedia] = useState<MediaContent | null>(null);
  const [editingFolder, setEditingFolder] = useState<Folder | null>(null);
  const [mediaMenuOpen, setMediaMenuOpen] = useState<string | null>(null);
  const [actionLoading, setActionLoading] = useState(false);

  const loadData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [foldersData, mediaData] = await Promise.all([
        fetchFolders(),
        fetchMedia(),
      ]);
      setFolders(foldersData);
      setContents(mediaData);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error loading data');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (isOpen) {
      loadData();
    }
  }, [isOpen, loadData]);

  useEffect(() => {
    if (isOpen) {
      const handleEsc = (e: KeyboardEvent) => {
        if (e.key === 'Escape' && !showConfirmClose) {
          setShowConfirmClose(true);
        }
      };
      window.addEventListener('keydown', handleEsc);
      return () => window.removeEventListener('keydown', handleEsc);
    }
  }, [isOpen, showConfirmClose]);

  const getCurrentFolderMedia = useCallback(() => {
    if (!selectedFolderId) return [];
    const folder = folders.find(f => f.idFolder === selectedFolderId);
    if (!folder) return [];
    return contents.filter(c => folder.MediaArray.includes(c.mediaId));
  }, [selectedFolderId, folders, contents]);

  const getFilteredMedia = useCallback(() => {
    const media = selectedFolderId ? getCurrentFolderMedia() : contents;

    return media.filter(m => {
      const matchesMediaId = !mediaIdFilter || m.mediaId.toLowerCase().includes(mediaIdFilter.toLowerCase());
      const matchesContentName = !contentNameFilter || m.contentName.toLowerCase().includes(contentNameFilter.toLowerCase());
      const matchesPublicationDate = !publicationDateFilter || m.publicationTimestamp.toLowerCase().includes(publicationDateFilter.toLowerCase());
      const matchesPostId = !postIdFilter || (m.postId && m.postId.toLowerCase().includes(postIdFilter.toLowerCase()));

      return matchesMediaId && matchesContentName && matchesPublicationDate && matchesPostId;
    });
  }, [selectedFolderId, getCurrentFolderMedia, contents, mediaIdFilter, contentNameFilter, publicationDateFilter, postIdFilter]);

  const handleCreateFolder = async (folderName: string) => {
    setActionLoading(true);
    try {
      const newFolder = await apiCreateFolder({ folderName });
      setFolders(prev => [...prev, newFolder]);
      setShowCreateFolder(false);
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Error creating folder');
    } finally {
      setActionLoading(false);
    }
  };

  const handleAddMedia = async (name: string, src: string, folderIds: string[], file?: File | null) => {
    setActionLoading(true);
    try {
      for (const folderId of folderIds) {
        let createdMediaId: string;
        if (file) {
          const presign = await getPresignedUrl(file.name, file.type);
          await uploadFileToS3(presign.uploadUrl, file);
          const newMedia = await apiCreateMedia({
            mediaId: presign.mediaId,
            contentName: name,
            type: 'uploaded',
            s3Key: presign.s3Key,
            cdnUrl: presign.cdnUrl,
            folderId,
          });
          createdMediaId = newMedia.mediaId;
          setContents(prev => [...prev, { ...newMedia, contentSrc: presign.cdnUrl }]);
        } else {
          const newMedia = await apiCreateMedia({
            contentName: name,
            type: 'external',
            contentSrc: src,
            folderId,
          });
          createdMediaId = newMedia.mediaId;
          setContents(prev => [...prev, newMedia]);
        }

        setFolders(prev =>
          prev.map(f => {
            if (f.idFolder === folderId) {
              return { ...f, MediaArray: [...f.MediaArray, createdMediaId] };
            }
            return f;
          })
        );
      }

      await loadData();
      setShowAddMedia(false);
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Error adding media');
    } finally {
      setActionLoading(false);
    }
  };

  const handleDeleteMedia = async () => {
    if (!itemToDelete || itemToDelete.type !== 'media') return;
    setActionLoading(true);
    try {
      await apiDeleteMedia(itemToDelete.id);
      setContents(prev => prev.filter(c => c.mediaId !== itemToDelete.id));
      setFolders(prev =>
        prev.map(folder => ({
          ...folder,
          MediaArray: folder.MediaArray.filter(id => id !== itemToDelete.id),
        }))
      );
      setItemToDelete(null);
      setShowDeleteConfirm(false);
      setMediaMenuOpen(null);
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Error deleting media');
    } finally {
      setActionLoading(false);
    }
  };

  const handleDeleteFolder = async () => {
    if (!itemToDelete || itemToDelete.type !== 'folder') return;
    setActionLoading(true);
    try {
      await apiDeleteFolder(itemToDelete.id);
      setFolders(prev => prev.filter(f => f.idFolder !== itemToDelete.id));
      if (selectedFolderId === itemToDelete.id) {
        setSelectedFolderId(null);
      }
      setItemToDelete(null);
      setShowDeleteFolderConfirm(false);
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Error deleting folder');
    } finally {
      setActionLoading(false);
    }
  };

  const handleEditMedia = async (name: string, src: string) => {
    if (!editingMedia) return;
    setActionLoading(true);
    try {
      await apiUpdateMedia(editingMedia.mediaId, { contentName: name, contentSrc: src });
      setContents(prev =>
        prev.map(c =>
          c.mediaId === editingMedia.mediaId
            ? { ...c, contentName: name, contentSrc: src }
            : c
        )
      );
      setEditingMedia(null);
      setShowEditMedia(false);
      setMediaMenuOpen(null);
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Error editing media');
    } finally {
      setActionLoading(false);
    }
  };

  const handleMoveMedia = async (folderId: string) => {
    if (!editingMedia) return;
    setActionLoading(true);
    try {
      await apiMoveMedia(editingMedia.mediaId, folderId);

      setFolders(prev => {
        let updated = prev.map(folder => ({
          ...folder,
          MediaArray: folder.MediaArray.filter(id => id !== editingMedia.mediaId),
        }));
        updated = updated.map(folder =>
          folder.idFolder === folderId
            ? { ...folder, MediaArray: [...folder.MediaArray, editingMedia.mediaId] }
            : folder
        );
        return updated;
      });

      setEditingMedia(null);
      setShowMoveMedia(false);
      setMediaMenuOpen(null);
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Error moving media');
    } finally {
      setActionLoading(false);
    }
  };

  const handleEditFolder = async (folderName: string) => {
    if (!editingFolder) return;
    setActionLoading(true);
    try {
      await apiRenameFolder(editingFolder.idFolder, folderName);
      setFolders(prev =>
        prev.map(f =>
          f.idFolder === editingFolder.idFolder
            ? { ...f, FolderName: folderName }
            : f
        )
      );
      setEditingFolder(null);
      setShowEditFolder(false);
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Error editing folder');
    } finally {
      setActionLoading(false);
    }
  };

  const handleConfirmClose = () => {
    setShowConfirmClose(false);
    onClose();
  };

  const handleSelectMediaItem = (media: MediaContent) => {
    if (onSelectMedia) {
      onSelectMedia(media);
      onClose();
    }
  };

  const handleEditMediaClick = (media: MediaContent) => {
    setEditingMedia(media);
    setShowEditMedia(true);
  };

  const handleMoveMediaClick = (media: MediaContent) => {
    setEditingMedia(media);
    setShowMoveMedia(true);
  };

  const handleDeleteMediaClick = (mediaId: string) => {
    setItemToDelete({ type: 'media', id: mediaId });
    setShowDeleteConfirm(true);
  };

  const handleEditFolderClick = (folder: Folder) => {
    setEditingFolder(folder);
    setShowEditFolder(true);
  };

  const handleDeleteFolderClick = (folderId: string) => {
    setItemToDelete({ type: 'folder', id: folderId });
    setShowDeleteFolderConfirm(true);
  };

  if (!isOpen) return null;

  const filteredMedia = getFilteredMedia();

  return (
    <>
      <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-4">
        <div className="bg-white rounded-lg shadow-xl w-full max-w-6xl max-h-[90vh] flex flex-col">
          {/* Header */}
          <div className="flex justify-between items-center p-4 border-b">
            <h2 className="text-2xl font-bold text-gray-700">Mediateca</h2>
            <button
              onClick={() => setShowConfirmClose(true)}
              className="cursor-pointer text-gray-500 hover:text-gray-700 text-2xl font-bold"
            >
              ×
            </button>
          </div>

          {error && (
            <div className="mx-4 mt-4 p-3 bg-red-100 border border-red-300 rounded-md text-red-700 text-sm flex justify-between items-center">
              <span>{error}</span>
              <button onClick={loadData} className="cursor-pointer text-red-700 underline text-sm">
                Reintentar
              </button>
            </div>
          )}

          {/* Toolbar */}
          <div className="p-4 border-b space-y-3">
            <div className="flex gap-2 flex-wrap">
              <button
                onClick={() => setShowCreateFolder(true)}
                disabled={actionLoading}
                className="cursor-pointer px-4 py-2 bg-blue-500 text-white rounded-md hover:bg-blue-600 disabled:opacity-50"
              >
                Create Folder
              </button>
              <button
                onClick={() => setShowAddMedia(true)}
                disabled={actionLoading}
                className="cursor-pointer px-4 py-2 bg-green-500 text-white rounded-md hover:bg-green-600 disabled:opacity-50"
              >
                Añadir Media
              </button>
            </div>
            <SearchBar
              mediaIdFilter={mediaIdFilter}
              contentNameFilter={contentNameFilter}
              publicationDateFilter={publicationDateFilter}
              postIdFilter={postIdFilter}
              onMediaIdChange={setMediaIdFilter}
              onContentNameChange={setContentNameFilter}
              onPublicationDateChange={setPublicationDateFilter}
              onPostIdChange={setPostIdFilter}
            />
          </div>

          {/* Content */}
          <div className="flex-1 overflow-hidden flex">
            {loading ? (
              <div className="flex-1 flex items-center justify-center">
                <p className="text-gray-500">Cargando...</p>
              </div>
            ) : (
              <>
                <FoldersSidebar
                  folders={folders}
                  selectedFolderId={selectedFolderId}
                  onSelectFolder={setSelectedFolderId}
                  onEditFolder={handleEditFolderClick}
                />
                <MediaGrid
                  media={filteredMedia}
                  folders={folders}
                  selectedFolderId={selectedFolderId}
                  onSelectMedia={handleSelectMediaItem}
                  onEditMedia={handleEditMediaClick}
                  onMoveMedia={handleMoveMediaClick}
                  onDeleteMedia={handleDeleteMediaClick}
                  openMenuId={mediaMenuOpen}
                  onToggleMenu={(id) => setMediaMenuOpen(mediaMenuOpen === id ? null : id)}
                />
              </>
            )}
          </div>
        </div>
      </div>

      {/* Modals */}
      <ConfirmCloseModal
        isOpen={showConfirmClose}
        onConfirm={handleConfirmClose}
        onCancel={() => setShowConfirmClose(false)}
      />

      <CreateFolderModal
        isOpen={showCreateFolder}
        onConfirm={handleCreateFolder}
        onCancel={() => setShowCreateFolder(false)}
      />

      <AddMediaModal
        isOpen={showAddMedia}
        folders={folders}
        onConfirm={handleAddMedia}
        onCancel={() => setShowAddMedia(false)}
      />

      <EditMediaModal
        isOpen={showEditMedia}
        media={editingMedia}
        onConfirm={handleEditMedia}
        onCancel={() => {
          setShowEditMedia(false);
          setEditingMedia(null);
        }}
      />

      <MoveMediaModal
        isOpen={showMoveMedia}
        media={editingMedia}
        folders={folders}
        onConfirm={handleMoveMedia}
        onCancel={() => {
          setShowMoveMedia(false);
          setEditingMedia(null);
        }}
      />

      <DeleteConfirmModal
        isOpen={showDeleteConfirm}
        title="¿Estás seguro de que quieres eliminar este media?"
        onConfirm={handleDeleteMedia}
        onCancel={() => {
          setShowDeleteConfirm(false);
          setItemToDelete(null);
        }}
      />

      <EditFolderModal
        isOpen={showEditFolder}
        folder={editingFolder}
        onConfirm={handleEditFolder}
        onDelete={handleDeleteFolderClick}
        onCancel={() => {
          setShowEditFolder(false);
          setEditingFolder(null);
        }}
      />

      <DeleteConfirmModal
        isOpen={showDeleteFolderConfirm}
        title="¿Estás seguro de que quieres eliminar esta carpeta?"
        message="Esto eliminará todos los media asociados a esta carpeta."
        onConfirm={handleDeleteFolder}
        onCancel={() => {
          setShowDeleteFolderConfirm(false);
          setItemToDelete(null);
        }}
      />
    </>
  );
};

export default MediatecaModal;
