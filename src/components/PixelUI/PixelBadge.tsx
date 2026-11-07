/**
 * PixelBadge - Authentic Minecraft Status & Item Badge
 *
 * Adapted from zardoy/minecraft-web-client (MIT License - Copyright (c) 2020 PrismarineJS / zardoy)
 */

import React from "react";
import "./pixel.css";

export interface PixelBadgeProps extends React.HTMLAttributes<HTMLSpanElement> {
  color?: "green" | "yellow" | "gold" | "aqua" | "red";
  dot?: boolean;
  children: React.ReactNode;
}

export const PixelBadge: React.FC<PixelBadgeProps> = ({
  color = "green",
  dot = true,
  children,
  className = "",
  style,
  ...props
}) => {
  return (
    <span
      className={`pixel-badge pixel-badge--${color} ${className}`.trim()}
      style={style}
      {...props}
    >
      {dot && <span className="pixel-badge__dot" />}
      {children}
    </span>
  );
};

export default PixelBadge;
