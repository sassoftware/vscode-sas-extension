/* global globalThis */
/* eslint-disable @typescript-eslint/no-require-imports */

// Ignore CSS imports during React tests.
require("ignore-styles");

const { JSDOM } = require("jsdom");

const dom = new JSDOM("<!doctype html><html><body></body></html>", {
  url: "http://localhost/",
});

globalThis.window = dom.window;
globalThis.document = dom.window.document;

Object.defineProperty(globalThis, "navigator", {
  configurable: true,
  value: dom.window.navigator,
});

// Expose browser APIs needed by React components and hooks.
for (const name of [
  "HTMLElement",
  "HTMLDialogElement",
  "Element",
  "Node",
  "Event",
  "MouseEvent",
  "MessageEvent",
  "DOMRect",
  "MutationObserver",
]) {
  globalThis[name] = dom.window[name];
}

if (!dom.window.PointerEvent) {
  class PointerEvent extends dom.window.MouseEvent {
    constructor(type, options = {}) {
      super(type, options);
      this.pointerId = options.pointerId ?? 0;
      this.pointerType = options.pointerType ?? "mouse";
      this.isPrimary = options.isPrimary ?? true;
    }
  }

  globalThis.PointerEvent = PointerEvent;
  dom.window.PointerEvent = PointerEvent;
} else {
  globalThis.PointerEvent = dom.window.PointerEvent;
}

globalThis.IS_REACT_ACT_ENVIRONMENT = true;

// jsdom does not fully implement HTML dialog methods.
HTMLDialogElement.prototype.showModal = function () {
  this.setAttribute("open", "");
};

HTMLDialogElement.prototype.close = function () {
  this.removeAttribute("open");
};
