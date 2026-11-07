/**
 * PixelInput - Authentic Minecraft Text Input Field
 *
 * Adapted from zardoy/minecraft-web-client (MIT License - Copyright (c) 2020 PrismarineJS / zardoy)
 * Implements authentic black container with grey border highlighting to white on hover/focus.
 */

import React from "react";
import "./pixel.css";

export interface PixelInputProps extends Omit<
  React.InputHTMLAttributes<HTMLInputElement>,
  "width"
> {
  label?: string;
  error?: string;
  width?: number | string;
}

export const PixelInput = React.forwardRef<HTMLInputElement, PixelInputProps>(
  ({ label, error, width = "100%", className = "", style, ...props }, ref) => {
    return (
      <div className="pixel-input-wrapper" style={{ width }}>
        {label && <label className="pixel-input-wrapper__label">{label}</label>}

        <div
          className={`pixel-input-box ${error ? "pixel-input-box--error" : ""}`.trim()}
          style={style}
        >
          <input
            ref={ref}
            autoComplete="off"
            autoCapitalize="off"
            autoCorrect="off"
            spellCheck={false}
            className={`pixel-input ${className}`.trim()}
            {...props}
          />
        </div>

        {error && (
          <span
            style={{
              fontFamily: "var(--mc-font)",
              fontSize: 8,
              color: "var(--mc-red)",
              marginTop: 2,
            }}
          >
            {error}
          </span>
        )}
      </div>
    );
  }
);

PixelInput.displayName = "PixelInput";

export default PixelInput;
