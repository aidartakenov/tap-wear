'use client';

import { useState, useRef } from 'react';
import ReactCrop, { Crop } from 'react-image-crop';
import 'react-image-crop/dist/ReactCrop.css';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Upload, X, Search } from 'lucide-react';
import { useApp } from '@/lib/context';

interface VisualSearchModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSearch: () => void;
}

export function VisualSearchModal({
  isOpen,
  onClose,
  onSearch,
}: VisualSearchModalProps) {
  const { t } = useApp();
  const [imageSrc, setImageSrc] = useState<string>('');
  const [crop, setCrop] = useState<Crop>();
  const [isUploading, setIsUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setIsUploading(true);
      const reader = new FileReader();
      reader.onload = () => {
        setImageSrc(reader.result as string);
        setCrop(undefined);
        setIsUploading(false);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleReset = () => {
    setImageSrc('');
    setCrop(undefined);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const handleSearch = () => {
    if (imageSrc) {
      onSearch();
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-md w-full">
        <DialogHeader>
          <DialogTitle>{t('photo.title')}</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          {!imageSrc ? (
            <div className="border-2 border-dashed border-gray-300 rounded-lg p-8 text-center">
              <input
                ref={fileInputRef}
                type="file"
                accept="image/jpeg,image/png"
                onChange={handleFileSelect}
                className="hidden"
                id="image-upload"
              />
              <label
                htmlFor="image-upload"
                className="cursor-pointer flex flex-col items-center"
              >
                <Upload className="w-12 h-12 text-gray-400 mb-3" />
                <p className="text-sm text-gray-600 mb-2">
                  {t('photo.click')}
                </p>
                <p className="text-xs text-gray-500">
                  {t('photo.formats')}
                </p>
              </label>
            </div>
          ) : (
            <div className="space-y-4">
              <div className="relative">
                <button
                  onClick={handleReset}
                  className="absolute top-2 right-2 p-1 bg-white rounded-full shadow-md hover:bg-gray-100 z-10"
                >
                  <X className="w-4 h-4" />
                </button>
                <ReactCrop
                  crop={crop}
                  onChange={(_, percentCrop) => setCrop(percentCrop)}
                  aspect={undefined}
                  className="max-h-[400px] mx-auto"
                >
                  <img
                    src={imageSrc}
                    alt="Uploaded"
                    className="max-w-full h-auto"
                  />
                </ReactCrop>
              </div>

              <p className="text-sm text-gray-600 text-center">
                {t('photo.crop')}
              </p>

              <Button
                onClick={handleSearch}
                className="w-full"
                disabled={!crop}
              >
                <Search className="w-4 h-4 mr-2" />
                {t('photo.find')}
              </Button>
            </div>
          )}

          {isUploading && (
            <div className="text-center py-4">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto"></div>
              <p className="text-sm text-gray-600 mt-2">{t('photo.loading')}</p>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
