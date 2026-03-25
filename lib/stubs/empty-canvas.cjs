/**
 * Stub for the optional Node "canvas" package that pdfjs-dist references.
 * Client bundles use the browser canvas API; this file exists only so
 * webpack/Turbopack can resolve `require("canvas")` during bundling.
 */

const DOMMatrixImpl =
  typeof globalThis !== "undefined" && globalThis.DOMMatrix
    ? globalThis.DOMMatrix
    : class DOMMatrix {
        constructor() {
          /* no-op: DOMMatrix when not in browser */
        }
      };

module.exports = {
  createCanvas(width, height) {
    if (typeof document !== "undefined") {
      const el = document.createElement("canvas");
      el.width = width;
      el.height = height;
      return el;
    }
    return {
      width,
      height,
      getContext: () => null,
    };
  },
  DOMMatrix: DOMMatrixImpl,
};
