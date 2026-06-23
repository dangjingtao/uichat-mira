import { type WheelEvent, useEffect, useState } from "react";

interface ImagePreviewOverlayProps {
  src: string | null;
  open: boolean;
  onClose: () => void;
  alt?: string;
}

function ImagePreviewOverlay({
  src,
  open,
  onClose,
  alt = "",
}: ImagePreviewOverlayProps) {
  const [scale, setScale] = useState(1);

  useEffect(() => {
    setScale(1);
  }, [src]);

  useEffect(() => {
    if (!open) {
      return;
    }

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        onClose();
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [onClose, open]);

  if (!open || !src) {
    return null;
  }

  const handleWheel = (event: WheelEvent<HTMLDivElement>) => {
    event.preventDefault();
    const direction = event.deltaY < 0 ? 1 : -1;
    setScale((current) =>
      Math.min(4, Math.max(0.6, current + direction * 0.16)),
    );
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/72 p-6 backdrop-blur-sm"
      onClick={onClose}
      onWheel={handleWheel}
      role="dialog"
      aria-modal="true"
    >
      <img
        src={src}
        alt={alt}
        className="max-h-[88vh] max-w-[88vw] select-none rounded-ui-overlay object-contain shadow-[0_24px_70px_rgba(0,0,0,0.35)] transition-transform duration-100 ease-out"
        style={{ transform: `scale(${scale})` }}
        onClick={(event) => event.stopPropagation()}
        draggable={false}
      />
    </div>
  );
}

export default ImagePreviewOverlay;
