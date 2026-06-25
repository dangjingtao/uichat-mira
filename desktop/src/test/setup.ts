import "@testing-library/jest-dom/vitest";

if (typeof DataTransfer === "undefined") {
  class DataTransferPolyfill {
    items = {
      add: (file: File) => {
        (this as unknown as { files: File[] }).files.push(file);
        return null;
      },
    };
    files: File[] = [];
  }
  Object.assign(globalThis, { DataTransfer: DataTransferPolyfill });
}

if (typeof Element !== "undefined" && !Element.prototype.hasPointerCapture) {
  Element.prototype.hasPointerCapture = () => false;
  Element.prototype.setPointerCapture = () => {};
  Element.prototype.releasePointerCapture = () => {};
}

if (typeof Element !== "undefined" && !Element.prototype.scrollIntoView) {
  Element.prototype.scrollIntoView = () => {};
}

if (typeof ResizeObserver === "undefined") {
  class ResizeObserverPolyfill {
    observe() {}
    unobserve() {}
    disconnect() {}
  }
  Object.assign(globalThis, { ResizeObserver: ResizeObserverPolyfill });
}
