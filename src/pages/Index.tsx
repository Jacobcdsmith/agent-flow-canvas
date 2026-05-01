import { useCallback, useMemo, useState } from "react";
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
} from "reactflow";
import "reactflow/dist/style.css";

import { AgentNode } from "@/flow/AgentNode";
import { Palette } from "@/flow/Palette";
import { Inspector } from "@/flow/Inspector";
import { AgentNodeData, EDGE_LABELS, NodeTypeMeta } from "@/flow/types";
import { exampleEdges, exampleNodes } from "@/flow/exampleWorkflow";
import { generatePseudocode } from "@/flow/pseudocode";

const nodeTypes = { agent: AgentNode };

let idCounter = 100;
const nextId = () => `n${++idCounter}`;

const Index = () => {
  const [nodes, setNodes] = useState<Node<AgentNodeData>[]>(exampleNodes);
  const [edges, setEdges] = useState<Edge[]>(
    exampleEdges.map((e) => ({ ...e, markerEnd: { type: MarkerType.ArrowClosed } })),
  );
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [showCode, setShowCode] = useState(false);

  const onNodesChange = useCallback(
    (changes: NodeChange[]) => setNodes((ns) => applyNodeChanges(changes, ns)),
    [],
  );
  const onEdgesChange = useCallback(
    (changes: EdgeChange[]) => setEdges((es) => applyEdgeChanges(changes, es)),
    [],
  );
  const onConnect = useCallback(
    (c: Connection) =>
      setEdges((es) =>
        addEdge(
          { ...c, label: "next", type: "smoothstep", markerEnd: { type: MarkerType.ArrowClosed } },
          es,
        ),
      ),
    [],
  );

  const addNode = useCallback((meta: NodeTypeMeta) => {
    const id = nextId();
    const newNode: Node<AgentNodeData> = {
      id,
      type: "agent",
      position: { x: 200 + Math.random() * 300, y: 200 + Math.random() * 300 },
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
  }, []);

  const updateNode = useCallback((id: string, patch: Partial<AgentNodeData>) => {
    setNodes((ns) =>
      ns.map((n) => (n.id === id ? { ...n, data: { ...n.data, ...patch } } : n)),
    );
  }, []);

  const deleteNode = useCallback((id: string) => {
    setNodes((ns) => ns.filter((n) => n.id !== id));
    setEdges((es) => es.filter((e) => e.source !== id && e.target !== id));
    setSelectedId(null);
  }, []);

  const cycleEdgeLabel = useCallback((edgeId: string) => {
    setEdges((es) =>
      es.map((e) => {
        if (e.id !== edgeId) return e;
        const idx = EDGE_LABELS.indexOf((e.label as any) ?? "next");
        const next = EDGE_LABELS[(idx + 1) % EDGE_LABELS.length];
        return { ...e, label: next };
      }),
    );
  }, []);

  const selected = useMemo(
    () => nodes.find((n) => n.id === selectedId) ?? null,
    [nodes, selectedId],
  );

  const pseudocode = useMemo(() => generatePseudocode(nodes, edges), [nodes, edges]);

  return (
    <div className="h-screen w-screen flex flex-col bg-[hsl(var(--paper))] text-[hsl(var(--ink))]">
      <header className="h-12 shrink-0 flex items-center justify-between px-4 border-b border-dashed border-[hsl(var(--grid-line))]">
        <div className="flex items-center gap-3">
          <div className="w-5 h-5 border-2 border-[hsl(var(--ink))] relative">
            <div className="absolute inset-1 bg-[hsl(var(--ink))]" />
          </div>
          <h1 className="font-mono text-[13px] font-semibold tracking-tight">
            agent_flow<span className="text-[hsl(var(--ink-faint))]">.canvas</span>
          </h1>
          <span className="font-mono text-[10px] uppercase tracking-[0.2em] text-[hsl(var(--ink-faint))] ml-2">
            wireframe · v0.1
          </span>
        </div>
        <div className="flex items-center gap-2">
          <span className="font-mono text-[10px] text-[hsl(var(--ink-faint))]">
            {nodes.length} nodes · {edges.length} edges
          </span>
          <button
            onClick={() => setShowCode((v) => !v)}
            className="font-mono text-[11px] px-3 py-1 border border-dashed border-[hsl(var(--ink))] hover:bg-[hsl(var(--ink))] hover:text-[hsl(var(--paper))] transition-colors"
          >
            {showCode ? "hide pseudocode" : "view pseudocode"}
          </button>
        </div>
      </header>

      <div className="flex-1 flex min-h-0">
        <Palette onAdd={addNode} />

        <main className="flex-1 relative min-w-0">
          <ReactFlow
            nodes={nodes}
            edges={edges}
            onNodesChange={onNodesChange}
            onEdgesChange={onEdgesChange}
            onConnect={onConnect}
            onNodeClick={(_, n) => setSelectedId(n.id)}
            onPaneClick={() => setSelectedId(null)}
            onEdgeClick={(_, e) => cycleEdgeLabel(e.id)}
            nodeTypes={nodeTypes}
            fitView
            proOptions={{ hideAttribution: true }}
            defaultEdgeOptions={{
              type: "smoothstep",
              style: { stroke: "hsl(var(--ink))", strokeWidth: 1.25, strokeDasharray: "4 3" },
              labelStyle: {
                fontFamily: "ui-monospace, monospace",
                fontSize: 10,
                fill: "hsl(var(--ink))",
              },
              labelBgStyle: { fill: "hsl(var(--paper))" },
              labelBgPadding: [4, 2],
              markerEnd: { type: MarkerType.ArrowClosed, color: "hsl(var(--ink))" },
            }}
            style={{ background: "hsl(var(--paper))" }}
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
            <MiniMap
              pannable
              zoomable
              maskColor="hsl(var(--paper) / 0.7)"
              nodeColor={() => "hsl(var(--ink))"}
              className="!bg-[hsl(var(--paper))] !border !border-dashed !border-[hsl(var(--grid-line))]"
            />
          </ReactFlow>

          <div className="absolute top-3 left-3 font-mono text-[10px] text-[hsl(var(--ink-faint))] uppercase tracking-[0.2em] pointer-events-none">
            click edge → cycle label · drag handles → connect
          </div>
        </main>

        <aside className="w-[300px] shrink-0 border-l border-dashed border-[hsl(var(--grid-line))] bg-[hsl(var(--paper))] flex flex-col">
          <div className="px-4 py-3 border-b border-dashed border-[hsl(var(--grid-line))]">
            <div className="font-mono text-[10px] uppercase tracking-[0.2em] text-[hsl(var(--ink-faint))]">
              inspector
            </div>
            <h2 className="font-mono text-sm font-semibold text-[hsl(var(--ink))] mt-0.5">
              {selected ? selected.data.name : "no selection"}
            </h2>
          </div>
          <div className="flex-1 overflow-y-auto">
            <Inspector node={selected} onChange={updateNode} onDelete={deleteNode} />
          </div>
        </aside>
      </div>

      {showCode && (
        <div className="h-[280px] shrink-0 border-t border-dashed border-[hsl(var(--grid-line))] bg-[hsl(var(--paper))] flex flex-col">
          <div className="flex items-center justify-between px-4 py-2 border-b border-dashed border-[hsl(var(--grid-line))]">
            <div className="font-mono text-[10px] uppercase tracking-[0.2em] text-[hsl(var(--ink-faint))]">
              python pseudocode · generated
            </div>
            <button
              onClick={() => navigator.clipboard.writeText(pseudocode)}
              className="font-mono text-[10px] uppercase tracking-wider text-[hsl(var(--ink-soft))] hover:text-[hsl(var(--ink))] border border-dashed border-[hsl(var(--grid-line))] hover:border-[hsl(var(--ink))] px-2 py-0.5"
            >
              copy
            </button>
          </div>
          <pre className="flex-1 overflow-auto p-4 font-mono text-[11px] leading-relaxed text-[hsl(var(--ink))] whitespace-pre">
{pseudocode}
          </pre>
        </div>
      )}
    </div>
  );
};

export default Index;
