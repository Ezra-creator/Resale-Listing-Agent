import React from "react";

export const Header: React.FC = () => {
  return (
    <header className="w-full border-b border-[#EBE7DF] bg-[#FFFFFF] sticky top-0 z-30">
      <div className="max-w-3xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-lg bg-[#E8623D] flex items-center justify-center shadow-xs text-white font-heading font-bold text-lg tracking-tight select-none">
            R
          </div>
          <div className="flex items-center gap-2">
            <span className="font-heading font-bold text-xl tracking-tight text-[#18181B]">
              Relist
            </span>
            <span className="text-[11px] font-medium tracking-wide px-2 py-0.5 rounded-md bg-[#FAF7F2] text-[#71717A] border border-[#E8E4DA]">
              Seller Studio
            </span>
          </div>
        </div>

        <div className="text-xs text-[#71717A] font-medium hidden sm:block">
          eBay • Poshmark • Marketplace
        </div>
      </div>
    </header>
  );
};
