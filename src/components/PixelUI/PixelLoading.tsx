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
 * MinecraftSquareLoader - Authentic Minecraft Java Edition World-Generation Loader
 *
 * Discrete block-by-block progression:
 * - Dark/black: not started (#141414)
 * - Dark grey: pending (#555555)
 * - Light grey/white: processing (#ffffff)
 * - Green: completed (#55ff55)
 * Hard pixel edges, no transitions, instantaneous color-state changes.
 */
export const MinecraftSquareLoader: React.FC<MinecraftSquareLoaderProps> = ({
  progress,
  size = 132,
}) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const clampedProgress = Math.max(0, Math.min(100, Math.round(progress)));

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    ctx.imageSmoothingEnabled = false;

    // Grid resolution: 22 x 22 discrete blocks
    const GRID_SIZE = 22;
    const blockSize = Math.floor(size / GRID_SIZE);
    const canvasPixelWidth = blockSize * GRID_SIZE;
    const center = (GRID_SIZE - 1) / 2;
    const maxRadius = center + 0.5;

    // Discrete expansion radius
    const currentRadius = (clampedProgress / 100) * maxRadius;

    // Minecraft Java Edition Color States
    const COLOR_NOT_STARTED = "#141414"; // Dark / black
    const COLOR_PENDING = "#555555"; // Dark grey
    const COLOR_PROCESSING = "#ffffff"; // Light grey / white
    const COLOR_COMPLETED = "#55ff55"; // Green

    // Clear background
    ctx.fillStyle = COLOR_NOT_STARTED;
    ctx.fillRect(0, 0, canvasPixelWidth, canvasPixelWidth);

    for (let y = 0; y < GRID_SIZE; y++) {
      for (let x = 0; x < GRID_SIZE; x++) {
        const dx = Math.abs(x - center);
        const dy = Math.abs(y - center);
        const chebyshev = Math.max(dx, dy);

        let color: string;

        if (clampedProgress === 0) {
          color = chebyshev <= 2 ? COLOR_PENDING : COLOR_NOT_STARTED;
        } else if (clampedProgress >= 100) {
          color = chebyshev >= center - 0.75 ? COLOR_COMPLETED : COLOR_PROCESSING;
        } else if (chebyshev < currentRadius - 0.75) {
          // Core processing area
          color = COLOR_PROCESSING;
        } else if (chebyshev <= currentRadius) {
          // Active completed boundary
          color = COLOR_COMPLETED;
        } else if (chebyshev <= currentRadius + 2) {
          // Pending generation queue
          color = COLOR_PENDING;
        } else {
          // Not started
          color = COLOR_NOT_STARTED;
        }

        ctx.fillStyle = color;
        ctx.fillRect(x * blockSize, y * blockSize, blockSize, blockSize);
      }
    }
  }, [clampedProgress, size]);

  const GRID_SIZE = 22;
  const blockSize = Math.floor(size / GRID_SIZE);
  const actualSize = blockSize * GRID_SIZE;

  return (
    <div
      style={{
        width: actualSize,
        height: actualSize,
        border: "3px solid #000000",
        backgroundColor: "#141414",
        boxSizing: "content-box",
        imageRendering: "pixelated",
        display: "block",
      }}
    >
      <canvas
        ref={canvasRef}
        width={actualSize}
        height={actualSize}
        style={{
          width: actualSize,
          height: actualSize,
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
