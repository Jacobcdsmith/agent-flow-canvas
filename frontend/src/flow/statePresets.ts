export interface StatePreset {
  id: string;
  name: string;
  stateJson: string;
  isDefault?: boolean;
}

const STORAGE_KEY_PREFIX = "agent_flow.state_presets.v1.";

export const DEFAULT_PRESETS: Record<string, StatePreset[]> = {
  "template-react": [
    {
      id: "react-default",
      name: "Standard Search Query",
      stateJson: JSON.stringify({ query: "What is the capital of France?" }, null, 2),
      isDefault: true,
    },
    {
      id: "react-complex",
      name: "Complex Tech Research",
      stateJson: JSON.stringify({ query: "Latest breakthroughs in room-temperature superconductors in 2026" }, null, 2),
      isDefault: true,
    }
  ],
  "template-http-router": [
    {
      id: "http-octocat",
      name: "Popular GitHub User (octocat)",
      stateJson: JSON.stringify({ username: "octocat" }, null, 2),
      isDefault: true,
    },
    {
      id: "http-defunkt",
      name: "Standard GitHub User (defunkt)",
      stateJson: JSON.stringify({ username: "defunkt" }, null, 2),
      isDefault: true,
    },
    {
      id: "http-invalid",
      name: "Non-existent User",
      stateJson: JSON.stringify({ username: "this-user-does-not-exist-12345" }, null, 2),
      isDefault: true,
    }
  ],
  "template-translation-hitl": [
    {
      id: "trans-greeting",
      name: "Short Greeting",
      stateJson: JSON.stringify({ query: "Hello! It is a pleasure to meet you." }, null, 2),
      isDefault: true,
    },
    {
      id: "trans-idiom",
      name: "Idiomatic Expression",
      stateJson: JSON.stringify({ query: "Don't count your chickens before they hatch." }, null, 2),
      isDefault: true,
    }
  ],
  "general": [
    {
      id: "general-hello",
      name: "Hello World Input",
      stateJson: JSON.stringify({ query: "hello world" }, null, 2),
      isDefault: true,
    },
    {
      id: "general-empty",
      name: "Empty Payload",
      stateJson: JSON.stringify({}, null, 2),
      isDefault: true,
    }
  ]
};

export function loadStatePresets(workflowId: string | null): StatePreset[] {
  const defaults = workflowId && DEFAULT_PRESETS[workflowId]
    ? DEFAULT_PRESETS[workflowId]
    : DEFAULT_PRESETS["general"];

  if (!workflowId) {
    return defaults;
  }

  try {
    const raw = localStorage.getItem(`${STORAGE_KEY_PREFIX}${workflowId}`);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) {
        // Merge defaults and saved custom presets
        const custom = parsed.filter(p => !p.isDefault);
        return [...defaults, ...custom];
      }
    }
  } catch (e) {
    console.error("Failed to load state presets:", e);
  }

  return defaults;
}

export function saveStatePresets(workflowId: string | null, presets: StatePreset[]): void {
  if (!workflowId) return;
  try {
    // Only save custom presets to local storage, keeping defaults read-only/embedded
    const customOnly = presets.filter(p => !p.isDefault);
    localStorage.setItem(`${STORAGE_KEY_PREFIX}${workflowId}`, JSON.stringify(customOnly));
  } catch (e) {
    console.error("Failed to save state presets:", e);
  }
}
