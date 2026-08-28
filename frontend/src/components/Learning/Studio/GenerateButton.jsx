import React from "react";
import { CircleNotch, Sparkle } from "@phosphor-icons/react";
import "./GenerateButton.css";

export default function GenerateButton({
  loading = false,
  disabled = false,
  onClick,
  children,
}) {
  return (
    <button
      type="button"
      disabled={disabled || loading}
      onClick={onClick}
      className={`learn-gen-btn w-full flex items-center justify-center gap-2 px-3 py-2.5 text-xs font-semibold text-white bg-theme-button-primary rounded-xl transition-opacity duration-500 ease-out ${
        loading ? "is-busy" : ""
      }`}
    >
      <span className="learn-gen-btn__sheen" aria-hidden />
      {loading ? (
        <CircleNotch className="w-3.5 h-3.5 animate-spin relative z-[1]" />
      ) : (
        <span className="learn-gen-star" aria-hidden>
          <Sparkle className="w-3.5 h-3.5" weight="fill" />
        </span>
      )}
      <span className="relative z-[1]">{loading ? "生成中…" : children}</span>
    </button>
  );
}
