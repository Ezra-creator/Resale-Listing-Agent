import React from "react";
import { Check, Loader2, Sparkles, Circle } from "lucide-react";
import { AgentStep } from "../types/listing";

interface AgentTraceProps {
  steps: AgentStep[];
}

export const AgentTrace: React.FC<AgentTraceProps> = ({ steps }) => {
  const activeStep = steps.find((s) => s.status === "active");
  const completedCount = steps.filter((s) => s.status === "done").length;
  const progressPercent = Math.round((completedCount / steps.length) * 100);

  return (
    <div className="w-full bg-white rounded-2xl border border-[#E8E4DA] p-6 sm:p-7 shadow-warm space-y-6 animate-fade-in-slide">
      {/* Header with Title & Progress */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-4 border-b border-[#F0EBE1]">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-lg bg-[#FDF2EF] border border-[#F5C7B8] flex items-center justify-center text-[#E8623D]">
            <Sparkles className="w-4 h-4 animate-pulse" />
          </div>
          <div>
            <h3 className="font-heading font-bold text-base sm:text-lg text-[#18181B] tracking-tight">
              Agent Orchestration Trace
            </h3>
            <p className="text-xs text-[#71717A]">
              Autonomous multimodal appraisal & platform copy pipeline
            </p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <div className="text-xs font-semibold text-[#E8623D]">
            {progressPercent}% Complete
          </div>
          <div className="w-24 h-2 rounded-full bg-[#F4F2EC] overflow-hidden border border-[#EAE6DF]">
            <div
              className="h-full bg-[#E8623D] transition-all duration-300 ease-out"
              style={{ width: `${progressPercent}%` }}
            />
          </div>
        </div>
      </div>

      {/* Vertical Sequence of Steps */}
      <div className="space-y-4">
        {steps.map((step, idx) => {
          const isPending = step.status === "pending";
          const isActive = step.status === "active";
          const isDone = step.status === "done";

          return (
            <div
              key={step.id}
              className={`flex items-start gap-3.5 p-3 rounded-xl transition-all duration-200 ${
                isActive
                  ? "bg-[#FDF2EF] border border-[#F5C7B8] shadow-xs"
                  : isDone
                  ? "bg-[#FAF9F6] border border-transparent opacity-90"
                  : "opacity-50 border border-transparent"
              }`}
            >
              {/* Status Icon */}
              <div className="shrink-0 mt-0.5">
                {isDone && (
                  <div className="w-5 h-5 rounded-full bg-emerald-500 text-white flex items-center justify-center shadow-xs">
                    <Check className="w-3.5 h-3.5 stroke-[2.5]" />
                  </div>
                )}

                {isActive && (
                  <div className="w-5 h-5 rounded-full bg-[#E8623D] flex items-center justify-center text-white shadow-xs">
                    <span className="w-2 h-2 rounded-full bg-white animate-ping" />
                  </div>
                )}

                {isPending && (
                  <div className="w-5 h-5 rounded-full border-2 border-[#D4D0C7] bg-[#F4F2EC] flex items-center justify-center">
                    <span className="w-1.5 h-1.5 rounded-full bg-[#A1A1AA]" />
                  </div>
                )}
              </div>

              {/* Label & Details */}
              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between gap-2">
                  <p
                    className={`text-xs sm:text-sm font-medium tracking-tight ${
                      isActive
                        ? "text-[#B84323] font-semibold"
                        : isDone
                        ? "text-[#27272A]"
                        : "text-[#71717A]"
                    }`}
                  >
                    {step.label}
                  </p>

                  <span
                    className={`text-[10px] font-mono font-semibold uppercase px-2 py-0.5 rounded-md ${
                      isActive
                        ? "bg-[#FCE5DF] text-[#B84323] border border-[#F5C7B8]"
                        : isDone
                        ? "bg-emerald-50 text-emerald-700 border border-emerald-200"
                        : "bg-[#F0ECE1] text-[#A1A1AA]"
                    }`}
                  >
                    {isDone ? "Done" : isActive ? "Active" : "Queued"}
                  </span>
                </div>

                {step.subtext && (
                  <p className="text-[11px] text-[#71717A] mt-0.5 font-normal">
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
