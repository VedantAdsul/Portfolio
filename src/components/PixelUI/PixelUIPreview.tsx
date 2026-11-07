/**
 * PixelUIPreview - Isolated Showcase for Minecraft UI Components
 *
 * Allows full visual and interactive inspection of extracted Minecraft UI components
 * before integrating them into main portfolio sections.
 */

import React, { useState } from "react";
import {
  PixelButton,
  PixelPanel,
  PixelInput,
  PixelHeading,
  PixelText,
  PixelSplash,
  PixelBadge,
  MinecraftEllipsis,
  MinecraftSquareLoader,
  MinecraftChunkGrid,
} from "./index";
import "./pixel.css";

export interface PixelUIPreviewProps {
  onClose?: () => void;
}

export const PixelUIPreview: React.FC<PixelUIPreviewProps> = ({ onClose }) => {
  const [clickCount, setClickCount] = useState<number>(0);
  const [inputValue, setInputValue] = useState<string>("VEDANT.EXE");
  const [sliderProgress, setSliderProgress] = useState<number>(64);
  const [activeTab, setActiveTab] = useState<"buttons" | "panels" | "loading">("buttons");

  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 9999,
        backgroundColor: "rgba(10, 10, 10, 0.96)",
        overflowY: "auto",
        padding: "32px 16px",
        boxSizing: "border-box",
        fontFamily: "var(--mc-font)",
      }}
    >
      <div style={{ maxWidth: 860, margin: "0 auto" }}>
        {/* Top Header */}
        <div style={{ textAlign: "center", marginBottom: 28, position: "relative" }}>
          <PixelHeading level={1} color="white">
            MINECRAFT UI SYSTEM
          </PixelHeading>
          <div style={{ marginBottom: 12 }}>
            <PixelSplash>Authentic Java Edition!</PixelSplash>
          </div>
          <PixelText color="gray" size={10}>
            Isolated Component Inspection for VEDANT.EXE
          </PixelText>

          {onClose && (
            <div style={{ position: "absolute", top: 0, right: 0 }}>
              <PixelButton variant="compact" label="Close [X]" onClick={onClose} />
            </div>
          )}
        </div>

        {/* Tab Controls */}
        <div
          style={{
            display: "flex",
            justifyContent: "center",
            gap: 10,
            marginBottom: 24,
            flexWrap: "wrap",
          }}
        >
          <PixelButton
            variant={activeTab === "buttons" ? "primary" : "default"}
            label="Buttons & Typography"
            onClick={() => setActiveTab("buttons")}
          />
          <PixelButton
            variant={activeTab === "panels" ? "primary" : "default"}
            label="Panels & Inputs"
            onClick={() => setActiveTab("panels")}
          />
          <PixelButton
            variant={activeTab === "loading" ? "primary" : "default"}
            label="Loading & Chunks"
            onClick={() => setActiveTab("loading")}
          />
        </div>

        {/* Tab 1: Buttons & Typography */}
        {activeTab === "buttons" && (
          <PixelPanel title="Buttons & Color Spectrum" style={{ margin: "0 auto" }}>
            <div style={{ display: "grid", gap: 20 }}>
              {/* Button Row */}
              <div>
                <PixelText color="gray" size={9} style={{ marginBottom: 8 }}>
                  BUTTON INTERACTION STATES
                </PixelText>
                <div
                  style={{
                    display: "flex",
                    gap: 12,
                    flexWrap: "wrap",
                    alignItems: "center",
                  }}
                >
                  <PixelButton
                    label="Standard Button"
                    onClick={() => setClickCount((c) => c + 1)}
                  />
                  <PixelButton
                    variant="primary"
                    label={`Clicks: ${clickCount}`}
                    onClick={() => setClickCount((c) => c + 1)}
                  />
                  <PixelButton variant="compact" label="Compact" />
                  <PixelButton label="Disabled" disabled />
                </div>
              </div>

              {/* Badges */}
              <div>
                <PixelText color="gray" size={9} style={{ marginBottom: 8 }}>
                  MINECRAFT STATUS BADGES
                </PixelText>
                <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
                  <PixelBadge color="green">Operational</PixelBadge>
                  <PixelBadge color="gold">In Progress</PixelBadge>
                  <PixelBadge color="aqua">Hardware Node</PixelBadge>
                  <PixelBadge color="red">Emergency Alert</PixelBadge>
                  <PixelBadge color="yellow">Level 99</PixelBadge>
                </div>
              </div>

              {/* Color System */}
              <div>
                <PixelText color="gray" size={9} style={{ marginBottom: 8 }}>
                  MINECRAFT COLOR CODES
                </PixelText>
                <div
                  style={{
                    display: "grid",
                    gridTemplateColumns: "repeat(auto-fit, minmax(130px, 1fr))",
                    gap: 8,
                    fontSize: 10,
                  }}
                >
                  <span style={{ color: "var(--mc-white)" }}>§f White</span>
                  <span style={{ color: "var(--mc-yellow)" }}>§e Yellow</span>
                  <span style={{ color: "var(--mc-gold)" }}>§6 Gold</span>
                  <span style={{ color: "var(--mc-green)" }}>§a Green</span>
                  <span style={{ color: "var(--mc-aqua)" }}>§b Aqua</span>
                  <span style={{ color: "var(--mc-red)" }}>§c Red</span>
                  <span style={{ color: "var(--mc-gray)" }}>§7 Gray</span>
                </div>
              </div>
            </div>
          </PixelPanel>
        )}

        {/* Tab 2: Panels & Inputs */}
        {activeTab === "panels" && (
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fit, minmax(340px, 1fr))",
              gap: 20,
            }}
          >
            {/* Standard Panel */}
            <PixelPanel
              title="Workshop Sector"
              subtitle="Select featured engineering project"
              footer={
                <>
                  <PixelButton variant="compact" label="Back" />
                  <PixelButton variant="primary" label="Confirm" />
                </>
              }
            >
              <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                <PixelInput
                  label="Search Inventory / Projects"
                  value={inputValue}
                  onChange={(e) => setInputValue(e.target.value)}
                  placeholder="Enter project name..."
                />
                <PixelText color="yellow" size={10}>
                  Active Selection: {inputValue || "None"}
                </PixelText>
                <div style={{ display: "flex", gap: 8, marginTop: 4 }}>
                  <PixelBadge color="aqua">GeoFence</PixelBadge>
                  <PixelBadge color="gold">EviLog</PixelBadge>
                  <PixelBadge color="green">SafePath</PixelBadge>
                </div>
              </div>
            </PixelPanel>

            {/* Dirt-Themed Panel */}
            <PixelPanel
              variant="dirt"
              title="Options & Settings"
              subtitle="Authentic tiled options background"
              footer={<PixelButton label="Done" variant="full" />}
            >
              <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                <PixelButton variant="full" label="Music & Sounds..." />
                <PixelButton variant="full" label="Video Settings..." />
                <PixelButton variant="full" label="Resource Packs..." />
              </div>
            </PixelPanel>
          </div>
        )}

        {/* Tab 3: Loading & Chunks */}
        {activeTab === "loading" && (
          <PixelPanel
            title="World Loading & Chunk Streaming"
            style={{ margin: "0 auto", maxWidth: 680 }}
          >
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))",
                gap: 24,
                alignItems: "center",
              }}
            >
              {/* Chunk Map Loader */}
              <div
                style={{
                  display: "flex",
                  flexDirection: "column",
                  alignItems: "center",
                  gap: 12,
                }}
              >
                <PixelText color="gray" size={9}>
                  SQUARE CHUNK MAP LOADER
                </PixelText>
                <MinecraftSquareLoader progress={sliderProgress} size={130} />
                <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                  <input
                    type="range"
                    min="0"
                    max="100"
                    value={sliderProgress}
                    onChange={(e) => setSliderProgress(Number(e.target.value))}
                    style={{ width: 120 }}
                  />
                  <PixelText color="yellow" size={9}>
                    {sliderProgress}%
                  </PixelText>
                </div>
              </div>

              {/* Chunk Grid Simulation */}
              <div
                style={{
                  display: "flex",
                  flexDirection: "column",
                  alignItems: "center",
                  gap: 12,
                }}
              >
                <PixelText color="gray" size={9}>
                  CHUNK DOWNLOAD GRID
                </PixelText>
                <MinecraftChunkGrid gridSize={6} />
                <MinecraftEllipsis baseText="Streaming Chunks" />
              </div>
            </div>
          </PixelPanel>
        )}
      </div>
    </div>
  );
};

export default PixelUIPreview;
