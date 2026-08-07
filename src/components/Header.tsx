import React from "react";

export const Header: React.FC = () => {
  return (
    <header className="w-full border-b border-[#EFECE6] bg-[#FFFFFF]/80 backdrop-blur-sm sticky top-0 z-30">
      <div className="max-w-3xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-lg bg-[#E8623D] flex items-center justify-center shadow-sm text-white font-heading font-bold text-lg tracking-tight">
            R
          </div>
          <div className="flex items-baseline gap-2">
            <span className="font-heading font-bold text-xl tracking-tight text-[#18181B]">
              Relist
            </span>
            <span className="text-[11px] font-medium tracking-wide uppercase px-2 py-0.5 rounded-full bg-[#FDF2EF] text-[#E8623D] border border-[#F5C7B8]">
              Studio
            </span>
          </div>
        </div>
      </div>
    </header>
  );
};
