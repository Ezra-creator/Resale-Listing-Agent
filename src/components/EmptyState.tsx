import React from "react";
import { Sparkles, Image as ImageIcon } from "lucide-react";

export const EmptyState: React.FC = () => {
  return (
    <div className="w-full bg-white rounded-2xl border border-dashed border-[#E0D9CD] p-8 sm:p-12 text-center flex flex-col items-center justify-center space-y-3 shadow-warmCard">
      <div className="w-12 h-12 rounded-full bg-[#FAF9F6] border border-[#EAE6DF] flex items-center justify-center text-[#A1A1AA]">
        <ImageIcon className="w-5 h-5 text-[#8E8A82]" />
      </div>

      <div className="space-y-1">
        <h4 className="font-heading font-medium text-base text-[#27272A] tracking-tight">
          Your listing will appear here
        </h4>
        <p className="text-xs sm:text-sm text-[#71717A] max-w-sm">
          Upload 1–4 photos of your item above to generate condition grades, price comps, and platform-specific copies.
        </p>
      </div>

      <div className="pt-2 flex items-center gap-3 text-[11px] text-[#A1A1AA] font-medium">
        <span className="flex items-center gap-1">
          <span className="w-1.5 h-1.5 rounded-full bg-[#4A6B82]" /> eBay
        </span>
        <span className="flex items-center gap-1">
          <span className="w-1.5 h-1.5 rounded-full bg-[#964867]" /> Poshmark
        </span>
        <span className="flex items-center gap-1">
          <span className="w-1.5 h-1.5 rounded-full bg-[#2D6A9F]" /> FB Marketplace
        </span>
      </div>
    </div>
  );
};
