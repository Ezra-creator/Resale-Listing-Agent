import React, { useState } from "react";
import { Copy, Check } from "lucide-react";

interface CopyableFieldProps {
  label: string;
  value: string;
  isTextArea?: boolean;
  rows?: number;
  characterCount?: { current: number; max: number };
  badgeText?: string;
  badgeColorClass?: string;
}

export const CopyableField: React.FC<CopyableFieldProps> = ({
  label,
  value,
  isTextArea = false,
  rows = 6,
  characterCount,
  badgeText,
  badgeColorClass = "bg-gray-100 text-gray-700",
}) => {
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch (err) {
      console.error("Failed to copy text: ", err);
    }
  };

  return (
    <div className="space-y-1.5 w-full">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <label className="text-xs font-semibold uppercase tracking-wider text-[#71717A]">
            {label}
          </label>
          {badgeText && (
            <span className={`text-[10px] font-medium px-2 py-0.5 rounded-full ${badgeColorClass}`}>
              {badgeText}
            </span>
          )}
        </div>

        <div className="flex items-center gap-3">
          {characterCount && (
            <span
              className={`text-[11px] font-mono font-medium ${
                characterCount.current > characterCount.max
                  ? "text-red-500 font-bold"
                  : "text-[#A1A1AA]"
              }`}
            >
              {characterCount.current}/{characterCount.max} chars
            </span>
          )}

          <button
            type="button"
            onClick={handleCopy}
            className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-md text-xs font-medium transition-all duration-150 ease-out border shadow-xs ${
              copied
                ? "bg-emerald-50 text-emerald-700 border-emerald-200"
                : "bg-white text-[#52525B] border-[#E4E0D9] hover:text-[#18181B] hover:border-[#D1CBC1] hover:bg-[#FAF9F6]"
            }`}
            title="Copy to clipboard"
          >
            {copied ? (
              <>
                <Check className="w-3.5 h-3.5 text-emerald-600 animate-fade-in-slide" />
                <span className="text-emerald-700 font-semibold">Copied!</span>
              </>
            ) : (
              <>
                <Copy className="w-3.5 h-3.5 text-[#71717A]" />
                <span>Copy</span>
              </>
            )}
          </button>
        </div>
      </div>

      {isTextArea ? (
        <div className="relative">
          <textarea
            readOnly
            rows={rows}
            value={value}
            className="w-full p-3.5 bg-[#FAF9F6] border border-[#E8E4DA] rounded-lg text-sm text-[#18181B] font-sans leading-relaxed focus:outline-none focus:border-[#E8623D] resize-none selection:bg-[#FDF2EF] selection:text-[#E8623D]"
          />
        </div>
      ) : (
        <div className="relative">
          <input
            type="text"
            readOnly
            value={value}
            className="w-full px-3.5 py-2.5 bg-[#FAF9F6] border border-[#E8E4DA] rounded-lg text-sm font-medium text-[#18181B] focus:outline-none focus:border-[#E8623D] selection:bg-[#FDF2EF] selection:text-[#E8623D]"
          />
        </div>
      )}
    </div>
  );
};
