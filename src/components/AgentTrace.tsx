import React from "react";
import { Check, Search } from "lucide-react";
import { AgentStep } from "../types/listing";

interface AgentTraceProps {
  steps: AgentStep[];
}

export const AgentTrace: React.FC<AgentTraceProps> = ({ steps }) => {
  const completedCount = steps.filter((s) => s.status === "done").length;
  const progressPercent = Math.round((completedCount / steps.length) * 100);

  return (
    <div className="w-full bg-white rounded-2xl border border-[#E8E4DA] p-5 sm:p-6 shadow-warm space-y-5 animate-fade-in-slide">
      {/* Header with Title & Progress */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-3.5 border-b border-[#F0EBE1]">
        <div className="flex items-center gap-2.5">
          <div className="w-7 h-7 rounded-lg bg-[#FDF2EF] border border-[#F5C7B8] flex items-center justify-center text-[#E8623D]">
            <Search className="w-3.5 h-3.5" />
          </div>
          <div>
            <h3 className="font-heading font-bold text-base sm:text-lg text-[#18181B] tracking-tight">
              Appraising Your Item...
            </h3>
            <p className="text-xs text-[#71717A]">
              Checking visual condition, recent sales comps, and drafting platform listings
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2.5">
          <div className="w-24 h-1.5 rounded-full bg-[#F4F2EC] overflow-hidden border border-[#EAE6DF]">
            <div
              className="h-full bg-[#E8623D] transition-all duration-300 ease-out"
              style={{ width: `${progressPercent}%` }}
            />
          </div>
        </div>
      </div>

      {/* Step Sequence */}
      <div className="space-y-3">
        {steps.map((step) => {
          const isPending = step.status === "pending";
          const isActive = step.status === "active";
          const isDone = step.status === "done";

          return (
            <div
              key={step.id}
              className={`flex items-start gap-3 p-2.5 rounded-xl transition-all duration-200 ${
                isActive
                  ? "bg-[#FAF7F2] border border-[#EADFCF]"
                  : isDone
                  ? "opacity-90"
                  : "opacity-40"
              }`}
            >
              {/* Status Indicator */}
              <div className="shrink-0 mt-0.5">
                {isDone && (
                  <div className="w-4 h-4 rounded-full bg-emerald-600 text-white flex items-center justify-center">
                    <Check className="w-2.5 h-2.5 stroke-[3]" />
                  </div>
                )}

                {isActive && (
                  <div className="w-4 h-4 rounded-full bg-[#E8623D] flex items-center justify-center text-white">
                    <span className="w-1.5 h-1.5 rounded-full bg-white animate-ping" />
                  </div>
                )}

                {isPending && (
                  <div className="w-4 h-4 rounded-full border border-[#D4D0C7] bg-[#F4F2EC] flex items-center justify-center">
                    <span className="w-1 h-1 rounded-full bg-[#A1A1AA]" />
                  </div>
                )}
              </div>

              {/* Step Info */}
              <div className="flex-1 min-w-0">
                <p
                  className={`text-xs sm:text-sm font-medium tracking-tight ${
                    isActive
                      ? "text-[#18181B] font-semibold"
                      : isDone
                      ? "text-[#27272A]"
                      : "text-[#71717A]"
                  }`}
                >
                  {step.label}
                </p>

                {step.subtext && (
                  <p className="text-[11px] text-[#71717A] mt-0.5">
                    {step.subtext}
                  </p>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};
