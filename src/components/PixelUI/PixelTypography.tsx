/**
 * PixelTypography - Authentic Minecraft Headings, Text, and Splash Elements
 *
 * Adapted from zardoy/minecraft-web-client (MIT License - Copyright (c) 2020 PrismarineJS / zardoy)
 */

import React from "react";
import "./pixel.css";

export type MinecraftColor =
  "white" | "yellow" | "gold" | "green" | "red" | "aqua" | "gray" | "dark-gray";

function getColorVar(color: MinecraftColor): string {
  switch (color) {
    case "yellow":
      return "var(--mc-yellow)";
    case "gold":
      return "var(--mc-gold)";
    case "green":
      return "var(--mc-green)";
    case "red":
      return "var(--mc-red)";
    case "aqua":
      return "var(--mc-aqua)";
    case "gray":
      return "var(--mc-gray)";
    case "dark-gray":
      return "var(--mc-dark-gray)";
    case "white":
    default:
      return "var(--mc-white)";
  }
}

export interface PixelHeadingProps extends React.HTMLAttributes<HTMLHeadingElement> {
  level?: 1 | 2 | 3 | 4;
  color?: MinecraftColor;
  children: React.ReactNode;
}

export const PixelHeading: React.FC<PixelHeadingProps> = ({
  level = 1,
  color = "white",
  children,
  style,
  className = "",
  ...props
}) => {
  const headingStyle: React.CSSProperties = {
    fontFamily: "var(--mc-font)",
    fontSize:
      level === 1
        ? "clamp(1.5rem, 4vw, 2.4rem)"
        : level === 2
          ? "clamp(1.2rem, 3vw, 1.8rem)"
          : level === 3
            ? "clamp(1rem, 2vw, 1.3rem)"
            : "0.9rem",
    color: getColorVar(color),
    textShadow: "2px 2px 0px #1a1a1a",
    margin: "0 0 12px 0",
    letterSpacing: "1px",
    lineHeight: 1.4,
    ...style,
  };

  if (level === 2) {
    return (
      <h2 className={className} style={headingStyle} {...props}>
        {children}
      </h2>
    );
  }
  if (level === 3) {
    return (
      <h3 className={className} style={headingStyle} {...props}>
        {children}
      </h3>
    );
  }
  if (level === 4) {
    return (
      <h4 className={className} style={headingStyle} {...props}>
        {children}
      </h4>
    );
  }
  return (
    <h1 className={className} style={headingStyle} {...props}>
      {children}
    </h1>
  );
};

export interface PixelTextProps extends React.HTMLAttributes<HTMLParagraphElement> {
  color?: MinecraftColor;
  size?: number | string;
  shadow?: boolean;
  children: React.ReactNode;
}

export const PixelText: React.FC<PixelTextProps> = ({
  color = "white",
  size = 11,
  shadow = true,
  children,
  style,
  className = "",
  ...props
}) => {
  return (
    <p
      className={className}
      style={{
        fontFamily: "var(--mc-font)",
        fontSize: size,
        color: getColorVar(color),
        textShadow: shadow ? "1px 1px 0px #1a1a1a" : "none",
        lineHeight: 1.7,
        margin: 0,
        ...style,
      }}
      {...props}
    >
      {children}
    </p>
  );
};

export interface PixelSplashProps extends React.HTMLAttributes<HTMLSpanElement> {
  children: React.ReactNode;
}

export const PixelSplash: React.FC<PixelSplashProps> = ({
  children,
  className = "",
  style,
  ...props
}) => {
  return (
    <span className={`pixel-splash ${className}`.trim()} style={style} {...props}>
      {children}
    </span>
  );
};
