import { useTranslation } from "react-i18next";
import { Hash } from "@phosphor-icons/react";

export default function VectorDBIdentifier({ workspace }) {
  const { t } = useTranslation();
  const slug = workspace?.slug || "—";

  return (
    <div
      className={[
        "group flex-1 min-w-[140px] max-w-[280px]",
        "rounded-xl border border-white/[0.07] light:border-theme-modal-border",
        "bg-gradient-to-b from-white/[0.04] to-transparent light:from-black/[0.02]",
        "px-3.5 py-3",
        "transition-colors duration-150",
        "hover:border-white/[0.12] light:hover:border-theme-modal-border",
      ].join(" ")}
    >
      <div className="flex items-center gap-1.5 mb-2">
        <Hash
          size={12}
          weight="bold"
          className="text-white/30 light:text-theme-text-secondary shrink-0"
        />
        <span className="text-[11px] font-medium tracking-wide text-white/40 light:text-theme-text-secondary uppercase">
          {t("vector-workspace.identifier")}
        </span>
      </div>
      <p
        className="m-0 text-[15px] font-semibold font-mono tracking-tight text-white/90 light:text-theme-text-primary truncate"
        title={slug}
      >
        {slug}
      </p>
    </div>
  );
}
