import React from "react";
import { X, Image as ImageIcon } from "lucide-react";
import { UploadedPhoto } from "../types/listing";

interface PhotoThumbnailProps {
  photo: UploadedPhoto;
  index: number;
  onRemove: (id: string) => void;
}

export const PhotoThumbnail: React.FC<PhotoThumbnailProps> = ({ photo, index, onRemove }) => {
  return (
    <div className="relative group shrink-0 w-24 h-24 sm:w-28 sm:h-28 rounded-2xl overflow-hidden bg-[#F4F2EC] border border-[#E8E4DA] shadow-sm transition-all duration-200 ease-out hover:scale-[1.03] hover:shadow-md">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={photo.previewUrl}
        alt={photo.name}
        className="w-full h-full object-cover"
      />

      {/* Cover / Angle Badge */}
      <div className="absolute bottom-1.5 left-1.5 px-2 py-0.5 rounded-md bg-black/60 backdrop-blur-sm text-[10px] font-medium text-white tracking-wide">
        {index === 0 ? "Cover" : `View ${index + 1}`}
      </div>

      {/* Delete Button on Hover */}
      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation();
          onRemove(photo.id);
        }}
        className="absolute top-1.5 right-1.5 w-6 h-6 rounded-full bg-white/90 text-[#18181B] flex items-center justify-center shadow-md opacity-0 group-hover:opacity-100 transition-opacity duration-150 hover:bg-[#E8623D] hover:text-white"
        title="Remove photo"
        aria-label="Remove photo"
      >
        <X className="w-3.5 h-3.5" />
      </button>
    </div>
  );
};
