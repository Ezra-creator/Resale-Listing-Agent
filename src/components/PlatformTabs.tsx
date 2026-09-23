import React, { useState } from "react";
import { ShoppingBag, Heart, Store, Sparkles, HelpCircle } from "lucide-react";
import { PlatformListingsMap } from "../types/listing";
import { CopyableField } from "./CopyableField";

interface PlatformTabsProps {
  platformListings: PlatformListingsMap;
}

type TabType = "ebay" | "poshmark" | "facebook_marketplace";

export const PlatformTabs: React.FC<PlatformTabsProps> = ({ platformListings }) => {
  const [activeTab, setActiveTab] = useState<TabType>("ebay");

  const ebay = platformListings.ebay;
  const poshmark = platformListings.poshmark;
  const fb = platformListings.facebook_marketplace;

  return (
    <div className="w-full bg-white rounded-2xl border border-[#E8E4DA] p-5 sm:p-6 shadow-warm space-y-5">
      {/* Tab Navigation Buttons */}
      <div className="flex items-center gap-2 p-1.5 rounded-xl bg-[#FAF9F6] border border-[#EAE6DF] overflow-x-auto scrollbar-thin">
        {/* eBay Tab */}
        <button
          type="button"
          onClick={() => setActiveTab("ebay")}
          className={`flex items-center gap-2 px-3.5 py-2 rounded-lg text-xs sm:text-sm font-semibold transition-all duration-150 ease-out shrink-0 select-none ${
            activeTab === "ebay"
              ? "bg-[#4A6B82] text-white shadow-xs"
              : "text-[#52525B] hover:text-[#18181B] hover:bg-[#F2F0E8]"
          }`}
        >
          <ShoppingBag className="w-4 h-4" />
          <span>eBay</span>
          <span
            className={`text-[10px] px-1.5 py-0.2 rounded-full ${
              activeTab === "ebay" ? "bg-white/20 text-white" : "bg-[#E6DFD5] text-[#52525B]"
            }`}
          >
            Search SEO
          </span>
        </button>

        {/* Poshmark Tab */}
        <button
          type="button"
          onClick={() => setActiveTab("poshmark")}
          className={`flex items-center gap-2 px-3.5 py-2 rounded-lg text-xs sm:text-sm font-semibold transition-all duration-150 ease-out shrink-0 select-none ${
            activeTab === "poshmark"
              ? "bg-[#964867] text-white shadow-xs"
              : "text-[#52525B] hover:text-[#18181B] hover:bg-[#F2F0E8]"
          }`}
        >
          <Heart className="w-4 h-4" />
          <span>Poshmark</span>
          <span
            className={`text-[10px] px-1.5 py-0.2 rounded-full ${
              activeTab === "poshmark" ? "bg-white/20 text-white" : "bg-[#E6DFD5] text-[#52525B]"
            }`}
          >
            Closet & Styling
          </span>
        </button>

        {/* Facebook Marketplace Tab */}
        <button
          type="button"
          onClick={() => setActiveTab("facebook_marketplace")}
          className={`flex items-center gap-2 px-3.5 py-2 rounded-lg text-xs sm:text-sm font-semibold transition-all duration-150 ease-out shrink-0 select-none ${
            activeTab === "facebook_marketplace"
              ? "bg-[#2D6A9F] text-white shadow-xs"
              : "text-[#52525B] hover:text-[#18181B] hover:bg-[#F2F0E8]"
          }`}
        >
          <Store className="w-4 h-4" />
          <span>FB Marketplace</span>
          <span
            className={`text-[10px] px-1.5 py-0.2 rounded-full ${
              activeTab === "facebook_marketplace" ? "bg-white/20 text-white" : "bg-[#E6DFD5] text-[#52525B]"
            }`}
          >
            Local Pickup
          </span>
        </button>
      </div>

      {/* TAB CONTENT: eBay */}
      {activeTab === "ebay" && ebay && (
        <div className="space-y-4 animate-fade-in-slide">
          {/* Pricing Strategy Callout */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between p-3 rounded-xl bg-[#F2F6F9] border border-[#D1DFE8] gap-2 text-xs">
            <div className="text-[#335368]">
              <span className="font-semibold text-[#1F3D52]">eBay Strategy: </span>
              Search-optimized keyword title & higher list price to allow &quot;Best Offer&quot; negotiation.
            </div>
            <div className="font-heading font-bold text-base text-[#1F3D52] shrink-0">
              List at ${ebay.suggested_price}
            </div>
          </div>

          {ebay.category_suggestion && (
            <div className="flex items-center gap-2 text-xs text-[#71717A]">
              <span className="font-semibold text-[#3F3F46]">Suggested eBay Category:</span>
              <span className="px-2.5 py-0.5 rounded-md bg-[#FAF9F6] border border-[#E8E4DA] text-[#4A6B82] font-medium">
                {ebay.category_suggestion}
              </span>
            </div>
          )}

          <CopyableField
            label="eBay Search Title"
            value={ebay.title}
            characterCount={{ max: 80 }}
            badgeText="80 Chars Max"
            badgeColorClass="bg-[#EBF1F5] text-[#335368]"
          />

          <CopyableField
            label="Structured Description & Condition Specs"
            value={ebay.description}
            isTextArea={true}
            rows={7}
          />
        </div>
      )}

      {/* TAB CONTENT: Poshmark */}
      {activeTab === "poshmark" && poshmark && (
        <div className="space-y-4 animate-fade-in-slide">
          {/* Pricing Strategy Callout */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between p-3 rounded-xl bg-[#FAF0F4] border border-[#E9D2DC] gap-2 text-xs">
            <div className="text-[#6D2844]">
              <span className="font-semibold text-[#541B32]">Poshmark Strategy: </span>
              Conversational buyer-friendly tone, closet bundle discounts & room for &quot;Offer to Likers&quot; drops.
            </div>
            <div className="font-heading font-bold text-base text-[#541B32] shrink-0">
              List at ${poshmark.suggested_price}
            </div>
          </div>

          {poshmark.category_suggestion && (
            <div className="flex items-center gap-2 text-xs text-[#71717A]">
              <span className="font-semibold text-[#3F3F46]">Poshmark Taxonomy:</span>
              <span className="px-2.5 py-0.5 rounded-md bg-[#FAF9F6] border border-[#E8E4DA] text-[#964867] font-medium">
                {poshmark.category_suggestion}
              </span>
            </div>
          )}

          <CopyableField
            label="Poshmark Clean Title"
            value={poshmark.title}
            characterCount={{ max: 50 }}
            badgeText="50 Chars Max"
            badgeColorClass="bg-[#F8EEF2] text-[#6D2844]"
          />

          <CopyableField
            label="Conversational Description & Styling"
            value={poshmark.description}
            isTextArea={true}
            rows={7}
          />
        </div>
      )}

      {/* TAB CONTENT: Facebook Marketplace */}
      {activeTab === "facebook_marketplace" && fb && (
        <div className="space-y-4 animate-fade-in-slide">
          {/* Pricing Strategy Callout */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between p-3 rounded-xl bg-[#F0F6FA] border border-[#C8DEED] gap-2 text-xs">
            <div className="text-[#1B4B73]">
              <span className="font-semibold text-[#133A5B]">Marketplace Strategy: </span>
              Direct local title, cash/Venmo pickup terms, smoke-free home callout & realistic cash target.
            </div>
            <div className="font-heading font-bold text-base text-[#133A5B] shrink-0">
              List at ${fb.suggested_price}
            </div>
          </div>

          <CopyableField
            label="Local Marketplace Title"
            value={fb.title}
            characterCount={{ max: 100 }}
            badgeText="100 Chars Max"
            badgeColorClass="bg-[#EDF5FA] text-[#1B4B73]"
          />

          <CopyableField
            label="Local Pickup Description (No Hashtags)"
            value={fb.description}
            isTextArea={true}
            rows={7}
          />
        </div>
      )}
    </div>
  );
};
