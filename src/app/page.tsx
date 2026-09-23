"use client";

import React, { useState } from "react";
import { Header } from "../components/Header";
import { PhotoUploadZone } from "../components/PhotoUploadZone";
import { NotesInput } from "../components/NotesInput";
import { GenerateButton } from "../components/GenerateButton";
import { ResultsSummary } from "../components/ResultsSummary";
import { FlawsCallout } from "../components/FlawsCallout";
import { PlatformTabs } from "../components/PlatformTabs";
import { EmptyState } from "../components/EmptyState";
import { AgentTrace } from "../components/AgentTrace";
import { UploadedPhoto, ResaleReport, AgentStep } from "../types/listing";
import { generateResaleListingAction } from "./actions/generate";
import { RefreshCw, AlertCircle } from "lucide-react";

const PIPELINE_STEPS_CONFIG: Omit<AgentStep, "status">[] = [
  {
    id: "step_photos",
    label: "Inspecting item photos & labels",
    subtext: "Detecting garment type, brand tags, materials, and hardware details",
  },
  {
    id: "step_condition",
    label: "Evaluating condition & wear details",
    subtext: "Grading wear level and identifying specific disclosure points",
  },
  {
    id: "step_price",
    label: "Calculating recent market comps",
    subtext: "Estimating fair secondary market valuation across resale channels",
  },
  {
    id: "step_listing",
    label: "Drafting search-friendly listing copy",
    subtext: "Writing clear item description, specifications, and category tags",
  },
  {
    id: "step_platforms",
    label: "Formatting for eBay, Poshmark & Marketplace",
    subtext: "Tailoring character lengths, negotiation room, and local pickup terms",
  },
];

export default function Home() {
  const [photos, setPhotos] = useState<UploadedPhoto[]>([]);
  const [notes, setNotes] = useState<string>("");
  const [photoError, setPhotoError] = useState<string | null>(null);
  const [isGenerating, setIsGenerating] = useState<boolean>(false);
  const [agentSteps, setAgentSteps] = useState<AgentStep[]>([]);
  const [report, setReport] = useState<ResaleReport | null>(null);

  const handleAddPhotos = (newPhotos: UploadedPhoto[]) => {
    setPhotoError(null);
    setPhotos((prev) => [...prev, ...newPhotos].slice(0, 4));
  };

  const handleRemovePhoto = (id: string) => {
    setPhotos((prev) => {
      const target = prev.find((p) => p.id === id);
      if (target?.previewUrl) {
        URL.revokeObjectURL(target.previewUrl);
      }
      return prev.filter((p) => p.id !== id);
    });
  };

  const handleGenerate = async () => {
    if (photos.length === 0 || isGenerating) return;

    setIsGenerating(true);
    setReport(null);
    setPhotoError(null);

    // Initialize all steps to pending
    const initialSteps: AgentStep[] = PIPELINE_STEPS_CONFIG.map((step) => ({
      ...step,
      status: "pending",
    }));
    setAgentSteps(initialSteps);

    try {
      const formData = new FormData();
      photos.forEach((photo) => {
        formData.append("photos", photo.file);
      });
      if (notes.trim()) {
        formData.append("notes", notes.trim());
      }

      // Connect to real-time streaming endpoint
      const res = await fetch("/api/generate", {
        method: "POST",
        body: formData,
      });

      if (!res.ok || !res.body) {
        // Fallback to direct server action if streaming endpoint fails
        const fallbackResult = await generateResaleListingAction(formData);
        if (!fallbackResult.success) {
          setPhotoError(fallbackResult.error);
          setAgentSteps([]);
          return;
        }
        setAgentSteps((prev) => prev.map((s) => ({ ...s, status: "done" })));
        await new Promise((r) => setTimeout(r, 200));
        setReport(fallbackResult.data);
        return;
      }

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";

      while (true) {
        const { value, done } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n");
        buffer = lines.pop() || "";

        for (const line of lines) {
          const trimmed = line.trim();
          if (!trimmed || !trimmed.startsWith("data: ")) continue;

          try {
            const event = JSON.parse(trimmed.slice(6));

            if (event.type === "step_start") {
              const stepIndex = PIPELINE_STEPS_CONFIG.findIndex((s) => s.id === event.stepId);
              setAgentSteps((prev) =>
                prev.map((s, idx) => ({
                  ...s,
                  status: idx < stepIndex ? "done" : idx === stepIndex ? "active" : "pending",
                }))
              );
            } else if (event.type === "step_done") {
              setAgentSteps((prev) =>
                prev.map((s) => (s.id === event.stepId ? { ...s, status: "done" } : s))
              );
            } else if (event.type === "result") {
              setAgentSteps((prev) => prev.map((s) => ({ ...s, status: "done" })));
              await new Promise((r) => setTimeout(r, 200));
              setReport(event.data);
            } else if (event.type === "error") {
              setPhotoError(event.error);
              setAgentSteps([]);
              return;
            }
          } catch (parseErr) {
            console.error("Failed to parse SSE line:", trimmed, parseErr);
          }
        }
      }
    } catch (err: any) {
      console.error("Listing generation error:", err);
      setPhotoError(err?.message || "An unexpected error occurred while analyzing photos.");
      setAgentSteps([]);
    } finally {
      setIsGenerating(false);
    }
  };

  const handleReset = () => {
    photos.forEach((p) => {
      if (p.previewUrl) URL.revokeObjectURL(p.previewUrl);
    });
    setPhotos([]);
    setNotes("");
    setReport(null);
    setAgentSteps([]);
    setPhotoError(null);
    setIsGenerating(false);
  };

  return (
    <div className="min-h-screen flex flex-col bg-[#FAF9F6] text-[#18181B]">
      <Header />

      <main className="flex-1 max-w-3xl w-full mx-auto px-4 sm:px-6 py-6 sm:py-8 space-y-6">
        {/* Header Title & Reset */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
          <div>
            <h1 className="font-heading font-bold text-2xl sm:text-3xl text-[#18181B] tracking-tight">
              Create Resale Listings
            </h1>
            <p className="text-xs sm:text-sm text-[#71717A] mt-0.5">
              Upload 1–4 item photos to generate condition appraisal, price comps, and multi-platform listings.
            </p>
          </div>

          <div className="flex items-center gap-2 self-start sm:self-auto pt-1 sm:pt-0">
            {photos.length > 0 && (
              <button
                type="button"
                onClick={handleReset}
                disabled={isGenerating}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium text-[#71717A] hover:text-[#18181B] hover:bg-[#F2EFE8] transition-colors disabled:opacity-50"
              >
                <RefreshCw className="w-3.5 h-3.5" />
                <span>Reset</span>
              </button>
            )}
          </div>
        </div>

        {/* PHOTO UPLOAD CARD */}
        <section className="bg-white rounded-2xl border border-[#E8E4DA] p-5 sm:p-6 shadow-warm space-y-4">
          <PhotoUploadZone
            photos={photos}
            onAddPhotos={handleAddPhotos}
            onRemovePhoto={handleRemovePhoto}
            error={photoError}
            onErrorChange={setPhotoError}
          />

          <NotesInput
            notes={notes}
            onChange={setNotes}
            disabled={isGenerating}
          />

          <div className="flex justify-end pt-1">
            <GenerateButton
              photoCount={photos.length}
              isLoading={isGenerating}
              onClick={handleGenerate}
            />
          </div>
        </section>

        {/* Error Banner */}
        {photoError && (
          <div className="flex items-start gap-2.5 p-4 rounded-xl bg-red-50 border border-red-200 text-red-800 text-xs sm:text-sm animate-fade-in-slide">
            <AlertCircle className="w-4 h-4 shrink-0 text-red-500 mt-0.5" />
            <div className="space-y-0.5">
              <span className="font-semibold">Unable to Generate Listing</span>
              <p className="text-red-700">{photoError}</p>
            </div>
          </div>
        )}

        {/* PROGRESS / APPRAISAL STATE OR REAL RESULTS */}
        <section className="space-y-5">
          {isGenerating && agentSteps.length > 0 ? (
            <AgentTrace steps={agentSteps} />
          ) : report ? (
            <div className="space-y-5 animate-fade-in-slide">
              <ResultsSummary report={report} />
              <FlawsCallout flaws={report.flaws_to_disclose} />
              <PlatformTabs platformListings={report.platform_listings} />
            </div>
          ) : (
            <EmptyState />
          )}
        </section>
      </main>

      <footer className="w-full border-t border-[#EFECE6] bg-[#FFFFFF] py-4 mt-8">
        <div className="max-w-3xl mx-auto px-4 sm:px-6 flex flex-col sm:flex-row items-center justify-between text-xs text-[#71717A] gap-2">
          <span>Relist — Multi-Platform Resale Listing Studio</span>
          <span className="text-[#A1A1AA]">Supports eBay, Poshmark, and Facebook Marketplace</span>
        </div>
      </footer>
    </div>
  );
}
