import { describe, it, expect, vi, beforeEach } from "vitest";
import React from "react";
import { render, screen, fireEvent } from "@testing-library/react";
import "@testing-library/jest-dom";
import Index from "../pages/Index";

// Mock ResizeObserver for ReactFlow in JSDOM
class MockResizeObserver {
  observe = vi.fn();
  unobserve = vi.fn();
  disconnect = vi.fn();
}
global.ResizeObserver = MockResizeObserver;

describe("Canvas Themes Feature", () => {
  beforeEach(() => {
    // Clean documentElement classes
    document.documentElement.className = "";
    localStorage.clear();
  });

  it("should apply default theme-ice to document.documentElement on initial mount", () => {
    render(<Index />);

    // Default theme should be theme-ice
    expect(document.documentElement.classList.contains("theme-ice")).toBe(true);
    expect(localStorage.getItem("agent_flow.canvas_theme")).toBe("theme-ice");
  });

  it("should restore theme from localStorage on mount if saved", () => {
    localStorage.setItem("agent_flow.canvas_theme", "theme-blueprint");

    render(<Index />);

    // Restored theme should be theme-blueprint
    expect(document.documentElement.classList.contains("theme-blueprint")).toBe(true);
    expect(document.documentElement.classList.contains("theme-ice")).toBe(false);
  });

  it("should change theme and update document element class and localStorage on selection change", () => {
    render(<Index />);

    // Initially theme-ice
    expect(document.documentElement.classList.contains("theme-ice")).toBe(true);

    const themeSelect = screen.getByTitle("Choose canvas workspace theme");
    expect(themeSelect).toBeInTheDocument();

    // Select Retro Amber
    fireEvent.change(themeSelect, { target: { value: "theme-amber" } });

    // Class list should update
    expect(document.documentElement.classList.contains("theme-amber")).toBe(true);
    expect(document.documentElement.classList.contains("theme-ice")).toBe(false);

    // LocalStorage should update
    expect(localStorage.getItem("agent_flow.canvas_theme")).toBe("theme-amber");

    // Select Blueprint Grid
    fireEvent.change(themeSelect, { target: { value: "theme-blueprint" } });
    expect(document.documentElement.classList.contains("theme-blueprint")).toBe(true);
    expect(document.documentElement.classList.contains("theme-amber")).toBe(false);
    expect(localStorage.getItem("agent_flow.canvas_theme")).toBe("theme-blueprint");
  });
});
