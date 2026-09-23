import React from "react";
import { Loader2, ArrowRight } from "lucide-react";

interface GenerateButtonProps {
  photoCount: number;
  isLoading: boolean;
  onClick: () => void;
  loadingStep?: string;
}

export const GenerateButton: React.FC<GenerateButtonProps> = ({
  photoCount,
  isLoading,
  onClick,
  loadingStep,
}) => {
  const isDisabled = photoCount === 0 || isLoading;

  return (
    <button
      type="button"
      onClick={onClick}
      disabled={isDisabled}
      id="generate-listing-button"
      className={`relative w-full sm:w-auto px-7 py-3 rounded-lg font-medium text-sm sm:text-base tracking-tight transition-all duration-200 ease-out flex items-center justify-center gap-2 shadow-sm select-none ${
        isDisabled
          ? "bg-[#EAE6DF] text-[#A19D94] cursor-not-allowed shadow-none"
          : "bg-[#E8623D] text-white hover:bg-[#D6532F] active:scale-[0.98] shadow-warm hover:shadow-warmHover"
      }`}
    >
      {isLoading ? (
        <>
          <Loader2 className="w-4 h-4 animate-spin text-white" />
          <span>{loadingStep || "Appraising & Writing Listing..."}</span>
        </>
      ) : (
        <>
          <span>Generate Listing</span>
          {photoCount > 0 && (
            <span className="ml-1 px-1.5 py-0.5 rounded-full bg-white/20 text-xs font-semibold">
              {photoCount}
            </span>
          )}
          <ArrowRight className="w-4 h-4 ml-0.5 opacity-90" />
        </>
      )}
    </button>
  );
};
