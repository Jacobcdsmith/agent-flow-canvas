export interface StatePreset {
  id: string;
  name: string;
  stateStr: string; // The JSON string representing the state preset
  createdAt: number;
}

const STATE_PRESETS_PREFIX = "agent_flow.state_presets.v1";

/**
 * Loads the list of initial state presets for a given workflow ID.
 * If workflowId is null/empty, defaults to "default".
 *
 * @param workflowId The active workflow ID.
 * @returns An array of StatePreset objects.
 */
export function loadPresets(workflowId: string | null): StatePreset[] {
  const id = workflowId || "default";
  try {
    const raw = localStorage.getItem(`${STATE_PRESETS_PREFIX}.${id}`);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) {
        return parsed;
      }
    }
  } catch (e) {
    console.error("Failed to load state presets:", e);
  }
  return [];
}

/**
 * Saves the list of initial state presets for a given workflow ID to localStorage.
 * If workflowId is null/empty, defaults to "default".
 *
 * @param workflowId The active workflow ID.
 * @param presets The full array of StatePreset objects to persist.
 */
export function savePresets(workflowId: string | null, presets: StatePreset[]): void {
  const id = workflowId || "default";
  try {
    localStorage.setItem(`${STATE_PRESETS_PREFIX}.${id}`, JSON.stringify(presets));
  } catch (e) {
    console.error("Failed to save state presets:", e);
  }
}

/**
 * Generates a unique, descriptive ID for a preset.
 */
export function cryptoId(): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }
  return "preset_" + Math.random().toString(36).slice(2, 10);
}
