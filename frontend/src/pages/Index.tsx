import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import ReactFlow, {
  Background,
  BackgroundVariant,
  Controls,
  Edge,
  MiniMap,
  Node,
  NodeChange,
  EdgeChange,
  addEdge,
  applyEdgeChanges,
  applyNodeChanges,
  Connection,
  MarkerType,
  ReactFlowProvider,
  useReactFlow,
} from "reactflow";
import "reactflow/dist/style.css";
import { toast } from "sonner";

import { AgentNode } from "@/flow/AgentNode";
import { Palette } from "@/flow/Palette";
import { Inspector } from "@/flow/Inspector";
import { AgentNodeData, EDGE_LABELS, NodeTypeMeta } from "@/flow/types";
import { exampleEdges, exampleNodes } from "@/flow/exampleWorkflow";
import { generateCode, lintPython } from "@/flow/codegen";
import { validateGraph, ValidationIssue } from "@/flow/validate";
import { useIsMobile } from "@/hooks/use-mobile";
import {
  Gateway,
  clearAllKeys as clearAllGatewayKeys,
  hasGatewayErrors,
  loadGateways,
  saveGateways,
  validateGateway,
} from "@/flow/gateways";
import { GatewayManager } from "@/flow/GatewayManager";
import { runFlow, RunLog } from "@/flow/runFlow";
import { IntroTutorial } from "@/flow/IntroTutorial";
import { SampleWalkthrough } from "@/flow/SampleWalkthrough";

const nodeTypes = { agent: AgentNode };

let idCounter = 100;
const nextId = () => `n${++idCounter}`;

function Canvas() {
  const rf = useReactFlow();
  const isMobile = useIsMobile();

  const [nodes, setNodes] = useState<Node<AgentNodeData>[]>(exampleNodes);
  const [edges, setEdges] = useState<Edge[]>(exampleEdges);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [selectedEdgeId, setSelectedEdgeId] = useState<string | null>(null);
  const [showCode, setShowCode] = useState(false);
  const [codeLang, setCodeLang] = useState<"python" | "javascript">("python");
  const [mobilePanel, setMobilePanel] = useState<"none" | "palette" | "inspector">("none");
  const [issues, setIssues] = useState<ValidationIssue[]>([]);
  const [validated, setValidated] = useState(false);
  const addOffsetRef = useRef(0);

  // ---- Run state ----
  const [runLogs, setRunLogs] = useState<RunLog[] | null>(null);
  const [running, setRunning] = useState(false);
  const [showRun, setShowRun] = useState(false);
  const [initialStateStr, setInitialStateStr] = useState(() => {
    return JSON.stringify({ query: "hello world" }, null, 2);
  });
  const [initialStateError, setInitialStateError] = useState<string | null>(null);
  const [visualSpeed, setVisualSpeed] = useState<"fast" | "visualized">("visualized");
  const [pendingApproval, setPendingApproval] = useState<{
    nodeId: string;
    name: string;
    prompt: string;
    channel: string;
    resolve: (value: string) => void;
  } | null>(null);
  const [feedbackText, setFeedbackText] = useState("");

  useEffect(() => {
    try {
      if (initialStateStr.trim()) {
        const parsed = JSON.parse(initialStateStr);
        if (typeof parsed !== "object" || parsed === null || Array.isArray(parsed)) {
          setInitialStateError("Initial state must be a JSON object");
        } else {
          setInitialStateError(null);
        }
      } else {
        setInitialStateError(null);
      }
    } catch (e) {
      setInitialStateError(e instanceof Error ? e.message : "Invalid JSON");
    }
  }, [initialStateStr]);

  // ---- Gateways library + intro/tutorial ----
  const [gateways, setGateways] = useState<Gateway[]>(() => loadGateways());
  useEffect(() => {
    saveGateways(gateways);
  }, [gateways]);
  const [showGateway, setShowGateway] = useState(false);
  const [showSample, setShowSample] = useState(false);
  const [highlight, setHighlight] = useState<{
    nodeIds: Set<string>;
    edgeIds: Set<string>;
    color: string;
  } | null>(null);

  const gatewayIssues = useMemo(() => {
    if (gateways.length === 0) return ["no gateway configured"];
    return gateways.flatMap((g) => {
      const errs = validateGateway(g);
      return hasGatewayErrors(errs)
        ? [`${g.name}: ${Object.values(errs).join(" · ")}`]
        : [];
    });
  }, [gateways]);
  const gatewayInvalid = gatewayIssues.length > 0;

  const [showIntro, setShowIntro] = useState(() => {
    try {
      return localStorage.getItem("agent_flow.intro_seen") !== "1";
    } catch {
      return true;
    }
  });
  const dismissIntro = useCallback(() => {
    setShowIntro(false);
    try {
      localStorage.setItem("agent_flow.intro_seen", "1");
    } catch {}
  }, []);

  // ---- undo stack ----
  const undoStack = useRef<{ nodes: Node<AgentNodeData>[]; edges: Edge[] }[]>([]);
  const skipSnapshot = useRef(false);
  const snapshot = useCallback(() => {
    undoStack.current.push({
      nodes: JSON.parse(JSON.stringify(nodes)),
      edges: JSON.parse(JSON.stringify(edges)),
    });
    if (undoStack.current.length > 20) undoStack.current.shift();
  }, [nodes, edges]);

  const undo = useCallback(() => {
    const prev = undoStack.current.pop();
    if (!prev) {
      toast("Nothing to undo");
      return;
    }
    skipSnapshot.current = true;
    setNodes(prev.nodes);
    setEdges(prev.edges);
    toast("Undo");
  }, []);

  // augment nodes with issue info for rendering
  const issueByNode = useMemo(() => {
    const m = new Map<string, string>();
    issues.forEach((i) => {
      if (i.nodeId) {
        m.set(i.nodeId, (m.get(i.nodeId) ? m.get(i.nodeId) + " · " : "") + i.message);
      }
    });
    return m;
  }, [issues]);

  const renderedNodes = useMemo(
    () =>
      nodes.map((n) => ({
        ...n,
        data: {
          ...n.data,
          hasIssue: validated && issueByNode.has(n.id),
          issueText: issueByNode.get(n.id),
        },
        style: highlight
          ? highlight.nodeIds.has(n.id)
            ? {
                outline: `2px solid ${highlight.color}`,
                outlineOffset: 4,
                borderRadius: 2,
                transition: "outline 150ms ease",
              }
            : { opacity: 0.35, transition: "opacity 150ms ease" }
          : undefined,
      })),
    [nodes, issueByNode, validated, highlight],
  );

  const renderedEdges = useMemo(
    () =>
      edges.map((e) => {
        const isSel = e.id === selectedEdgeId;
        const isHi = highlight?.edgeIds.has(e.id);
        const dim = highlight && !isHi;
        return {
          ...e,
          type: "smoothstep" as const,
          markerEnd: {
            type: MarkerType.ArrowClosed,
            color: isHi
              ? highlight!.color
              : isSel
                ? "hsl(var(--edge-selected))"
                : "hsl(var(--ink-soft))",
          },
          style: {
            stroke: isHi
              ? highlight!.color
              : isSel
                ? "hsl(var(--edge-selected))"
                : "hsl(var(--ink-soft))",
            strokeWidth: isHi ? 2.5 : isSel ? 2 : 1,
            strokeDasharray: isHi ? "0" : isSel ? "6 3" : "3 3",
            opacity: dim ? 0.2 : isSel || isHi ? 1 : 0.7,
          },
          labelStyle: {
            fontFamily: "ui-monospace, monospace",
            fontSize: 9,
            fontWeight: 600,
            letterSpacing: "0.1em",
            textTransform: "uppercase" as const,
            fill: isHi
              ? highlight!.color
              : isSel
                ? "hsl(var(--edge-selected))"
                : "hsl(var(--ink-soft))",
          },
          labelBgStyle: {
            fill: "hsl(var(--paper))",
            stroke: isHi
              ? highlight!.color
              : isSel
                ? "hsl(var(--edge-selected))"
                : "hsl(var(--ink-faint))",
            strokeWidth: 0.5,
          },
          labelBgPadding: [6, 3] as [number, number],
          labelBgBorderRadius: 0,
          label: String(e.label ?? "next"),
        };
      }),
    [edges, selectedEdgeId, highlight],
  );

  const onNodesChange = useCallback(
    (changes: NodeChange[]) => setNodes((ns) => applyNodeChanges(changes, ns)),
    [],
  );
  const onEdgesChange = useCallback(
    (changes: EdgeChange[]) => setEdges((es) => applyEdgeChanges(changes, es)),
    [],
  );
  const onConnect = useCallback(
    (c: Connection) => {
      snapshot();
      setEdges((es) => addEdge({ ...c, label: "next", type: "smoothstep" }, es));
      toast("Edge added");
    },
    [snapshot],
  );

  const addNode = useCallback(
    (meta: NodeTypeMeta) => {
      snapshot();
      const id = nextId();
      const off = addOffsetRef.current;
      addOffsetRef.current = (off + 1) % 8;
      // place near viewport center
      const center =
        typeof rf.screenToFlowPosition === "function"
          ? rf.screenToFlowPosition({
              x: window.innerWidth / 2,
              y: window.innerHeight / 2,
            })
          : { x: 400, y: 300 };
      const newNode: Node<AgentNodeData> = {
        id,
        type: "agent",
        position: { x: center.x - 120 + off * 30, y: center.y - 50 + off * 30 },
        data: {
          kind: meta.kind,
          name: meta.defaultName,
          config: Object.fromEntries(meta.configFields.map((f) => [f.key, ""])),
          isEntry: meta.isEntry,
          isTerminal: meta.isTerminal,
        },
      };
      setNodes((ns) => [...ns, newNode]);
      setSelectedId(id);
      setSelectedEdgeId(null);
      toast(`${meta.label} added`);
    },
    [rf, snapshot],
  );

  const updateNode = useCallback(
    (id: string, patch: Partial<AgentNodeData>) => {
      snapshot();
      setNodes((ns) =>
        ns.map((n) => (n.id === id ? { ...n, data: { ...n.data, ...patch } } : n)),
      );
    },
    [snapshot],
  );

  const deleteNode = useCallback(
    (id: string) => {
      snapshot();
      setNodes((ns) => ns.filter((n) => n.id !== id));
      setEdges((es) => es.filter((e) => e.source !== id && e.target !== id));
      setSelectedId(null);
      toast("Node deleted");
    },
    [snapshot],
  );

  const deleteEdge = useCallback(
    (id: string) => {
      snapshot();
      setEdges((es) => es.filter((e) => e.id !== id));
      setSelectedEdgeId(null);
      toast("Edge deleted");
    },
    [snapshot],
  );

  const cycleEdgeLabel = useCallback(
    (edgeId: string) => {
      snapshot();
      setEdges((es) =>
        es.map((e) => {
          if (e.id !== edgeId) return e;
          const idx = EDGE_LABELS.indexOf((e.label as any) ?? "next");
          const next = EDGE_LABELS[(idx + 1) % EDGE_LABELS.length];
          return { ...e, label: next };
        }),
      );
    },
    [snapshot],
  );

  // keyboard shortcuts
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement)?.tagName;
      if (tag === "INPUT" || tag === "TEXTAREA") return;
      if (e.key === "Escape") {
        setSelectedId(null);
        setSelectedEdgeId(null);
      } else if (e.key === "Delete" || e.key === "Backspace") {
        if (selectedId) deleteNode(selectedId);
        else if (selectedEdgeId) deleteEdge(selectedEdgeId);
      } else if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "z") {
        e.preventDefault();
        undo();
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [selectedId, selectedEdgeId, deleteNode, deleteEdge, undo]);

  const selected = useMemo(
    () => nodes.find((n) => n.id === selectedId) ?? null,
    [nodes, selectedId],
  );
  const selectedEdge = useMemo(
    () => edges.find((e) => e.id === selectedEdgeId) ?? null,
    [edges, selectedEdgeId],
  );

  const generated = useMemo(
    () => generateCode(codeLang, nodes, edges),
    [nodes, edges, codeLang],
  );
  const pseudocode = generated.code;
  const codeLintIssues = useMemo(
    () => (codeLang === "python" ? lintPython(generated.code) : []),
    [codeLang, generated.code],
  );

  // export / import
  const exportJSON = useCallback(() => {
    const data = JSON.stringify(
      {
        nodes: nodes.map((n) => ({
          id: n.id,
          position: n.position,
          data: n.data,
        })),
        edges: edges.map((e) => ({
          id: e.id,
          source: e.source,
          target: e.target,
          label: e.label,
        })),
      },
      null,
      2,
    );
    navigator.clipboard.writeText(data).then(() => toast("Graph copied to clipboard"));
  }, [nodes, edges]);

  const importJSON = useCallback(async () => {
    try {
      const text = await navigator.clipboard.readText();
      const parsed = JSON.parse(text);
      if (!parsed.nodes || !parsed.edges) throw new Error("invalid shape");
      snapshot();
      setNodes(
        parsed.nodes.map((n: any) => ({
          id: n.id,
          type: "agent",
          position: n.position ?? { x: 0, y: 0 },
          data: n.data,
        })),
      );
      setEdges(
        parsed.edges.map((e: any) => ({
          id: e.id,
          source: e.source,
          target: e.target,
          label: e.label ?? "next",
          type: "smoothstep",
        })),
      );
      toast("Graph imported");
    } catch (err) {
      toast.error("Invalid JSON in clipboard");
    }
  }, [snapshot]);

  const fileInputRef = useRef<HTMLInputElement>(null);

  /**
   * Package and download the current workflow's nodes and edges
   * as a serialized JSON file on the local file system.
   */
  const downloadJSON = useCallback(() => {
    const data = JSON.stringify(
      {
        nodes: nodes.map((n) => ({
          id: n.id,
          position: n.position,
          data: n.data,
        })),
        edges: edges.map((e) => ({
          id: e.id,
          source: e.source,
          target: e.target,
          label: e.label,
        })),
      },
      null,
      2,
    );
    const blob = new Blob([data], { type: "application/json;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "agent_flow_workflow.json";
    a.click();
    URL.revokeObjectURL(url);
    toast("Workflow downloaded");
  }, [nodes, edges]);

  /**
   * Handle the local workspace JSON file upload event, parsing the contents
   * and updating the current workflow's nodes and edges on success.
   *
   * @param e The change event from the hidden HTML file input element.
   */
  const handleFileUpload = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const text = event.target?.result;
        if (typeof text !== "string") return;
        const parsed = JSON.parse(text);
        if (!parsed.nodes || !parsed.edges) throw new Error("invalid shape");
        snapshot();
        setNodes(
          parsed.nodes.map((n: any) => ({
            id: n.id,
            type: "agent",
            position: n.position ?? { x: 0, y: 0 },
            data: n.data,
          })),
        );
        setEdges(
          parsed.edges.map((e: any) => ({
            id: e.id,
            source: e.source,
            target: e.target,
            label: e.label ?? "next",
            type: "smoothstep",
          })),
        );
        toast.success("Workflow file imported");
      } catch (err) {
        toast.error("Invalid JSON workflow file");
      }
      e.target.value = "";
    };
    reader.readAsText(file);
  }, [snapshot]);

  const runValidate = useCallback(() => {
    const found = validateGraph(nodes, edges);
    const py = generateCode("python", nodes, edges);
    const lint = lintPython(py.code).map((m) => ({ kind: "orphan" as const, message: `python: ${m}` }));
    const genErrs = py.errors.map((m) => ({ kind: "orphan" as const, message: `codegen: ${m}` }));
    const all = [...found, ...lint, ...genErrs];
    setIssues(all);
    setValidated(true);
    if (all.length === 0) toast.success("Graph & generated Python valid");
    else toast.error(`${all.length} issue${all.length > 1 ? "s" : ""} found`);
  }, [nodes, edges]);

  const runFlowAction = useCallback(async () => {
    if (gatewayInvalid) {
      const first = gatewayIssues[0];
      toast.error(`Gateway invalid — ${first}`);
      setShowGateway(true);
      return;
    }

    if (pendingApproval) {
      pendingApproval.resolve("aborted");
      setPendingApproval(null);
    }
    setFeedbackText("");

    let parsedState = { query: "hello world" };
    if (initialStateStr.trim()) {
      try {
        const parsed = JSON.parse(initialStateStr);
        if (typeof parsed === "object" && parsed !== null && !Array.isArray(parsed)) {
          parsedState = parsed;
        } else {
          toast.error("Initial state must be a JSON object. Using fallback.");
        }
      } catch (e) {
        toast.error("Invalid JSON in Initial State. Using fallback.");
      }
    }

    setRunning(true);
    setShowRun(true);
    setRunLogs([]);
    const stepDelay = visualSpeed === "visualized" ? 600 : 0;
    try {
      const logs = await runFlow({
        nodes,
        edges,
        gateways,
        initialState: parsedState,
        stepDelay,
        onLog: (log) => {
          setRunLogs((prev) => [...(prev ?? []), log]);
          if (log.nodeId && log.nodeId !== "_error" && log.nodeId !== "_runtime") {
            setHighlight({
              nodeIds: new Set([log.nodeId]),
              edgeIds: new Set(),
              color: log.error ? "hsl(var(--issue))" : "hsl(var(--node-llm))",
            });
          }
        },
        onHumanApproval: ({ nodeId, name, prompt, channel }) => {
          return new Promise<string>((resolve) => {
            setPendingApproval({
              nodeId,
              name,
              prompt,
              channel,
              resolve,
            });
          });
        },
      });
      setRunLogs(logs);
      const errored = logs.some((l) => l.error);
      if (errored) toast.error(`Flow ran with errors (${logs.length} steps)`);
      else toast.success(`Flow ran in ${logs.length} steps`);
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      toast.error(`Run failed: ${msg}`);
      setRunLogs([
        {
          step: 0,
          nodeId: "_error",
          name: "runtime",
          kind: "runtime",
          label: "fatal",
          error: msg,
          ms: 0,
        },
      ]);
    } finally {
      setRunning(false);
      setPendingApproval(null);
      setFeedbackText("");
      setTimeout(() => {
        setHighlight(null);
      }, 1500);
    }
  }, [nodes, edges, gateways, gatewayInvalid, gatewayIssues, visualSpeed, initialStateStr, pendingApproval]);

  const loadSampleGraph = useCallback((ns: Node<AgentNodeData>[], es: Edge[]) => {
    snapshot();
    setNodes(ns);
    setEdges(es);
    setIssues([]);
    setValidated(false);
    setSelectedEdgeId(null);
  }, [snapshot]);

  return (
    <div
      className="h-screen w-screen flex flex-col text-[hsl(var(--ink))] overflow-hidden"
      style={{ background: "var(--gradient-paper)" }}
    >
      <header
        className="h-12 shrink-0 flex items-center justify-between px-3 sm:px-4 border-b border-dashed border-[hsl(var(--grid-line))] backdrop-blur-sm"
        style={{ background: "var(--gradient-header)" }}
      >
        <div className="flex items-center gap-3">
          <div
            className="w-5 h-5 border-2 border-[hsl(var(--ink))] relative shrink-0"
            style={{ background: "var(--gradient-accent)" }}
          />
          <h1 className="font-mono text-[13px] font-semibold tracking-tight">
            agent_flow<span className="text-[hsl(var(--ink-faint))]">.canvas</span>
          </h1>
          <span className="hidden sm:inline font-mono text-[10px] uppercase tracking-[0.2em] text-[hsl(var(--ink-faint))] ml-2">
            wireframe · v0.3
          </span>
        </div>
        <div className="flex items-center gap-1.5 sm:gap-2">
          <span className="hidden md:inline font-mono text-[10px] text-[hsl(var(--ink-faint))]">
            {nodes.length} nodes · {edges.length} edges
          </span>
          <button
            onClick={runValidate}
            className="font-mono text-[10px] sm:text-[11px] px-2 sm:px-3 py-1 border border-dashed border-[hsl(var(--ink))] hover:bg-[hsl(var(--ink))] hover:text-[hsl(var(--paper))] transition-colors"
          >
            validate
          </button>
          <button
            onClick={() => setShowGateway(true)}
            title={
              gatewayInvalid
                ? `Gateways need attention: ${gatewayIssues.join(" · ")}`
                : `${gateways.length} gateway${gateways.length === 1 ? "" : "s"} configured (BYO key, browser-only)`
            }
            className={`font-mono text-[10px] sm:text-[11px] px-2 sm:px-3 py-1 border border-dashed transition-colors ${
              gatewayInvalid
                ? "border-[hsl(var(--issue))] text-[hsl(var(--issue))] hover:bg-[hsl(var(--issue))] hover:text-[hsl(var(--paper))]"
                : "border-[hsl(var(--ink))] hover:bg-[hsl(var(--ink))] hover:text-[hsl(var(--paper))]"
            }`}
          >
            <span className="hidden sm:inline">⚙ gateways{gatewayInvalid ? " ⚠" : ` · ${gateways.length}`}</span>
            <span className="sm:hidden">⚙{gatewayInvalid ? "⚠" : ""}</span>
          </button>
          <button
            onClick={() => setShowSample(true)}
            title="Load the sample ReAct workflow and walk through tool, memory, and fallback nodes"
            className="font-mono text-[10px] sm:text-[11px] px-2 sm:px-3 py-1 border border-dashed border-[hsl(var(--ink))] hover:bg-[hsl(var(--ink))] hover:text-[hsl(var(--paper))] transition-colors"
          >
            <span className="hidden sm:inline">▤ sample</span>
            <span className="sm:hidden">▤</span>
          </button>
          <button
            onClick={() => setShowIntro(true)}
            title="Open tutorial"
            className="font-mono text-[10px] sm:text-[11px] px-2 sm:px-3 py-1 border border-dashed border-[hsl(var(--ink))] hover:bg-[hsl(var(--ink))] hover:text-[hsl(var(--paper))] transition-colors"
          >
            ?
          </button>
          <button
            onClick={runFlowAction}
            disabled={running || gatewayInvalid}
            title={
              gatewayInvalid
                ? `Cannot run — fix gateways: ${gatewayIssues.join(" · ")}`
                : "Execute flow in your browser — LLM nodes call your configured providers directly"
            }
            className="font-mono text-[10px] sm:text-[11px] px-2 sm:px-3 py-1 border border-dashed text-[hsl(var(--paper))] disabled:opacity-40 disabled:cursor-not-allowed"
            style={{ background: "var(--gradient-accent)", borderColor: "hsl(var(--accent-deep))" }}
          >
            {running ? "running…" : "▶ run"}
          </button>
          <input
            type="file"
            ref={fileInputRef}
            onChange={handleFileUpload}
            accept=".json"
            className="hidden"
          />
          <button
            onClick={exportJSON}
            title="Copy workflow configuration JSON to clipboard"
            className="hidden lg:inline-flex font-mono text-[11px] px-2.5 py-1 border border-dashed border-[hsl(var(--ink))] hover:bg-[hsl(var(--ink))] hover:text-[hsl(var(--paper))] transition-colors"
          >
            copy json
          </button>
          <button
            onClick={downloadJSON}
            title="Download workflow configuration as a .json file"
            className="hidden sm:inline-flex font-mono text-[11px] px-2.5 py-1 border border-dashed border-[hsl(var(--ink))] hover:bg-[hsl(var(--ink))] hover:text-[hsl(var(--paper))] transition-colors"
          >
            download file
          </button>
          <button
            onClick={importJSON}
            title="Paste workflow configuration JSON from clipboard"
            className="hidden lg:inline-flex font-mono text-[11px] px-2.5 py-1 border border-dashed border-[hsl(var(--ink))] hover:bg-[hsl(var(--ink))] hover:text-[hsl(var(--paper))] transition-colors"
          >
            paste json
          </button>
          <button
            onClick={() => fileInputRef.current?.click()}
            title="Upload workflow configuration from a .json file"
            className="hidden sm:inline-flex font-mono text-[11px] px-2.5 py-1 border border-dashed border-[hsl(var(--ink))] hover:bg-[hsl(var(--ink))] hover:text-[hsl(var(--paper))] transition-colors"
          >
            upload file
          </button>
          <button
            onClick={() => setShowCode((v) => !v)}
            className="font-mono text-[10px] sm:text-[11px] px-2 sm:px-3 py-1 border border-dashed text-[hsl(var(--paper))] transition-colors"
            style={{ background: "var(--gradient-accent)", borderColor: "hsl(var(--accent-deep))" }}
          >
            {showCode ? "hide code" : "view code"}
          </button>
        </div>
      </header>

      {validated && issues.length > 0 && (
        <div
          className="shrink-0 px-4 py-1.5 font-mono text-[10px] flex items-center gap-3 border-b border-dashed"
          style={{ background: "hsl(var(--issue) / 0.08)", borderColor: "hsl(var(--issue))", color: "hsl(var(--issue))" }}
        >
          <span className="uppercase tracking-[0.2em] font-semibold">{issues.length} issue{issues.length > 1 ? "s" : ""}</span>
          <span className="truncate">{issues.map((i) => i.message).join("  ·  ")}</span>
          <button
            onClick={() => { setIssues([]); setValidated(false); }}
            className="ml-auto uppercase tracking-wider hover:underline"
          >
            dismiss
          </button>
        </div>
      )}

      <div className="flex-1 flex min-h-0">
        {!isMobile && <Palette onAdd={addNode} />}

        <main className="flex-1 relative min-w-0">
          <ReactFlow
            nodes={renderedNodes}
            edges={renderedEdges}
            onNodesChange={onNodesChange}
            onEdgesChange={onEdgesChange}
            onConnect={onConnect}
            onNodeClick={(_, n) => {
              setSelectedId(n.id);
              setSelectedEdgeId(null);
              if (isMobile) setMobilePanel("inspector");
            }}
            onPaneClick={() => {
              setSelectedId(null);
              setSelectedEdgeId(null);
            }}
            onEdgeClick={(_, e) => {
              setSelectedEdgeId(e.id);
              setSelectedId(null);
            }}
            nodeTypes={nodeTypes}
            fitView
            proOptions={{ hideAttribution: true }}
            style={{ background: "transparent" }}
          >
            <Background
              variant={BackgroundVariant.Dots}
              gap={20}
              size={1}
              color="hsl(var(--grid-line))"
            />
            <Controls
              showInteractive={false}
              className="!bg-[hsl(var(--paper))] !border !border-dashed !border-[hsl(var(--grid-line))] !shadow-none"
            />
            {!isMobile && (
              <MiniMap
                pannable
                zoomable
                maskColor="hsl(var(--paper) / 0.7)"
                nodeColor={() => "hsl(var(--ink))"}
                className="!bg-[hsl(var(--paper))] !border !border-dashed !border-[hsl(var(--grid-line))]"
              />
            )}
          </ReactFlow>

          {!isMobile && (
            <div className="absolute top-3 left-3 font-mono text-[10px] text-[hsl(var(--ink-faint))] uppercase tracking-[0.2em] pointer-events-none">
              click edge → select · drag handles → connect · del / esc / ⌘z
            </div>
          )}

          {isMobile && (
            <div className="absolute bottom-3 left-1/2 -translate-x-1/2 flex gap-2 z-10">
              <button
                onClick={() => setMobilePanel("palette")}
                className="font-mono text-[11px] px-3 py-2 border border-dashed border-[hsl(var(--ink))] text-[hsl(var(--paper))]"
                style={{ background: "var(--gradient-accent)" }}
              >
                + node
              </button>
              {selected && (
                <button
                  onClick={() => setMobilePanel("inspector")}
                  className="font-mono text-[11px] px-3 py-2 border border-dashed border-[hsl(var(--ink))] bg-[hsl(var(--paper))]"
                >
                  inspect
                </button>
              )}
            </div>
          )}

          {selectedEdge && (
            <div className="absolute top-3 right-3 flex items-center gap-1 bg-[hsl(var(--paper))] border border-dashed border-[hsl(var(--edge-selected))] p-1 z-10">
              <button
                onClick={() => cycleEdgeLabel(selectedEdge.id)}
                className="font-mono text-[10px] uppercase tracking-[0.15em] px-2 py-1 hover:bg-[hsl(var(--edge-selected))] hover:text-[hsl(var(--paper))]"
                style={{ color: "hsl(var(--edge-selected))" }}
              >
                {String(selectedEdge.label ?? "next")} ↻
              </button>
              <button
                onClick={() => deleteEdge(selectedEdge.id)}
                className="font-mono text-[11px] px-2 py-1 hover:bg-[hsl(var(--issue))] hover:text-[hsl(var(--paper))]"
                style={{ color: "hsl(var(--issue))" }}
              >
                ×
              </button>
            </div>
          )}
        </main>

        {!isMobile && (
        <aside className="w-[300px] shrink-0 border-l border-dashed border-[hsl(var(--grid-line))] bg-[hsl(var(--paper))] flex flex-col relative">
          <div className="px-4 py-3 border-b border-dashed border-[hsl(var(--grid-line))]">
            <div className="font-mono text-[10px] uppercase tracking-[0.2em] text-[hsl(var(--ink-faint))]">
              inspector
            </div>
            <h2 className="font-mono text-sm font-semibold text-[hsl(var(--ink))] mt-0.5">
              {selected ? selected.data.name : "no selection"}
            </h2>
          </div>
          <div className="flex-1 overflow-y-auto">
            <Inspector
              node={selected}
              edges={edges}
              nodes={nodes}
              gateways={gateways}
              onChange={updateNode}
              onDelete={deleteNode}
            />
          </div>

          {showCode && (
            <div className="absolute inset-0 bg-[hsl(var(--paper))] flex flex-col border-l-2 border-[hsl(var(--ink))] z-20 animate-in slide-in-from-right duration-200">
              <div className="flex items-center justify-between px-4 py-3 border-b border-dashed border-[hsl(var(--grid-line))]">
                <div>
                  <div className="font-mono text-[10px] uppercase tracking-[0.2em] text-[hsl(var(--ink-faint))]">
                    {codeLang} pseudocode
                  </div>
                  <h2 className="font-mono text-sm font-semibold text-[hsl(var(--ink))] mt-0.5">
                    generated · live
                  </h2>
                </div>
                <button
                  onClick={() => setShowCode(false)}
                  className="font-mono text-[11px] px-2 py-0.5 border border-dashed border-[hsl(var(--ink))] hover:bg-[hsl(var(--ink))] hover:text-[hsl(var(--paper))]"
                >
                  ×
                </button>
              </div>
              <div className="px-4 py-2 border-b border-dashed border-[hsl(var(--grid-line))] flex gap-2">
                <div className="flex border border-dashed border-[hsl(var(--ink))]">
                  {(["python", "javascript"] as const).map((l) => (
                    <button
                      key={l}
                      onClick={() => setCodeLang(l)}
                      className="font-mono text-[10px] uppercase tracking-wider px-2 py-1"
                      style={
                        codeLang === l
                          ? { background: "var(--gradient-accent)", color: "hsl(var(--paper))" }
                          : { color: "hsl(var(--ink))" }
                      }
                    >
                      {l}
                    </button>
                  ))}
                </div>
                <button
                  onClick={() => {
                    navigator.clipboard.writeText(pseudocode);
                    toast(`${codeLang} copied`);
                  }}
                  className="font-mono text-[10px] uppercase tracking-wider px-2 py-1 border border-dashed border-[hsl(var(--ink))] hover:bg-[hsl(var(--ink))] hover:text-[hsl(var(--paper))]"
                >
                  copy
                </button>
                <button
                  onClick={() => {
                    const blob = new Blob([pseudocode], { type: "text/plain;charset=utf-8" });
                    const url = URL.createObjectURL(blob);
                    const a = document.createElement("a");
                    a.href = url;
                    a.download = codeLang === "python" ? "flow.py" : "flow.js";
                    a.click();
                    URL.revokeObjectURL(url);
                    toast(`${codeLang === "python" ? "Python" : "JavaScript"} file downloaded`);
                  }}
                  className="font-mono text-[10px] uppercase tracking-wider px-2 py-1 border border-dashed border-[hsl(var(--ink))] hover:bg-[hsl(var(--ink))] hover:text-[hsl(var(--paper))]"
                >
                  download
                </button>
              </div>
              <pre className="flex-1 overflow-auto p-4 font-mono text-[11px] leading-relaxed text-[hsl(var(--ink))] whitespace-pre">
{pseudocode}
              </pre>
            </div>
          )}
        </aside>
        )}
      </div>

      {/* Mobile: palette drawer */}
      {isMobile && mobilePanel === "palette" && (
        <div className="fixed inset-0 z-30 flex flex-col bg-[hsl(var(--paper))] animate-in slide-in-from-bottom duration-200">
          <div className="flex items-center justify-between px-4 py-3 border-b border-dashed border-[hsl(var(--grid-line))]" style={{ background: "var(--gradient-header)" }}>
            <h2 className="font-mono text-sm font-semibold">add node</h2>
            <button onClick={() => setMobilePanel("none")} className="font-mono text-[11px] px-2 py-1 border border-dashed border-[hsl(var(--ink))]">close</button>
          </div>
          <div className="flex-1 overflow-y-auto">
            <Palette onAdd={(m) => { addNode(m); setMobilePanel("none"); }} />
          </div>
        </div>
      )}

      {/* Mobile: inspector drawer */}
      {isMobile && mobilePanel === "inspector" && (
        <div className="fixed inset-0 z-30 flex flex-col bg-[hsl(var(--paper))] animate-in slide-in-from-bottom duration-200">
          <div className="flex items-center justify-between px-4 py-3 border-b border-dashed border-[hsl(var(--grid-line))]" style={{ background: "var(--gradient-header)" }}>
            <div>
              <div className="font-mono text-[10px] uppercase tracking-[0.2em] text-[hsl(var(--ink-faint))]">inspector</div>
              <h2 className="font-mono text-sm font-semibold">{selected ? selected.data.name : "no selection"}</h2>
            </div>
            <button onClick={() => setMobilePanel("none")} className="font-mono text-[11px] px-2 py-1 border border-dashed border-[hsl(var(--ink))]">close</button>
          </div>
          <div className="flex-1 overflow-y-auto">
            <Inspector node={selected} edges={edges} nodes={nodes} gateways={gateways} onChange={updateNode} onDelete={deleteNode} />
          </div>
        </div>
      )}

      {/* Mobile: code drawer (full screen overlay) */}
      {isMobile && showCode && (
        <div className="fixed inset-0 z-30 flex flex-col bg-[hsl(var(--paper))] animate-in slide-in-from-bottom duration-200">
          <div className="flex items-center justify-between px-4 py-3 border-b border-dashed border-[hsl(var(--grid-line))]" style={{ background: "var(--gradient-header)" }}>
            <div>
              <div className="font-mono text-[10px] uppercase tracking-[0.2em] text-[hsl(var(--ink-faint))]">{codeLang} pseudocode</div>
              <h2 className="font-mono text-sm font-semibold">generated · live</h2>
            </div>
            <button onClick={() => setShowCode(false)} className="font-mono text-[11px] px-2 py-1 border border-dashed border-[hsl(var(--ink))]">close</button>
          </div>
          <div className="px-4 py-2 border-b border-dashed border-[hsl(var(--grid-line))] flex gap-2">
            <div className="flex border border-dashed border-[hsl(var(--ink))]">
              {(["python", "javascript"] as const).map((l) => (
                <button key={l} onClick={() => setCodeLang(l)}
                  className="font-mono text-[10px] uppercase tracking-wider px-2 py-1"
                  style={codeLang === l ? { background: "var(--gradient-accent)", color: "hsl(var(--paper))" } : { color: "hsl(var(--ink))" }}>
                  {l}
                </button>
              ))}
            </div>
            <button onClick={() => { navigator.clipboard.writeText(pseudocode); toast(`${codeLang} copied`); }}
              className="font-mono text-[10px] uppercase tracking-wider px-2 py-1 border border-dashed border-[hsl(var(--ink))]">copy</button>
            <button onClick={() => {
              const blob = new Blob([pseudocode], { type: "text/plain;charset=utf-8" });
              const url = URL.createObjectURL(blob);
              const a = document.createElement("a");
              a.href = url;
              a.download = codeLang === "python" ? "flow.py" : "flow.js";
              a.click();
              URL.revokeObjectURL(url);
              toast(`${codeLang === "python" ? "Python" : "JavaScript"} file downloaded`);
            }}
              className="font-mono text-[10px] uppercase tracking-wider px-2 py-1 border border-dashed border-[hsl(var(--ink))]">download</button>
            <button onClick={exportJSON} className="font-mono text-[10px] uppercase tracking-wider px-2 py-1 border border-dashed border-[hsl(var(--ink))] ml-auto">export</button>
            <button onClick={importJSON} className="font-mono text-[10px] uppercase tracking-wider px-2 py-1 border border-dashed border-[hsl(var(--ink))]">import</button>
          </div>
          <pre className="flex-1 overflow-auto p-4 font-mono text-[11px] leading-relaxed text-[hsl(var(--ink))] whitespace-pre">
{pseudocode}
          </pre>
        </div>
      )}

      {/* MCP gateway run drawer (desktop + mobile) */}
      {showRun && (
        <div className="fixed inset-y-0 right-0 z-40 w-full sm:w-[440px] flex flex-col bg-[hsl(var(--paper))] border-l-2 border-[hsl(var(--ink))] animate-in slide-in-from-right duration-200">
          <div className="flex items-center justify-between px-4 py-3 border-b border-dashed border-[hsl(var(--grid-line))]" style={{ background: "var(--gradient-header)" }}>
            <div>
              <div className="font-mono text-[10px] uppercase tracking-[0.2em] text-[hsl(var(--ink-faint))]">browser run · log</div>
              <h2 className="font-mono text-sm font-semibold">
                {running ? "executing flow…" : runLogs ? `${runLogs.length} step${runLogs.length === 1 ? "" : "s"}` : "ready"}
              </h2>
            </div>
            <div className="flex gap-1.5">
              <button
                onClick={runFlowAction}
                disabled={running}
                className="font-mono text-[10px] uppercase px-2 py-1 border border-dashed border-[hsl(var(--ink))] hover:bg-[hsl(var(--ink))] hover:text-[hsl(var(--paper))] disabled:opacity-50"
              >
                rerun
              </button>
              <button
                onClick={() => {
                  setShowRun(false);
                  setHighlight(null);
                  if (pendingApproval) {
                    pendingApproval.resolve("aborted");
                    setPendingApproval(null);
                  }
                  setFeedbackText("");
                }}
                className="font-mono text-[11px] px-2 py-1 border border-dashed border-[hsl(var(--ink))]"
              >
                close
              </button>
            </div>
          </div>
          <div className="flex-1 overflow-auto p-3 space-y-2">
            {/* Initial State Editor */}
            <div className="border border-dashed border-[hsl(var(--grid-line))] p-3 space-y-2 mb-2 bg-[hsl(var(--ink)/0.01)]">
              <div className="flex items-center justify-between">
                <span className="font-mono text-[10px] uppercase tracking-[0.15em] text-[hsl(var(--ink-soft))] font-semibold">
                  initial state (json)
                </span>
                {initialStateError ? (
                  <span className="font-mono text-[9px] text-[hsl(var(--issue))] uppercase tracking-wider font-semibold">
                    ⚠ invalid json
                  </span>
                ) : (
                  <span className="font-mono text-[9px] text-[hsl(var(--ink-faint))] uppercase tracking-wider">
                    ✓ valid
                  </span>
                )}
              </div>
              <textarea
                value={initialStateStr}
                onChange={(e) => setInitialStateStr(e.target.value)}
                disabled={running}
                rows={4}
                className={`w-full font-mono text-[10px] p-2 bg-transparent border border-dashed outline-none resize-y ${
                  initialStateError
                    ? "border-[hsl(var(--issue))] text-[hsl(var(--issue))]"
                    : "border-[hsl(var(--grid-line))] focus:border-[hsl(var(--ink))]"
                }`}
                placeholder='{ "query": "hello world" }'
              />
              {initialStateError && (
                <div className="font-mono text-[9px] text-[hsl(var(--issue))] leading-normal">
                  {initialStateError}
                </div>
              )}
            </div>

            {/* Visual Speed Selector */}
            <div className="border border-dashed border-[hsl(var(--grid-line))] p-3 space-y-2 mb-2 bg-[hsl(var(--ink)/0.01)]">
              <span className="font-mono text-[10px] uppercase tracking-[0.15em] text-[hsl(var(--ink-soft))] font-semibold block">
                visual execution speed
              </span>
              <div className="flex border border-dashed border-[hsl(var(--ink))]">
                <button
                  type="button"
                  disabled={running}
                  onClick={() => setVisualSpeed("visualized")}
                  className="flex-1 font-mono text-[10px] uppercase tracking-wider px-2 py-1.5 transition-colors"
                  style={
                    visualSpeed === "visualized"
                      ? { background: "var(--gradient-accent)", color: "hsl(var(--paper))" }
                      : { color: "hsl(var(--ink))" }
                  }
                >
                  Visualized (600ms)
                </button>
                <button
                  type="button"
                  disabled={running}
                  onClick={() => setVisualSpeed("fast")}
                  className="flex-1 font-mono text-[10px] uppercase tracking-wider px-2 py-1.5 transition-colors"
                  style={
                    visualSpeed === "fast"
                      ? { background: "var(--gradient-accent)", color: "hsl(var(--paper))" }
                      : { color: "hsl(var(--ink))" }
                  }
                >
                  Full Speed (Instant)
                </button>
              </div>
            </div>

            {pendingApproval && (
              <div className="border-2 border-[hsl(var(--accent-deep))] p-3 space-y-2 bg-[hsl(var(--accent-deep)/0.03)] animate-pulse shadow-md mb-2">
                <div className="flex items-center gap-2">
                  <span className="w-2.5 h-2.5 bg-[hsl(var(--issue))] rounded-full animate-ping shrink-0" />
                  <span className="font-mono text-[10px] uppercase tracking-[0.2em] font-semibold text-[hsl(var(--issue))]">
                    Action Required · Human-In-The-Loop
                  </span>
                </div>
                <div className="font-mono text-[11px] font-semibold text-[hsl(var(--ink))]">
                  Node: {pendingApproval.name} ({pendingApproval.nodeId})
                </div>
                <div className="font-mono text-[10px] text-[hsl(var(--ink-soft))]">
                  Channel: <span className="uppercase font-semibold text-[hsl(var(--ink))]">{pendingApproval.channel}</span>
                </div>
                <div className="p-2.5 bg-[hsl(var(--paper))] border border-dashed border-[hsl(var(--grid-line))] font-mono text-[11px] text-[hsl(var(--ink))] whitespace-pre-wrap leading-relaxed">
                  {pendingApproval.prompt}
                </div>

                {/* Custom feedback input */}
                <div className="space-y-1 pt-1">
                  <span className="font-mono text-[9px] uppercase tracking-wider text-[hsl(var(--ink-faint))] block">
                    Optionally provide custom feedback or instruction:
                  </span>
                  <textarea
                    value={feedbackText}
                    onChange={(e) => setFeedbackText(e.target.value)}
                    placeholder="Enter instructions, corrections, or suggestions for the agent..."
                    rows={2}
                    className="w-full font-mono text-[10px] p-2 bg-[hsl(var(--paper))] border border-dashed border-[hsl(var(--grid-line))] focus:border-[hsl(var(--ink))] outline-none resize-none"
                  />
                </div>

                <div className="flex gap-2 pt-1">
                  <button
                    type="button"
                    onClick={() => {
                      pendingApproval.resolve("approved");
                      setPendingApproval(null);
                      setFeedbackText("");
                    }}
                    className="flex-1 font-mono text-[10px] uppercase tracking-wider py-1.5 bg-[hsl(var(--ink))] text-[hsl(var(--paper))] hover:opacity-90 font-bold transition-all border border-transparent"
                  >
                    ✓ Approve
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      if (feedbackText.trim()) {
                        pendingApproval.resolve(feedbackText.trim());
                      } else {
                        pendingApproval.resolve("rejected");
                      }
                      setPendingApproval(null);
                      setFeedbackText("");
                    }}
                    className="flex-1 font-mono text-[10px] uppercase tracking-wider py-1.5 border border-dashed border-[hsl(var(--issue))] text-[hsl(var(--issue))] hover:bg-[hsl(var(--issue))] hover:text-[hsl(var(--paper))] transition-all"
                  >
                    {feedbackText.trim() ? "Submit Feedback" : "✗ Reject"}
                  </button>
                </div>
              </div>
            )}

            {running && !pendingApproval && (
              <div className="font-mono text-[10px] text-[hsl(var(--ink-faint))] uppercase tracking-[0.15em] animate-pulse">
                executing in browser…
              </div>
            )}
            {runLogs && runLogs.length === 0 && !running && (
              <div className="font-mono text-[10px] text-[hsl(var(--issue))] uppercase tracking-[0.15em]">
                no logs — see toast for error
              </div>
            )}
            {runLogs?.map((l) => (
              <div
                key={`${l.step}-${l.nodeId}`}
                className="border border-dashed border-[hsl(var(--grid-line))] p-2 font-mono text-[10px]"
                style={l.error ? { borderColor: "hsl(var(--issue))" } : undefined}
              >
                <div className="flex items-center gap-2 mb-1">
                  <span className="text-[hsl(var(--ink-faint))]">#{l.step}</span>
                  <span className="font-semibold text-[hsl(var(--ink))]">{l.name}</span>
                  <span className="uppercase tracking-[0.15em] text-[9px] text-[hsl(var(--ink-soft))]">{l.kind}</span>
                  <span className="ml-auto text-[hsl(var(--ink-faint))]">{l.ms}ms</span>
                </div>
                <div className="text-[hsl(var(--ink-soft))]">
                  → <span className="uppercase tracking-wider">{l.label}</span>
                </div>
                {l.error ? (
                  <pre className="mt-1 whitespace-pre-wrap text-[hsl(var(--issue))]">{l.error}</pre>
                ) : (
                  <pre className="mt-1 whitespace-pre-wrap text-[hsl(var(--ink))] max-h-40 overflow-auto">
{typeof l.output === "string" ? l.output : JSON.stringify(l.output, null, 2)}
                  </pre>
                )}
                {l.stateSnapshot && (
                  <details className="mt-1.5 border-t border-dashed border-[hsl(var(--grid-line))] pt-1.5 group">
                    <summary className="cursor-pointer select-none font-semibold text-[hsl(var(--ink-soft))] hover:text-[hsl(var(--ink))] list-none flex items-center gap-1 [&::-webkit-details-marker]:hidden">
                      <span className="transition-transform duration-100 group-open:rotate-90">▶</span>
                      <span className="uppercase tracking-[0.1em] text-[9px]">state snapshot</span>
                    </summary>
                    <pre className="mt-1.5 p-2 bg-[hsl(var(--ink)/0.02)] border border-dashed border-[hsl(var(--grid-line))] overflow-auto max-h-48 text-[9px] leading-relaxed text-[hsl(var(--ink))] whitespace-pre">
{JSON.stringify(l.stateSnapshot, null, 2)}
                    </pre>
                  </details>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {showGateway && (
        <GatewayManager
          gateways={gateways}
          onChange={setGateways}
          onClearAllKeys={() => {
            setGateways((prev) => clearAllGatewayKeys(prev));
            toast("All API keys cleared from this browser");
          }}
          onClose={() => setShowGateway(false)}
        />
      )}

      {showIntro && (
        <IntroTutorial
          onClose={dismissIntro}
          onOpenGateway={() => setShowGateway(true)}
        />
      )}

      {showSample && (
        <SampleWalkthrough
          onClose={() => setShowSample(false)}
          loadGraph={loadSampleGraph}
          setHighlight={setHighlight}
          selectNode={(id) => {
            setSelectedId(id);
            setSelectedEdgeId(null);
          }}
        />
      )}
    </div>
  );
}

const Index = () => (
  <ReactFlowProvider>
    <Canvas />
  </ReactFlowProvider>
);

export default Index;
