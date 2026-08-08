import React from "react";
import { ShoppingBag, Heart, Store, ArrowUpRight } from "lucide-react";

export const EmptyState: React.FC = () => {
  return (
    <div className="w-full bg-white rounded-2xl border border-[#E8E4DA] p-6 sm:p-8 shadow-warm space-y-5">
      <div className="space-y-1">
        <h4 className="font-heading font-semibold text-base sm:text-lg text-[#18181B] tracking-tight">
          Ready-to-Publish Platform Drafts
        </h4>
        <p className="text-xs sm:text-sm text-[#71717A]">
          Upload 1–4 photos above to generate market comps, condition notes, and tailored listing copy.
        </p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-1">
        {/* eBay Box */}
        <div className="p-3.5 rounded-xl bg-[#F7F9FB] border border-[#DCE6ED] space-y-1.5">
          <div className="flex items-center gap-1.5 text-xs font-semibold text-[#325268]">
            <ShoppingBag className="w-3.5 h-3.5 text-[#4A6B82]" />
            <span>eBay</span>
          </div>
          <p className="text-[11px] text-[#5A778C] leading-relaxed">
            80-char search-optimized titles, structured specs, and Best Offer pricing.
          </p>
        </div>

        {/* Poshmark Box */}
        <div className="p-3.5 rounded-xl bg-[#FAF5F7] border border-[#EEDCE3] space-y-1.5">
          <div className="flex items-center gap-1.5 text-xs font-semibold text-[#732D48]">
            <Heart className="w-3.5 h-3.5 text-[#964867]" />
            <span>Poshmark</span>
          </div>
          <p className="text-[11px] text-[#8C4E65] leading-relaxed">
            Clean 50-char titles, closet bundle discounts, and Offer to Likers room.
          </p>
        </div>

        {/* FB Marketplace Box */}
        <div className="p-3.5 rounded-xl bg-[#F4F8FA] border border-[#D8E6F0] space-y-1.5">
          <div className="flex items-center gap-1.5 text-xs font-semibold text-[#1F4C70]">
            <Store className="w-3.5 h-3.5 text-[#2D6A9F]" />
            <span>Marketplace</span>
          </div>
          <p className="text-[11px] text-[#3D698C] leading-relaxed">
            Local pickup terms, cash/Venmo details, and realistic neighborhood pricing.
          </p>
        </div>
      </div>
    </div>
  );
};
