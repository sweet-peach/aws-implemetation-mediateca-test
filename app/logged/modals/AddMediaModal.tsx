'use client';

import React, { FC, useState } from 'react';
import { Folder } from '../types';

interface AddMediaModalProps {
  isOpen: boolean;
  folders: Folder[];
  onConfirm: (name: string, src: string, folderIds: string[], file?: File | null) => void;
  onCancel: () => void;
}

const AddMediaModal: FC<AddMediaModalProps> = ({ isOpen, folders, onConfirm, onCancel }) => {
  const [name, setName] = useState('');
  const [src, setSrc] = useState('');
  const [selectedFolders, setSelectedFolders] = useState<string[]>([]);
  const [useFileUpload, setUseFileUpload] = useState(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [fileError, setFileError] = useState('');
  const [uploading, setUploading] = useState(false);

  if (!isOpen) return null;

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (!file.type.startsWith('image/')) {
        setFileError('El archivo debe ser una imagen');
        setSelectedFile(null);
        return;
      }
      setFileError('');
      setSelectedFile(file);
    }
  };

  const handleConfirm = async () => {
    if (!name.trim() || selectedFolders.length === 0) return;

    if (useFileUpload && !selectedFile) return;
    if (!useFileUpload && !src.trim()) return;

    setUploading(true);
    try {
      if (useFileUpload && selectedFile) {
        onConfirm(name, '', selectedFolders, selectedFile);
      } else {
        onConfirm(name, src, selectedFolders, null);
      }
      resetForm();
    } finally {
      setUploading(false);
    }
  };

  const resetForm = () => {
    setName('');
    setSrc('');
    setSelectedFolders([]);
    setUseFileUpload(false);
    setSelectedFile(null);
    setFileError('');
  };

  const handleCancel = () => {
    resetForm();
    onCancel();
  };

  const toggleFolder = (folderId: string) => {
    if (selectedFolders.includes(folderId)) {
      setSelectedFolders(selectedFolders.filter(id => id !== folderId));
    } else {
      setSelectedFolders([...selectedFolders, folderId]);
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-70 z-[60] flex items-center justify-center text-gray-600">
      <div className="bg-white rounded-lg p-6 max-w-md">
        <h3 className="text-lg font-semibold mb-4">Añadir Media</h3>
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-600 mb-2">
              Nombre
            </label>
            <input
              type="text"
              placeholder="contentName"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-md"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-600 mb-2">
              Imagen
            </label>
            <div className="mb-2">
              <div className="flex items-center gap-3">
                <span
                  className={`text-sm cursor-pointer ${!useFileUpload ? 'text-blue-600 font-medium' : 'text-gray-500'}`}
                  onClick={() => {
                    setUseFileUpload(false);
                    setSelectedFile(null);
                    setFileError('');
                  }}
                >
                  URL
                </span>
                <button
                  type="button"
                  onClick={() => {
                    setUseFileUpload(!useFileUpload);
                    if (useFileUpload) {
                      setSelectedFile(null);
                      setSrc('');
                      setFileError('');
                    }
                  }}
                  className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                    useFileUpload ? 'bg-blue-600' : 'bg-gray-300'
                  }`}
                >
                  <span
                    className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                      useFileUpload ? 'translate-x-6' : 'translate-x-1'
                    }`}
                  />
                </button>
                <span
                  className={`text-sm cursor-pointer ${useFileUpload ? 'text-blue-600 font-medium' : 'text-gray-500'}`}
                  onClick={() => {
                    setUseFileUpload(true);
                  }}
                >
                  Adjuntar imagen
                </span>
              </div>
            </div>
            {useFileUpload ? (
              <div className='cursor-pointer hover:bg-gray-100'>
                <input
                  type="file"
                  accept="image/*"
                  onChange={handleFileChange}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md cursor-pointer"
                />
                {fileError && (
                  <p className="text-red-500 text-sm mt-1">{fileError}</p>
                )}
                {selectedFile && (
                  <p className="text-green-600 text-sm mt-1 cursor-pointer">
                    Imagen seleccionada: {selectedFile.name}
                  </p>
                )}
              </div>
            ) : (
              <input
                type="text"
                placeholder="contentSrc"
                value={src}
                onChange={(e) => setSrc(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-md"
              />
            )}
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              MediaFolder (selecciona al menos uno)
            </label>
            <div className="space-y-2 max-h-40 overflow-y-auto border p-2 rounded-md">
              {folders.map((folder) => (
                <label key={folder.idFolder} className="flex items-center">
                  <input
                    type="checkbox"
                    checked={selectedFolders.includes(folder.idFolder)}
                    onChange={() => toggleFolder(folder.idFolder)}
                    className="mr-2"
                  />
                  <span className="text-sm">{folder.FolderName}</span>
                </label>
              ))}
            </div>
          </div>
        </div>

        {uploading && (
          <div className="mt-3">
            <div className="w-full bg-gray-200 rounded-full h-2">
              <div className="bg-blue-600 h-2 rounded-full animate-pulse w-full" />
            </div>
            <p className="text-sm text-gray-500 mt-1">Subiendo...</p>
          </div>
        )}

        <div className="flex gap-3 justify-end mt-4">
          <button
            onClick={handleCancel}
            disabled={uploading}
            className="cursor-pointer px-4 py-2 bg-gray-500 text-white rounded-md hover:bg-gray-600 disabled:opacity-50"
          >
            Cancelar
          </button>
          <button
            onClick={handleConfirm}
            disabled={selectedFolders.length === 0 || uploading}
            className="cursor-pointer px-4 py-2 bg-green-500 text-white rounded-md hover:bg-green-600 disabled:bg-gray-300 disabled:cursor-not-allowed"
          >
            Añadir
          </button>
        </div>
      </div>
    </div>
  );
};

export default AddMediaModal;
