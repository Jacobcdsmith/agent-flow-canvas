import { describe, it, expect, vi } from "vitest";
import React from "react";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import "@testing-library/jest-dom";
import { GlobalsManager } from "../flow/GlobalsManager";
import { GlobalVar, SecretVar } from "../flow/globals";

describe("GlobalsManager - Enhanced Features", () => {
  const mockGlobals: GlobalVar[] = [
    { id: "g1", key: "BASE_API", value: "https://api.com" },
    { id: "g2", key: "RETRIES", value: "3" },
  ];

  const mockSecrets: SecretVar[] = [
    { id: "s1", key: "API_JWT", value: "secret-token-value" },
  ];

  it("should filter the list of globals/secrets dynamically in real-time by search query", () => {
    const onGlobalsChange = vi.fn();
    const onSecretsChange = vi.fn();
    const onClose = vi.fn();

    render(
      <GlobalsManager
        globals={mockGlobals}
        secrets={mockSecrets}
        onGlobalsChange={onGlobalsChange}
        onSecretsChange={onSecretsChange}
        onClose={onClose}
      />
    );

    // Initial check: all three variables are visible
    expect(screen.getByText("BASE_API")).toBeInTheDocument();
    expect(screen.getByText("RETRIES")).toBeInTheDocument();
    expect(screen.getByText("API_JWT")).toBeInTheDocument();

    // Search for "RETRIES"
    const searchInput = screen.getByPlaceholderText("Search keys, values...");
    fireEvent.change(searchInput, { target: { value: "RETRIES" } });

    // "RETRIES" is visible, "BASE_API" and "API_JWT" are filtered out
    expect(screen.getByText("RETRIES")).toBeInTheDocument();
    expect(screen.queryByText("BASE_API")).not.toBeInTheDocument();
    expect(screen.queryByText("API_JWT")).not.toBeInTheDocument();

    // Search by type: "secret"
    fireEvent.change(searchInput, { target: { value: "secret" } });
    expect(screen.getByText("API_JWT")).toBeInTheDocument();
    expect(screen.queryByText("BASE_API")).not.toBeInTheDocument();
    expect(screen.queryByText("RETRIES")).not.toBeInTheDocument();
  });

  it("should support Exporting variables to the clipboard", async () => {
    const onGlobalsChange = vi.fn();
    const onSecretsChange = vi.fn();
    const onClose = vi.fn();

    // Mock clipboard API via Object.defineProperty
    const writeTextMock = vi.fn().mockImplementation(() => Promise.resolve());
    Object.defineProperty(navigator, "clipboard", {
      value: {
        writeText: writeTextMock,
      },
      writable: true,
      configurable: true,
    });

    // Mock window.alert
    const originalAlert = window.alert;
    window.alert = vi.fn();

    render(
      <GlobalsManager
        globals={mockGlobals}
        secrets={mockSecrets}
        onGlobalsChange={onGlobalsChange}
        onSecretsChange={onSecretsChange}
        onClose={onClose}
      />
    );

    const exportBtn = screen.getByText("Export");
    fireEvent.click(exportBtn);

    expect(writeTextMock).toHaveBeenCalledTimes(1);
    const exportedData = JSON.parse(writeTextMock.mock.calls[0][0]);
    expect(exportedData.globals).toEqual(mockGlobals);
    expect(exportedData.secrets).toEqual(mockSecrets);

    await waitFor(() => {
      expect(window.alert).toHaveBeenCalledWith("Environment configuration copied to clipboard!");
    });

    window.alert = originalAlert;
  });

  it("should support Merge-Import schema-validated JSON data from clipboards", () => {
    const onGlobalsChange = vi.fn();
    const onSecretsChange = vi.fn();
    const onClose = vi.fn();

    render(
      <GlobalsManager
        globals={mockGlobals}
        secrets={mockSecrets}
        onGlobalsChange={onGlobalsChange}
        onSecretsChange={onSecretsChange}
        onClose={onClose}
      />
    );

    // Mock alert
    const originalAlert = window.alert;
    window.alert = vi.fn();

    // Trigger Import Modal Open
    const importBtn = screen.getByText("Import");
    fireEvent.click(importBtn);

    // Ensure Import modal is open
    expect(screen.getByText("Import Environment Variables")).toBeInTheDocument();

    // Paste formatted JSON
    const testImportJson = JSON.stringify({
      globals: [{ key: "NEW_GLOBAL", value: "new-val" }],
      secrets: [{ key: "API_JWT", value: "updated-token" }],
    });

    const textarea = screen.getByPlaceholderText("Paste JSON content here...");
    fireEvent.change(textarea, { target: { value: testImportJson } });

    // Click Merge-Import
    const mergeBtn = screen.getByText("Merge-Import");
    fireEvent.click(mergeBtn);

    // Globals callback should merge new variable with existing
    expect(onGlobalsChange).toHaveBeenCalledTimes(1);
    const mergedGlobals = onGlobalsChange.mock.calls[0][0];
    expect(mergedGlobals).toHaveLength(3); // MockGlobals.length (2) + 1 new
    expect(mergedGlobals.some((g: GlobalVar) => g.key === "NEW_GLOBAL")).toBe(true);

    // Secrets callback should merge/overwrite updated secret value
    expect(onSecretsChange).toHaveBeenCalledTimes(1);
    const mergedSecrets = onSecretsChange.mock.calls[0][0];
    expect(mergedSecrets).toHaveLength(1); // Merged/overwritten existing JWT
    expect(mergedSecrets[0].value).toBe("updated-token");

    window.alert = originalAlert;
  });

  it("should support Replace-Import schema-validated JSON data completely wiping existing variables", () => {
    const onGlobalsChange = vi.fn();
    const onSecretsChange = vi.fn();
    const onClose = vi.fn();

    render(
      <GlobalsManager
        globals={mockGlobals}
        secrets={mockSecrets}
        onGlobalsChange={onGlobalsChange}
        onSecretsChange={onSecretsChange}
        onClose={onClose}
      />
    );

    // Mock alert
    const originalAlert = window.alert;
    window.alert = vi.fn();

    const importBtn = screen.getByText("Import");
    fireEvent.click(importBtn);

    const testImportJson = JSON.stringify({
      globals: [{ key: "REPLACED_GLOBAL", value: "replaced-val" }],
      secrets: [],
    });

    const textarea = screen.getByPlaceholderText("Paste JSON content here...");
    fireEvent.change(textarea, { target: { value: testImportJson } });

    // Click Replace-Import
    const replaceBtn = screen.getByText("Replace-Import");
    fireEvent.click(replaceBtn);

    // Existing wiped completely, only replaced_global remains
    expect(onGlobalsChange).toHaveBeenCalledWith([{
      id: expect.any(String),
      key: "REPLACED_GLOBAL",
      value: "replaced-val",
    }]);
    expect(onSecretsChange).toHaveBeenCalledWith([]);

    window.alert = originalAlert;
  });

  it("should prompt/alert on error if imported JSON is invalid or poorly shaped", () => {
    const onGlobalsChange = vi.fn();
    const onSecretsChange = vi.fn();
    const onClose = vi.fn();

    render(
      <GlobalsManager
        globals={mockGlobals}
        secrets={mockSecrets}
        onGlobalsChange={onGlobalsChange}
        onSecretsChange={onSecretsChange}
        onClose={onClose}
      />
    );

    const importBtn = screen.getByText("Import");
    fireEvent.click(importBtn);

    // Provide malformed JSON
    const textarea = screen.getByPlaceholderText("Paste JSON content here...");
    fireEvent.change(textarea, { target: { value: "{ malformed: json" } });

    const mergeBtn = screen.getByText("Merge-Import");
    fireEvent.click(mergeBtn);

    // Should render warning on error
    expect(screen.getByText(/⚠ Expected/)).toBeInTheDocument();
    expect(onGlobalsChange).not.toHaveBeenCalled();
    expect(onSecretsChange).not.toHaveBeenCalled();
  });
});
