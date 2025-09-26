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

document.addEventListener("DOMContentLoaded", () => {
  const tabButtons = document.querySelectorAll(".tab");
  tabButtons.forEach((button) => {
    button.addEventListener("click", (event) => {
      const target = event.currentTarget;
      if (target instanceof HTMLElement) {
        const tabName = target.getAttribute("data-tab");
        if (tabName) {
          showTab(tabName, target);
        }
      }
    });
  });
});

export {};
