import React from "react";
import { ShieldAlert } from "lucide-react";

interface FlawsCalloutProps {
  flaws: string[];
}

export const FlawsCallout: React.FC<FlawsCalloutProps> = ({ flaws }) => {
  if (!flaws || flaws.length === 0) return null;

  return (
    <div className="w-full p-4 rounded-xl bg-[#FFFBF7] border border-[#F4DEC6] text-[#7A4B1A] shadow-xs space-y-2">
      <div className="flex items-center gap-2">
        <ShieldAlert className="w-4 h-4 text-[#D97706] shrink-0" />
        <h4 className="text-xs font-semibold uppercase tracking-wider text-[#92400E]">
          Disclose these flaws (Builds Buyer Trust)
        </h4>
      </div>

      <ul className="space-y-1.5 pl-6 list-disc text-xs sm:text-sm text-[#78350F] leading-relaxed">
        {flaws.map((flaw, idx) => (
          <li key={idx} className="marker:text-[#D97706]">
            {flaw}
          </li>
        ))}
      </ul>
    </div>
  );
};
