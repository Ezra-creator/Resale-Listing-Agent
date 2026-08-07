import React, { useRef, useState } from "react";
import { UploadCloud, Plus, AlertCircle, Camera } from "lucide-react";
import { UploadedPhoto } from "../types/listing";
import { PhotoThumbnail } from "./PhotoThumbnail";

interface PhotoUploadZoneProps {
  photos: UploadedPhoto[];
  onAddPhotos: (newPhotos: UploadedPhoto[]) => void;
  onRemovePhoto: (id: string) => void;
  error?: string | null;
  onErrorChange: (err: string | null) => void;
}

const MAX_PHOTOS = 4;
const MAX_SIZE_BYTES = 10 * 1024 * 1024; // 10MB
const ALLOWED_TYPES = ["image/jpeg", "image/png", "image/webp"];

export const PhotoUploadZone: React.FC<PhotoUploadZoneProps> = ({
  photos,
  onAddPhotos,
  onRemovePhoto,
  error,
  onErrorChange,
}) => {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isDragOver, setIsDragOver] = useState(false);

  const processFiles = (fileList: FileList | File[]) => {
    onErrorChange(null);
    const files = Array.from(fileList);

    if (photos.length + files.length > MAX_PHOTOS) {
      onErrorChange(`Maximum of ${MAX_PHOTOS} photos allowed. Please select fewer images.`);
      return;
    }

    const validNewPhotos: UploadedPhoto[] = [];

    for (const file of files) {
      if (!ALLOWED_TYPES.includes(file.type)) {
        onErrorChange(`"${file.name}" has an unsupported format. Please upload JPG, PNG, or WebP.`);
        return;
      }
      if (file.size > MAX_SIZE_BYTES) {
        const sizeMB = (file.size / (1024 * 1024)).toFixed(1);
        onErrorChange(`"${file.name}" is ${sizeMB}MB. Maximum allowed size is 10MB.`);
        return;
      }

      validNewPhotos.push({
        id: `photo_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
        file,
        previewUrl: URL.createObjectURL(file),
        name: file.name,
        size: file.size,
      });
    }

    if (validNewPhotos.length > 0) {
      onAddPhotos(validNewPhotos);
    }
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragOver(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragOver(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragOver(false);
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      processFiles(e.dataTransfer.files);
    }
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      processFiles(e.target.files);
      // Reset input value so same files can be re-added if removed
      e.target.value = "";
    }
  };

  const openPicker = () => {
    fileInputRef.current?.click();
  };

  return (
    <div className="w-full space-y-3">
      {/* Hidden file input */}
      <input
        ref={fileInputRef}
        type="file"
        multiple
        accept="image/jpeg,image/png,image/webp"
        onChange={handleInputChange}
        className="hidden"
        id="photo-file-upload"
      />

      {/* Main Drag-and-Drop Card / Area */}
      <div
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        onClick={openPicker}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") {
            e.preventDefault();
            openPicker();
          }
        }}
        tabIndex={0}
        role="button"
        aria-label="Upload item photos"
        className={`relative w-full rounded-2xl border-2 border-dashed p-6 sm:p-8 cursor-pointer transition-all duration-200 ease-out flex flex-col items-center justify-center text-center bg-white shadow-warm ${
          isDragOver
            ? "border-[#E8623D] bg-[#FDF2EF] shadow-warmHover scale-[1.005]"
            : "border-[#E6DFD5] hover:border-[#E8623D] hover:bg-[#FAF7F2] hover:shadow-warmHover"
        }`}
      >
        <div className="w-12 h-12 rounded-full bg-[#FDF2EF] border border-[#F5C7B8] flex items-center justify-center text-[#E8623D] mb-3 transition-transform duration-200 group-hover:scale-105">
          <Camera className="w-6 h-6" />
        </div>

        <h3 className="font-heading font-semibold text-base sm:text-lg text-[#18181B] tracking-tight">
          {photos.length === 0 ? "Drop up to 4 item photos or click to browse" : "Add more angles or views"}
        </h3>
        <p className="text-xs sm:text-sm text-[#71717A] mt-1">
          Supports JPG, PNG, WebP up to 10MB each (front, back, tags, details)
        </p>

        {/* Counter Badge */}
        <div className="mt-3.5 inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium bg-[#F5F2EB] text-[#52525B]">
          <span>{photos.length} of {MAX_PHOTOS} photos added</span>
        </div>
      </div>

      {/* Error Message if any */}
      {error && (
        <div className="flex items-center gap-2 p-3 rounded-lg bg-red-50 border border-red-200 text-red-700 text-xs sm:text-sm animate-fade-in-slide">
          <AlertCircle className="w-4 h-4 shrink-0 text-red-500" />
          <span>{error}</span>
        </div>
      )}

      {/* Horizontal Thumbnail Gallery Row */}
      {photos.length > 0 && (
        <div className="space-y-1.5">
          <div className="flex items-center justify-between text-xs text-[#71717A] px-1 font-medium">
            <span>Uploaded Angles & Views</span>
            <span>Hover to remove</span>
          </div>

          <div className="flex items-center gap-3 overflow-x-auto pb-2 pt-1 scrollbar-thin">
            {photos.map((photo, index) => (
              <PhotoThumbnail
                key={photo.id}
                photo={photo}
                index={index}
                onRemove={onRemovePhoto}
              />
            ))}

            {photos.length < MAX_PHOTOS && (
              <button
                type="button"
                onClick={openPicker}
                className="shrink-0 w-24 h-24 sm:w-28 sm:h-28 rounded-2xl border-2 border-dashed border-[#DCD5C9] bg-[#FAF9F6] text-[#71717A] hover:border-[#E8623D] hover:text-[#E8623D] hover:bg-[#FDF2EF] transition-all duration-200 flex flex-col items-center justify-center gap-1 text-xs font-medium"
                title="Add another photo"
              >
                <Plus className="w-5 h-5" />
                <span>Add angle</span>
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
