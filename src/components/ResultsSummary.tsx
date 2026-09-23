import React from "react";
import { Tag, TrendingUp, Sparkles, CheckCircle2, Info } from "lucide-react";
import { ResaleReport, ConditionGrade } from "../types/listing";

interface ResultsSummaryProps {
  report: ResaleReport;
}

function getConditionBadgeStyle(grade: ConditionGrade): { bg: string; text: string; border: string } {
  switch (grade) {
    case "New with tags":
      return { bg: "bg-emerald-50", text: "text-emerald-800", border: "border-emerald-200" };
    case "Like new":
      return { bg: "bg-green-50", text: "text-green-800", border: "border-green-200" };
    case "Good":
      return { bg: "bg-teal-50", text: "text-teal-800", border: "border-teal-200" };
    case "Fair":
      return { bg: "bg-amber-50", text: "text-amber-800", border: "border-amber-200" };
    case "Worn":
      return { bg: "bg-orange-50", text: "text-orange-800", border: "border-orange-200" };
    default:
      return { bg: "bg-gray-50", text: "text-gray-800", border: "border-gray-200" };
  }
}

function renderConditionIcon(grade: ConditionGrade) {
  switch (grade) {
    case "New with tags":
      return <Sparkles className="w-3 h-3 mr-1 shrink-0 text-emerald-600" />;
    case "Like new":
    case "Good":
      return <CheckCircle2 className="w-3 h-3 mr-1 shrink-0 text-emerald-600" />;
    default:
      return <Info className="w-3 h-3 mr-1 shrink-0 text-amber-600" />;
  }
}

export const ResultsSummary: React.FC<ResultsSummaryProps> = ({ report }) => {
  const badgeStyle = getConditionBadgeStyle(report.condition_grade);

  return (
    <div className="w-full bg-white rounded-2xl border border-[#E8E4DA] p-5 sm:p-6 shadow-warm space-y-4">
      {/* Top Bar: Brand, Item Type & Suggested Price */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3.5 border-b border-[#F0EBE1]">
        <div className="space-y-1">
          <div className="flex items-center gap-2 flex-wrap">
            {report.brand && (
              <span className="px-2.5 py-0.5 rounded-md bg-[#F4F2EC] text-xs font-semibold text-[#3F3F46] tracking-wide uppercase">
                {report.brand}
              </span>
            )}
            <span
              className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold border ${badgeStyle.bg} ${badgeStyle.text} ${badgeStyle.border}`}
            >
              {renderConditionIcon(report.condition_grade)}
              <span>{report.condition_grade} Condition</span>
            </span>
          </div>

          <h2 className="font-heading font-bold text-xl sm:text-2xl text-[#18181B] tracking-tight leading-snug">
            {report.item_type}
          </h2>
        </div>

        {/* Suggested Price Callout */}
        <div className="sm:text-right shrink-0 bg-[#FDF2EF] sm:bg-transparent p-3 sm:p-0 rounded-xl sm:rounded-none border border-[#F5C7B8] sm:border-none">
          <div className="text-[11px] font-semibold uppercase tracking-wider text-[#A1A1AA] flex items-center sm:justify-end gap-1">
            <TrendingUp className="w-3 h-3 text-[#E8623D]" />
            <span>Suggested Target</span>
          </div>
          <div className="font-heading font-bold text-2xl sm:text-3xl text-[#E8623D]">
            ${report.price_range?.suggested || 0}
          </div>
          <div className="text-xs text-[#71717A] font-medium">
            Range: ${report.price_range?.low} – ${report.price_range?.high}
          </div>
        </div>
      </div>

      {/* Category & Search Tags */}
      <div className="space-y-2.5">
        <div className="flex items-center gap-2 text-xs text-[#71717A] flex-wrap">
          <span className="font-semibold text-[#3F3F46]">Category:</span>
          <span className="px-2.5 py-1 rounded-md bg-[#FAF9F6] border border-[#E8E4DA] text-[#52525B]">
            {report.category}
          </span>
        </div>

        {report.tags && report.tags.length > 0 && (
          <div className="flex items-center gap-1.5 flex-wrap pt-1">
            <Tag className="w-3.5 h-3.5 text-[#A1A1AA] shrink-0" />
            {report.tags.map((tag, idx) => (
              <span
                key={idx}
                className="px-2 py-0.5 rounded-full text-[11px] font-medium bg-[#F5F2EB] text-[#52525B] border border-[#E8E4DA]"
              >
                {tag}
              </span>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};
