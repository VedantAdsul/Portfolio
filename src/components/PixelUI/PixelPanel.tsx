/**
 * PixelPanel & PixelScreen - Authentic Minecraft Java Edition Menu & Screen Containers
 *
 * Adapted from zardoy/minecraft-web-client (MIT License - Copyright (c) 2020 PrismarineJS / zardoy)
 * Retains authentic beveled panel borders, dark overlays, and centered layout hierarchies.
 */

import React from "react";
import "./pixel.css";

export interface PixelPanelProps extends Omit<
  React.HTMLAttributes<HTMLDivElement>,
  "title"
> {
  title?: React.ReactNode;
  subtitle?: React.ReactNode;
  variant?: "default" | "dirt";
  maxWidth?: number | string;
  footer?: React.ReactNode;
  children: React.ReactNode;
}

export const PixelPanel: React.FC<PixelPanelProps> = ({
  title,
  subtitle,
  variant = "default",
  maxWidth = 520,
  footer,
  children,
  className = "",
  style,
  ...props
}) => {
  const panelVariant = variant === "dirt" ? "pixel-panel--dirt" : "";

  return (
    <div
      className={`pixel-panel ${panelVariant} ${className}`.trim()}
      style={{ maxWidth, ...style }}
      {...props}
    >
      {(title || subtitle) && (
        <header className="pixel-panel__header">
          {title && <h2 className="pixel-panel__title">{title}</h2>}
          {subtitle && <p className="pixel-panel__subtitle">{subtitle}</p>}
        </header>
      )}

      <div className="pixel-panel__content">{children}</div>

      {footer && (
        <footer
          style={{
            marginTop: 20,
            display: "flex",
            justifyContent: "center",
            gap: 12,
          }}
        >
          {footer}
        </footer>
      )}
    </div>
  );
};

export interface PixelScreenProps extends PixelPanelProps {
  isOpen?: boolean;
  onClose?: () => void;
}

export const PixelScreen: React.FC<PixelScreenProps> = ({
  isOpen = true,
  onClose,
  children,
  ...panelProps
}) => {
  if (!isOpen) return null;

  return (
    <div
      className="pixel-backdrop"
      onClick={(e) => {
        if (e.target === e.currentTarget && onClose) {
          onClose();
        }
      }}
    >
      <PixelPanel {...panelProps}>{children}</PixelPanel>
    </div>
  );
};

export default PixelPanel;
