import React from "react";
import { MessageSquareText } from "lucide-react";

interface NotesInputProps {
  notes: string;
  onChange: (notes: string) => void;
  disabled?: boolean;
}

export const NotesInput: React.FC<NotesInputProps> = ({ notes, onChange, disabled }) => {
  return (
    <div className="w-full">
      <div className="relative flex items-center">
        <div className="absolute left-3.5 text-[#A1A1AA] pointer-events-none">
          <MessageSquareText className="w-4 h-4" />
        </div>
        <input
          type="text"
          value={notes}
          onChange={(e) => onChange(e.target.value)}
          disabled={disabled}
          placeholder="Add optional notes (size, flaws, purchase story, provenance...)"
          className="w-full pl-10 pr-4 py-2.5 bg-white border border-[#E6DFD5] rounded-lg text-sm text-[#18181B] placeholder-[#A1A1AA] shadow-sm transition-all duration-200 focus:outline-none focus:border-[#E8623D] focus:ring-2 focus:ring-[#E8623D]/20 disabled:bg-gray-50 disabled:text-gray-400"
          id="seller-notes-input"
        />
      </div>
    </div>
  );
};
