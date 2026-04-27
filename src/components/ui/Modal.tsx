import { useEffect } from "react";
import Icon from "./Icon";

interface ModalProps {
  open: boolean;
  onClose: () => void;
  title?: string;
  children: React.ReactNode;
  width?: string;
}

export default function Modal({ open, onClose, title, children, width = "max-w-lg" }: ModalProps) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-sm bg-black/60 backdrop-blur-sm animate-fade-in"
      onClick={onClose}
    >
      <div
        className={`relative w-full ${width} bg-surface-container border border-primary/30 rounded-xl shadow-2xl overflow-hidden`}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="leather-noise absolute inset-0" />
        <div className="relative">
          <div className="flex items-center justify-between px-md py-sm border-b border-outline-variant/40">
            <h3 className="font-serif text-title-sm text-primary">{title}</h3>
            <button onClick={onClose} className="btn-icon" aria-label="Close">
              <Icon name="close" />
            </button>
          </div>
          <div className="p-md">{children}</div>
        </div>
      </div>
    </div>
  );
}
