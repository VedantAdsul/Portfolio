/**
 * PixelButton - Authentic Minecraft Java Edition Button Component
 *
 * Adapted from zardoy/minecraft-web-client (MIT License - Copyright (c) 2020 PrismarineJS / zardoy)
 * Retains authentic 3D beveled borders, hard pixel drop shadows, and hover/active states.
 */

import React from "react";
import "./pixel.css";

export interface PixelButtonProps extends React.ComponentProps<"button"> {
  label?: string;
  variant?: "default" | "primary" | "compact" | "full";
  icon?: React.ReactNode;
  children?: React.ReactNode;
}

export const PixelButton: React.FC<PixelButtonProps> = ({
  label,
  variant = "default",
  icon,
  children,
  className = "",
  type = "button",
  ...props
}) => {
  const variantClass =
    variant === "compact"
      ? "pixel-btn--compact"
      : variant === "full"
        ? "pixel-btn--full"
        : variant === "primary"
          ? "pixel-btn--primary"
          : "";

  return (
    <button
      type={type}
      className={`pixel-btn ${variantClass} ${className}`.trim()}
      {...props}
    >
      {icon && <span style={{ marginRight: 8, display: "inline-flex" }}>{icon}</span>}
      {label}
      {children}
    </button>
  );
};

export default PixelButton;
