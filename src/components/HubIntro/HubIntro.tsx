/**
 * HubIntro Component
 *
 * Introductory portfolio overlay displayed when the guided camera
 * smoothly settles at the `Hub Resting` position overlooking the Central Hub.
 *
 * Adheres strictly to the VEDANT.EXE design direction:
 * - Minecraft-inspired pixel-art headings and badges
 * - Readable sans-serif body typography
 * - Project palette: Forest (#17231D), Sage (#C8D6B9), Parchment (#E8E4D9), Wood (#9C754D)
 * - Restrained, modern layout without generic gradients or glassmorphism
 */

import React from "react";
import "../PixelUI/pixel.css";

export interface HubIntroProps {
  visible: boolean;
  onExploreWorkshop: () => void;
  onViewResearch: () => void;
}

export const HubIntro: React.FC<HubIntroProps> = ({
  visible,
  onExploreWorkshop,
  onViewResearch,
}) => {
  if (!visible) return null;

  return (
    <div
      style={{
        position: "fixed",
        bottom: "40px",
        left: "50%",
        transform: "translateX(-50%)",
        zIndex: 45,
        width: "90%",
        maxWidth: "640px",
        pointerEvents: "auto",
        animation: "hubIntroFadeIn 0.8s cubic-bezier(0.16, 1, 0.3, 1) forwards",
      }}
    >
      <div
        className="pixel-panel pixel-panel--dirt"
        style={{
          padding: "24px 28px",
          backgroundColor: "rgba(23, 35, 29, 0.94)",
          border: "4px solid var(--color-wood, #9c754d)",
          boxShadow: "0 12px 36px rgba(0, 0, 0, 0.6)",
        }}
      >
        {/* System sector badge */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            marginBottom: "12px",
          }}
        >
          <span
            style={{
              fontFamily: "var(--mc-font, monospace)",
              fontSize: "11px",
              letterSpacing: "1px",
              color: "var(--color-sage, #c8d6b9)",
              textTransform: "uppercase",
            }}
          >
            [SYSTEM ONLINE] // SECTOR 01: CENTRAL HUB
          </span>
          <span
            style={{
              fontFamily: "var(--mc-font, monospace)",
              fontSize: "10px",
              color: "var(--mc-gray, #808080)",
            }}
          >
            RESTING @ [ -274, 16, -20 ]
          </span>
        </div>

        {/* Name and role heading */}
        <h1
          style={{
            fontFamily: "var(--mc-font, monospace)",
            fontSize: "24px",
            lineHeight: 1.25,
            color: "var(--color-parchment, #e8e4d9)",
            textShadow: "2px 2px 0px #000000",
            margin: "0 0 6px 0",
            letterSpacing: "0.5px",
          }}
        >
          VEDANT ADSUL
        </h1>
        <p
          style={{
            fontFamily: "var(--font-mono, monospace)",
            fontSize: "13px",
            color: "var(--color-sage, #c8d6b9)",
            letterSpacing: "1px",
            textTransform: "uppercase",
            margin: "0 0 14px 0",
          }}
        >
          Full-Stack &amp; Systems Developer
        </p>

        {/* Narrative bio */}
        <p
          style={{
            fontFamily: "var(--font-sans, system-ui, -apple-system, sans-serif)",
            fontSize: "14px",
            lineHeight: 1.6,
            color: "var(--color-parchment, #e8e4d9)",
            margin: "0 0 20px 0",
            opacity: 0.92,
          }}
        >
          Welcome to VEDANT.EXE — an interactive 3D developer portfolio rendered in a
          single connected voxel world. Explore featured engineering projects in the
          Workshop or browse research and experience in the pavilions.
        </p>

        {/* Action Controls & Navigation Shortcuts */}
        <div
          style={{
            display: "flex",
            flexWrap: "wrap",
            alignItems: "center",
            justifyContent: "space-between",
            gap: "12px",
            paddingTop: "8px",
            borderTop: "1px solid rgba(200, 214, 185, 0.2)",
          }}
        >
          <div style={{ display: "flex", gap: "10px" }}>
            <button
              type="button"
              className="pixel-button pixel-button--primary"
              onClick={onExploreWorkshop}
              style={{
                fontFamily: "var(--mc-font, monospace)",
                fontSize: "12px",
                padding: "8px 16px",
              }}
            >
              EXPLORE WORKSHOP ↓
            </button>
            <button
              type="button"
              className="pixel-button"
              onClick={onViewResearch}
              style={{
                fontFamily: "var(--mc-font, monospace)",
                fontSize: "12px",
                padding: "8px 16px",
              }}
            >
              RESEARCH WING →
            </button>
          </div>

          <span
            style={{
              fontFamily: "var(--mc-font, monospace)",
              fontSize: "10px",
              color: "var(--color-sage, #c8d6b9)",
              opacity: 0.8,
            }}
          >
            [SCROLL DOWN / UP TO NAVIGATE]
          </span>
        </div>
      </div>

      <style>{`
        @keyframes hubIntroFadeIn {
          from {
            opacity: 0;
            transform: translate(-50%, 20px);
          }
          to {
            opacity: 1;
            transform: translate(-50%, 0);
          }
        }
      `}</style>
    </div>
  );
};

export default HubIntro;
