import React from "react";
import { MessageSquareText, Plus } from "lucide-react";

interface NotesInputProps {
  notes: string;
  onChange: (notes: string) => void;
  disabled?: boolean;
}

const QUICK_CHIPS = [
  { label: "Pit-to-Pit: ", insert: "Pit-to-Pit: 21 inches" },
  { label: "Length: ", insert: "Length: 28 inches" },
  { label: "Smoke-Free Home", insert: "From clean smoke-free home" },
  { label: "NWT", insert: "NWT - Brand new with tags" },
  { label: "Vintage Fit", insert: "True vintage boxy fit" },
];

export const NotesInput: React.FC<NotesInputProps> = ({ notes, onChange, disabled }) => {
  const handleAddChip = (text: string) => {
    if (disabled) return;
    const current = notes.trim();
    if (!current) {
      onChange(text);
    } else if (!current.includes(text)) {
      onChange(`${current}, ${text}`);
    }
  };

  return (
    <div className="w-full space-y-2">
      <div className="relative flex items-center">
        <div className="absolute left-3.5 text-[#A1A1AA] pointer-events-none">
          <MessageSquareText className="w-4 h-4" />
        </div>
        <input
          type="text"
          value={notes}
          onChange={(e) => onChange(e.target.value)}
          disabled={disabled}
          placeholder="Add seller notes (flat measurements, provenance, flaws, fit...)"
          className="w-full pl-10 pr-4 py-2.5 bg-white border border-[#E6DFD5] rounded-lg text-sm text-[#18181B] placeholder-[#A1A1AA] shadow-sm transition-all duration-200 focus:outline-none focus:border-[#E8623D] focus:ring-2 focus:ring-[#E8623D]/20 disabled:bg-gray-50 disabled:text-gray-400"
          id="seller-notes-input"
        />
      </div>

      {/* Quick Reseller Spec Chips */}
      <div className="flex items-center gap-1.5 flex-wrap text-xs">
        <span className="text-[11px] text-[#A1A1AA] font-medium mr-0.5">Quick specs:</span>
        {QUICK_CHIPS.map((chip, idx) => (
          <button
            key={idx}
            type="button"
            disabled={disabled}
            onClick={() => handleAddChip(chip.insert)}
            className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-[#FAF9F6] border border-[#E8E4DA] text-[11px] font-medium text-[#71717A] hover:text-[#18181B] hover:border-[#D1CBC1] hover:bg-white transition-colors disabled:opacity-50"
          >
            <Plus className="w-2.5 h-2.5" />
            <span>{chip.label}</span>
          </button>
        ))}
      </div>
    </div>
  );
};
