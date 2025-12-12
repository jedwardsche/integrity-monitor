import React, { useRef, useEffect } from "react";

interface DataDownloadMenuProps {
  isOpen: boolean;
  onClose: () => void;
  onDownloadCsv: () => void;
  onDownloadJson: () => void;
  isLoading?: boolean;
}

export function DataDownloadMenu({
  isOpen,
  onClose,
  onDownloadCsv,
  onDownloadJson,
  isLoading = false,
}: DataDownloadMenuProps) {
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!isOpen) return;

    const handleClickOutside = (event: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        onClose();
      }
    };

    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        onClose();
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    document.addEventListener("keydown", handleEscape);

    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
      document.removeEventListener("keydown", handleEscape);
    };
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  return (
    <div
      ref={menuRef}
      className="absolute right-0 top-full mt-1 z-50 w-64 rounded-2xl border border-[var(--border)] bg-white shadow-lg"
    >
      <div className="py-2">
        <button
          onClick={() => {
            onDownloadCsv();
            onClose();
          }}
          disabled={isLoading}
          className="w-full px-4 py-2 text-left text-sm text-[var(--text-main)] hover:bg-[var(--bg-mid)]/50 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
        >
          <div className="font-medium">Download Data as CSV</div>
          <div className="text-xs text-[var(--text-muted)] mt-0.5">
            Export records as CSV
          </div>
        </button>
        <button
          onClick={() => {
            onDownloadJson();
            onClose();
          }}
          disabled={isLoading}
          className="w-full px-4 py-2 text-left text-sm text-[var(--text-main)] hover:bg-[var(--bg-mid)]/50 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
        >
          <div className="font-medium">Download Data as JSON</div>
          <div className="text-xs text-[var(--text-muted)] mt-0.5">
            Export records as JSON
          </div>
        </button>
      </div>
    </div>
  );
}
