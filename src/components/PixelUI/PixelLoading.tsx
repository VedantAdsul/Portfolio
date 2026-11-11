/**
 * PixelLoading - Authentic Minecraft Loading Components
 *
 * Adapted from zardoy/minecraft-web-client (MIT License - Copyright (c) 2020 PrismarineJS / zardoy)
 * Implements discrete chunk grid downloading visualizer, animated status dots, and
 * authentic Java Edition square chunk frame loader with discrete color-state progression.
 */

import React, { useEffect, useRef, useState } from "react";
import "./pixel.css";

export interface MinecraftEllipsisProps {
  baseText?: string;
}

export const MinecraftEllipsis: React.FC<MinecraftEllipsisProps> = ({
  baseText = "Loading",
}) => {
  const [dotCount, setDotCount] = useState<number>(0);

  useEffect(() => {
    const timer = setInterval(() => {
      setDotCount((prev) => (prev + 1) % 4);
    }, 450);

    return () => clearInterval(timer);
  }, []);

  return (
    <span
      style={{
        fontFamily: "var(--mc-font)",
        fontSize: "12px",
        color: "var(--mc-white)",
        textShadow: "1px 1px 0px #1a1a1a",
      }}
    >
      {baseText}
      <span style={{ display: "inline-block", width: "24px", textAlign: "left" }}>
        {".".repeat(dotCount)}
      </span>
    </span>
  );
};

export interface MinecraftSquareLoaderProps {
  progress: number; // 0 to 100
  size?: number;
}

/**
 * MinecraftSquareLoader - Authentic Minecraft Java Edition Chunk-Generation Loader
 *
 * Recreates the exact multi-stage radial chunk generation shown in Java Edition:
 * 1. At 0%: The inner loading box is 100% solid black.
 * 2. As generation starts: Everything begins in the middle as small nested squares
 *    (White core -> Green foliage border -> Blue water border -> Grey terrain layer).
 * 3. The squares expand from the inside outward, slowly filling and replacing the black square.
 * 4. At 100%: The grey terrain expands fully to the outer outline, the blue and green
 *    borders reach their final frame positions, and the white core completes.
 */
export const MinecraftSquareLoader: React.FC<MinecraftSquareLoaderProps> = ({
  progress,
  size = 180,
}) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const clampedProgress = Math.max(0, Math.min(100, Math.round(progress)));

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    ctx.imageSmoothingEnabled = false;

    const S = size;
    const center = S / 2;
    const OUTLINE = 3;
    const maxRadius = Math.floor((S - 2 * OUTLINE) / 2); // 87px

    // Outer 3px dark black border
    ctx.fillStyle = "#000000";
    ctx.fillRect(0, 0, S, S);

    // If 0%: The interior is 100% solid black
    if (clampedProgress === 0) {
      ctx.fillStyle = "#000000";
      ctx.fillRect(OUTLINE, OUTLINE, S - 2 * OUTLINE, S - 2 * OUTLINE);
      return;
    }

    // Normalized progress p in [0, 1]
    const p = clampedProgress / 100;
    // Radial growth is area-proportional (sqrt) matching 2D chunk distribution
    const growth = Math.sqrt(p);

    // Discrete pixel stepping (2px integer blocks for snappy pixelated feel)
    const step = 2;

    // 1. Grey terrain/stone radius: expands outward to fill the black box
    // Reaches the outer boundary around p = 0.85
    const rGreyTarget = Math.min(
      maxRadius,
      Math.round(Math.min(1.0, growth * 1.15) * maxRadius)
    );
    const rGrey = Math.floor(rGreyTarget / step) * step;

    // 2. Blue water border outer radius
    const maxBlueRadius = Math.round(maxRadius * 0.7); // ~61px
    const rBlueTarget = Math.min(rGrey, Math.round(growth * maxBlueRadius));
    const rBlue = Math.floor(rBlueTarget / step) * step;

    // 3. Green vegetation border outer radius (3px inside blue)
    const rGreenTarget = Math.min(rBlue, Math.max(0, rBlue - 3));
    const rGreen = Math.floor(rGreenTarget / step) * step;

    // 4. White finalized core radius (3px inside green)
    const rWhiteTarget = Math.min(rGreen, Math.max(0, rGreen - 3));
    const rWhite = Math.floor(rWhiteTarget / step) * step;

    // Fill inner box background with black (unloaded world void)
    ctx.fillStyle = "#000000";
    ctx.fillRect(OUTLINE, OUTLINE, S - 2 * OUTLINE, S - 2 * OUTLINE);

    // Draw concentric squares from outside in (Chebyshev distance):
    // Layer 1: Grey stone & terrain layer (expands from center, replacing black)
    if (rGrey > 0) {
      ctx.fillStyle = "#9a9a9a";
      const x = Math.round(center - rGrey);
      const y = Math.round(center - rGrey);
      const w = Math.round(rGrey * 2);
      ctx.fillRect(x, y, w, w);
    }

    // Layer 2: Blue water border square
    if (rBlue > 0) {
      ctx.fillStyle = "#1e4db8";
      const x = Math.round(center - rBlue);
      const y = Math.round(center - rBlue);
      const w = Math.round(rBlue * 2);
      ctx.fillRect(x, y, w, w);
    }

    // Layer 3: Green vegetation border square
    if (rGreen > 0) {
      ctx.fillStyle = "#22c55e";
      const x = Math.round(center - rGreen);
      const y = Math.round(center - rGreen);
      const w = Math.round(rGreen * 2);
      ctx.fillRect(x, y, w, w);
    }

    // Layer 4: White finalized core
    if (rWhite > 0) {
      ctx.fillStyle = "#ffffff";
      const x = Math.round(center - rWhite);
      const y = Math.round(center - rWhite);
      const w = Math.round(rWhite * 2);
      ctx.fillRect(x, y, w, w);
    }
  }, [clampedProgress, size]);

  return (
    <div
      style={{
        width: size,
        height: size,
        boxSizing: "content-box",
        imageRendering: "pixelated",
        display: "block",
      }}
    >
      <canvas
        ref={canvasRef}
        width={size}
        height={size}
        style={{
          width: size,
          height: size,
          display: "block",
          imageRendering: "pixelated",
        }}
      />
    </div>
  );
};

export interface MinecraftChunkGridProps {
  gridSize?: number; // e.g. 6x6
  loadedCount?: number;
}

export const MinecraftChunkGrid: React.FC<MinecraftChunkGridProps> = ({
  gridSize = 6,
  loadedCount,
}) => {
  const totalChunks = gridSize * gridSize;
  const [autoLoaded, setAutoLoaded] = useState<number>(0);

  const activeLoaded = loadedCount !== undefined ? loadedCount : autoLoaded;

  useEffect(() => {
    if (loadedCount !== undefined) return;

    // Discrete step intervals without smooth transitions
    const interval = setInterval(() => {
      setAutoLoaded((prev) => (prev >= totalChunks ? 0 : prev + 1));
    }, 180);

    return () => clearInterval(interval);
  }, [loadedCount, totalChunks]);

  return (
    <div
      style={{
        display: "grid",
        gridTemplateColumns: `repeat(${gridSize}, 1fr)`,
        gridTemplateRows: `repeat(${gridSize}, 1fr)`,
        gap: 2,
        width: 132,
        height: 132,
        backgroundColor: "#000000",
        padding: 4,
        border: "2px solid #555555",
        outline: "2px solid #000000",
        boxSizing: "border-box",
        imageRendering: "pixelated",
      }}
    >
      {Array.from({ length: totalChunks }).map((_, index) => {
        const isLoaded = index < activeLoaded;
        const isLoading = index === activeLoaded;

        return (
          <div
            key={index}
            style={{
              backgroundColor: isLoaded ? "#55ff55" : isLoading ? "#ffffff" : "#373737",
              boxShadow: isLoaded ? "inset 1px 1px 0px rgba(255,255,255,0.4)" : undefined,
              imageRendering: "pixelated",
            }}
          />
        );
      })}
    </div>
  );
};
