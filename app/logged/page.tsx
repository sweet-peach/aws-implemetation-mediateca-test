'use client';

import React, { FC, useState } from 'react';
import TopNav from './TopNav';
import MediatecaModal from './MediatecaModal';
import { MediaContent } from './types';
import { createPost, ensureAbsoluteMediaUrl } from '../lib/api';

const LoggedPage: FC = () => {
  const [title, setTitle] = useState('');
  const [subtitle, setSubtitle] = useState('');
  const [useSrc, setUseSrc] = useState(true);
  const [imageSrc, setImageSrc] = useState('');
  const [selectedMediaId, setSelectedMediaId] = useState<string | null>(null);
  const [showMediatecaModal, setShowMediatecaModal] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const clearForm = () => {
    setTitle('');
    setSubtitle('');
    setImageSrc('');
    setSelectedMediaId(null);
  };

  const handleClearAll = () => {
    clearForm();
    setSuccessMsg(null);
    setErrorMsg(null);
  };

  const handleConfirm = async () => {
    if (!title.trim()) {
      setErrorMsg('El título es obligatorio');
      return;
    }

    setSubmitting(true);
    setErrorMsg(null);
    setSuccessMsg(null);

    try {
      const mediaIds = selectedMediaId ? [selectedMediaId] : [];
      await createPost({ title, subtitle, mediaIds });
      clearForm();
      setSuccessMsg('Post creado correctamente');
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : 'Error creando el post');
    } finally {
      setSubmitting(false);
    }
  };

  const handleSelectMedia = (media: MediaContent) => {
    setImageSrc(ensureAbsoluteMediaUrl(media.cdnUrl || media.contentSrc || ''));
    setSelectedMediaId(media.mediaId);
    setUseSrc(true);
  };

  return (
    <div className="min-h-screen bg-gray-100">
      <TopNav />
      <div className="max-w-2xl mx-auto p-6">
        <p className="text-2xl font-bold text-gray-600 mb-4 text-center py-12">Creación de post</p>

        {successMsg && (
          <div className="mb-4 p-3 bg-green-100 border border-green-300 rounded-md text-green-700 text-sm">
            {successMsg}
          </div>
        )}
        {errorMsg && (
          <div className="mb-4 p-3 bg-red-100 border border-red-300 rounded-md text-red-700 text-sm">
            {errorMsg}
          </div>
        )}

        <form className="bg-white rounded-lg shadow-md p-6 space-y-6">
          <div>
            <label htmlFor="title" className="block text-sm font-medium text-gray-700 mb-2">
              Título
            </label>
            <input
              type="text"
              id="title"
              value={title || ''}
              onChange={(e) => setTitle(e.target.value)}
              className="text-gray-600 w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="Ingresa el título"
            />
          </div>

          <div>
            <label htmlFor="subtitle" className="block text-sm font-medium text-gray-700 mb-2">
              Subtítulo
            </label>
            <input
              type="text"
              id="subtitle"
              value={subtitle || ''}
              onChange={(e) => setSubtitle(e.target.value)}
              className="text-gray-600 w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="Ingresa el subtítulo"
            />
          </div>

          <div>
            <div className='flex flex-row justify-between'>
              <p className="text-sm font-medium text-gray-700 mb-2">Imagen</p>
              <label className="flex items-center space-x-3 mb-4">
                <span className="text-sm font-medium text-gray-700">
                  {useSrc ? 'Introducir URL' : 'Cargar desde mediateca'}
                </span>
                <button
                  type="button"
                  onClick={() => setUseSrc(!useSrc)}
                  className="relative inline-flex h-6 w-11 items-center rounded-full bg-gray-300 transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2"
                >
                  <span
                    className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                      useSrc ? 'translate-x-6' : 'translate-x-1'
                    }`}
                  />
                </button>
              </label>
            </div>

            {useSrc ? (
              <input
                key="image-src-input"
                type="text"
                value={imageSrc || ''}
                onChange={(e) => setImageSrc(e.target.value)}
                className="text-gray-600 w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="Ingresa la URL de la imagen"
              />
            ) : (
              <button
                type="button"
                onClick={() => setShowMediatecaModal(true)}
                className="cursor-pointer w-full px-4 py-2 bg-blue-500 text-white rounded-md hover:bg-blue-600 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 transition-colors"
              >
                Abrir mediateca
              </button>
            )}
          </div>

          <div className="flex space-x-4">
            <button
              type="button"
              onClick={handleClearAll}
              disabled={submitting}
              className="flex-1 px-4 py-2 bg-gray-500 text-white rounded-md hover:bg-gray-600 focus:outline-none focus:ring-2 focus:ring-gray-500 focus:ring-offset-2 transition-colors disabled:opacity-50"
            >
              Borrar todo
            </button>
            <button
              type="button"
              onClick={handleConfirm}
              disabled={submitting}
              className="flex-1 px-4 py-2 bg-blue-500 text-white rounded-md hover:bg-blue-600 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 transition-colors disabled:opacity-50"
            >
              {submitting ? 'Creando...' : 'Confirmar'}
            </button>
          </div>
        </form>
      </div>
      <MediatecaModal
        isOpen={showMediatecaModal}
        onClose={() => setShowMediatecaModal(false)}
        onSelectMedia={handleSelectMedia}
      />
    </div>
  );
};

export default LoggedPage;
