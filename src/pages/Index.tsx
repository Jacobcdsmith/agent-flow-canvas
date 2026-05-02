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
import { supabase } from "@/integrations/supabase/client";

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

  // ---- MCP gateway run state ----
  interface RunLog {
    step: number;
    nodeId: string;
    name: string;
    kind: string;
    label: string;
    output?: unknown;
    error?: string;
    ms: number;
  }
  const [runLogs, setRunLogs] = useState<RunLog[] | null>(null);
  const [running, setRunning] = useState(false);
  const [showRun, setShowRun] = useState(false);

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
      })),
    [nodes, issueByNode, validated],
  );

  const renderedEdges = useMemo(
    () =>
      edges.map((e) => {
        const isSel = e.id === selectedEdgeId;
        return {
          ...e,
          type: "smoothstep" as const,
          markerEnd: {
            type: MarkerType.ArrowClosed,
            color: isSel ? "hsl(var(--edge-selected))" : "hsl(var(--ink-soft))",
          },
          style: {
            stroke: isSel ? "hsl(var(--edge-selected))" : "hsl(var(--ink-soft))",
            strokeWidth: isSel ? 2 : 1,
            strokeDasharray: isSel ? "6 3" : "3 3",
            opacity: isSel ? 1 : 0.7,
          },
          labelStyle: {
            fontFamily: "ui-monospace, monospace",
            fontSize: 9,
            fontWeight: 600,
            letterSpacing: "0.1em",
            textTransform: "uppercase" as const,
            fill: isSel ? "hsl(var(--edge-selected))" : "hsl(var(--ink-soft))",
          },
          labelBgStyle: {
            fill: "hsl(var(--paper))",
            stroke: isSel ? "hsl(var(--edge-selected))" : "hsl(var(--ink-faint))",
            strokeWidth: 0.5,
          },
          labelBgPadding: [6, 3] as [number, number],
          labelBgBorderRadius: 0,
          label: String(e.label ?? "next"),
        };
      }),
    [edges, selectedEdgeId],
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

  const runFlow = useCallback(async () => {
    setRunning(true);
    setShowRun(true);
    setRunLogs(null);
    try {
      const payload = {
        nodes: nodes.map((n) => ({ id: n.id, data: n.data })),
        edges: edges.map((e) => ({ id: e.id, source: e.source, target: e.target, label: e.label })),
        initialState: { query: "hello world" },
      };
      const { data, error } = await supabase.functions.invoke("flow-run", { body: payload });
      if (error) throw error;
      if (!data?.ok) throw new Error(data?.error ?? "run failed");
      setRunLogs(data.logs as RunLog[]);
      toast.success(`Flow ran in ${data.logs.length} steps`);
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      toast.error(`Run failed: ${msg}`);
      setRunLogs([]);
    } finally {
      setRunning(false);
    }
  }, [nodes, edges]);

  return (
    <div
      className="h-screen w-screen flex flex-col text-[hsl(var(--ink))] overflow-hidden"
      style={{ background: "var(--gradient-paper)" }}
    >
      <header
        className="h-12 shrink-0 flex items-center justify-between px-3 sm:px-4 border-b border-dashed border-[hsl(var(--grid-line))]"
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
            onClick={runFlow}
            disabled={running}
            title="Execute flow via MCP gateway (routes LLM nodes through Lovable AI)"
            className="font-mono text-[10px] sm:text-[11px] px-2 sm:px-3 py-1 border border-dashed text-[hsl(var(--paper))] disabled:opacity-50"
            style={{ background: "var(--gradient-accent)", borderColor: "hsl(var(--accent-deep))" }}
          >
            {running ? "running…" : "▶ run"}
          </button>
          <button
            onClick={exportJSON}
            className="hidden sm:inline-flex font-mono text-[11px] px-3 py-1 border border-dashed border-[hsl(var(--ink))] hover:bg-[hsl(var(--ink))] hover:text-[hsl(var(--paper))] transition-colors"
          >
            export json
          </button>
          <button
            onClick={importJSON}
            className="hidden sm:inline-flex font-mono text-[11px] px-3 py-1 border border-dashed border-[hsl(var(--ink))] hover:bg-[hsl(var(--ink))] hover:text-[hsl(var(--paper))] transition-colors"
          >
            import json
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
                className="font-mono text-[11px] px-3 py-2 border border-dashed border-[hsl(var(--ink))] text-[hsl(var(--paper))] shadow"
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
            <Inspector node={selected} edges={edges} nodes={nodes} onChange={updateNode} onDelete={deleteNode} />
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
            <button onClick={exportJSON} className="font-mono text-[10px] uppercase tracking-wider px-2 py-1 border border-dashed border-[hsl(var(--ink))] ml-auto">export</button>
            <button onClick={importJSON} className="font-mono text-[10px] uppercase tracking-wider px-2 py-1 border border-dashed border-[hsl(var(--ink))]">import</button>
          </div>
          <pre className="flex-1 overflow-auto p-4 font-mono text-[11px] leading-relaxed text-[hsl(var(--ink))] whitespace-pre">
{pseudocode}
          </pre>
        </div>
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
