// Copyright © 2025, SAS Institute Inc., Cary, NC, USA.  All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0
import "./TablePropertiesViewer.css";

function showTab(tabName: string, clickedTab?: HTMLElement): void {
  const contents = document.querySelectorAll(".tab-content");
  contents.forEach((content) => content.classList.remove("active"));

  const tabs = document.querySelectorAll(".tab");
  tabs.forEach((tab) => tab.classList.remove("active"));

  const selectedContent = document.getElementById(tabName);
  if (selectedContent) {
    selectedContent.classList.add("active");
  }

  if (clickedTab) {
    clickedTab.classList.add("active");
  }
}

const eventListeners: Array<{
  element: Element;
  handler: EventListener;
}> = [];

function setupEventListeners(): void {
  const tabButtons = document.querySelectorAll(".tab");
  tabButtons.forEach((button) => {
    const handler = (event: Event) => {
      const target = event.currentTarget;
      if (target instanceof HTMLElement) {
        const tabName = target.getAttribute("data-tab");
        if (tabName) {
          showTab(tabName, target);
        }
      }
    };
    button.addEventListener("click", handler);
    eventListeners.push({ element: button, handler });
  });
}

function cleanupEventListeners(): void {
  eventListeners.forEach(({ element, handler }) => {
    element.removeEventListener("click", handler);
  });
  eventListeners.length = 0;
}

document.addEventListener("DOMContentLoaded", setupEventListeners);
window.addEventListener("beforeunload", cleanupEventListeners);

export {};
