"use client";

import { useEffect, useMemo } from "react";
import {
  ReactFlow,
  Background,
  Controls,
  MiniMap,
  Node,
  Edge,
  useNodesState,
  useEdgesState,
  Handle,
  Position,
  BackgroundVariant,
} from "@xyflow/react";
import "@xyflow/react/dist/style.css";
import type { Concept } from "@/lib/api";

// ─── Category color map ───────────────────────────────────────────────────────
const CAT_COLORS: Record<string, { bg: string; border: string; text: string }> = {
  method:   { bg: "rgba(167,139,250,0.15)", border: "#a78bfa", text: "#a78bfa" },
  dataset:  { bg: "rgba(52,211,153,0.15)",  border: "#34d399", text: "#34d399" },
  metric:   { bg: "rgba(251,191,36,0.15)",  border: "#fbbf24", text: "#fbbf24" },
  theory:   { bg: "rgba(244,114,182,0.15)", border: "#f472b6", text: "#f472b6" },
  tool:     { bg: "rgba(6,182,212,0.15)",   border: "#06b6d4", text: "#06b6d4" },
  model:    { bg: "rgba(251,146,60,0.15)",  border: "#fb923c", text: "#fb923c" },
};

// ─── Custom concept node ──────────────────────────────────────────────────────
function ConceptNode({ data }: { data: Record<string, unknown> }) {
  const label = data.label as string;
  const category = data.category as string;
  const colors = CAT_COLORS[category] ?? CAT_COLORS.method;
  return (
    <div style={{
      padding: "10px 16px",
      borderRadius: 12,
      background: colors.bg,
      border: `1.5px solid ${colors.border}`,
      minWidth: 120,
      maxWidth: 180,
      backdropFilter: "blur(8px)",
      textAlign: "center",
      cursor: "default",
      transition: "all 0.2s",
      boxShadow: `0 4px 16px ${colors.border}33`,
    }}>
      <Handle type="target" position={Position.Top} style={{ opacity: 0 }} />
      <div style={{ fontSize: "0.65rem", textTransform: "uppercase", letterSpacing: "0.08em", color: colors.text, fontWeight: 700, marginBottom: 4 }}>
        {category}
      </div>
      <div style={{ fontSize: "0.875rem", fontWeight: 700, color: "#f1f5f9", lineHeight: 1.3 }}>
        {label}
      </div>
      <Handle type="source" position={Position.Bottom} style={{ opacity: 0 }} />
    </div>
  );
}

// ─── Layout helper: simple radial ────────────────────────────────────────────
function layoutNodes(concepts: Concept[]): { nodes: Node[]; edges: Edge[] } {
  if (!concepts.length) return { nodes: [], edges: [] };

  // Group by category
  const groups: Record<string, Concept[]> = {};
  for (const c of concepts) {
    (groups[c.category] ??= []).push(c);
  }

  const nodes: Node[] = [];
  const edges: Edge[] = [];

  const categoryKeys = Object.keys(groups);
  const centerX = 500;
  const centerY = 300;
  const outerRadius = 280;

  categoryKeys.forEach((cat, catIdx) => {
    const angle = (catIdx / categoryKeys.length) * Math.PI * 2 - Math.PI / 2;
    const hubId = `hub-${cat}`;
    const colors = CAT_COLORS[cat] ?? CAT_COLORS.method;

    nodes.push({
      id: hubId,
      type: "default",
      position: {
        x: centerX + Math.cos(angle) * outerRadius * 0.55 - 60,
        y: centerY + Math.sin(angle) * outerRadius * 0.55 - 20,
      },
      data: { label: cat.toUpperCase() },
      style: {
        background: colors.bg,
        border: `2px solid ${colors.border}`,
        color: colors.text,
        borderRadius: 99,
        fontWeight: 800,
        fontSize: "0.7rem",
        letterSpacing: "0.08em",
        padding: "6px 16px",
        minWidth: 80,
        textAlign: "center",
      },
    });

    const catConcepts = groups[cat];
    catConcepts.forEach((concept, i) => {
      const leafAngle = angle + (i - (catConcepts.length - 1) / 2) * 0.35;
      const leafId = `concept-${cat}-${i}`;
      nodes.push({
        id: leafId,
        type: "conceptNode",
        position: {
          x: centerX + Math.cos(leafAngle) * outerRadius * 1.1 - 70,
          y: centerY + Math.sin(leafAngle) * outerRadius * 1.1 - 20,
        },
        data: {
          label: concept.term,
          category: concept.category,
          explanation: concept.simple_explanation,
        },
      });

      edges.push({
        id: `e-${hubId}-${leafId}`,
        source: hubId,
        target: leafId,
        style: { stroke: colors.border, strokeWidth: 1.5, strokeOpacity: 0.6 },
        animated: false,
      });
    });
  });

  return { nodes, edges };
}

const nodeTypes = { conceptNode: ConceptNode };

// ─── Main component ───────────────────────────────────────────────────────────
export default function ConceptMap({ concepts, loading }: { concepts: Concept[]; loading: boolean }) {
  const { nodes: initialNodes, edges: initialEdges } = useMemo(
    () => layoutNodes(concepts),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    []
  );

  const [nodes, setNodes, onNodesChange] = useNodesState(initialNodes);
  const [edges, setEdges, onEdgesChange] = useEdgesState(initialEdges);

  // Sync when concepts arrive from the API (initially empty, then populated)
  useEffect(() => {
    const { nodes: n, edges: e } = layoutNodes(concepts);
    setNodes(n);
    setEdges(e);
  }, [concepts, setNodes, setEdges]);

  if (loading) {
    return (
      <div style={{ height: 500, display: "flex", alignItems: "center", justifyContent: "center", background: "var(--bg-secondary)", borderRadius: "var(--radius)" }}>
        <div style={{ textAlign: "center", color: "var(--text-muted)" }}>
          <div style={{ fontSize: 24, marginBottom: 12, fontWeight: "bold" }}>Loading...</div>
          <p>Building concept map…</p>
        </div>
      </div>
    );
  }

  if (!concepts.length) {
    return (
      <div style={{ height: 400, display: "flex", alignItems: "center", justifyContent: "center", background: "var(--bg-secondary)", borderRadius: "var(--radius)" }}>
        <div style={{ textAlign: "center", color: "var(--text-muted)" }}>
          <div style={{ fontSize: 24, fontWeight: "bold", marginBottom: 12 }}>Concept Map</div>
          <p>No concept data available yet.</p>
        </div>
      </div>
    );
  }

  return (
    <div>
      <div style={{ marginBottom: 16, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <div>
          <h2 style={{ fontSize: "1.3rem", fontWeight: 800, marginBottom: 4 }}>Concept Map</h2>
          <p style={{ color: "var(--text-muted)", fontSize: "0.875rem" }}>
            Interactive knowledge graph · {concepts.length} concepts · Drag to explore
          </p>
        </div>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          {Object.entries(CAT_COLORS).map(([cat, colors]) => (
            <span key={cat} style={{
              display: "inline-flex", alignItems: "center", gap: 5,
              fontSize: "0.7rem", fontWeight: 600, textTransform: "capitalize",
              color: colors.text, padding: "3px 10px", borderRadius: 99,
              background: colors.bg, border: `1px solid ${colors.border}44`,
            }}>
              <span style={{ width: 6, height: 6, borderRadius: "50%", background: colors.border }} />
              {cat}
            </span>
          ))}
        </div>
      </div>

      <div style={{
        height: 600,
        borderRadius: "var(--radius)",
        border: "1px solid var(--border)",
        overflow: "hidden",
        background: "var(--bg-secondary)",
      }}>
        <ReactFlow
          nodes={nodes}
          edges={edges}
          onNodesChange={onNodesChange}
          onEdgesChange={onEdgesChange}
          nodeTypes={nodeTypes}
          fitView
          fitViewOptions={{ padding: 0.2 }}
          minZoom={0.4}
          maxZoom={2}
          style={{ background: "transparent" }}
          proOptions={{ hideAttribution: true }}
        >
          <Background
            variant={BackgroundVariant.Dots}
            gap={24}
            size={1}
            color="rgba(255,255,255,0.06)"
          />
          <Controls
            style={{
              background: "var(--bg-card)",
              border: "1px solid var(--border)",
              borderRadius: 8,
            }}
          />
          <MiniMap
            style={{ background: "var(--bg-secondary)", border: "1px solid var(--border)" }}
            nodeColor={(n) => {
              const cat = (n.data as { category?: string }).category;
              return cat ? (CAT_COLORS[cat]?.border ?? "#7c3aed") : "#7c3aed";
            }}
            maskColor="rgba(10,8,18,0.7)"
          />
        </ReactFlow>
      </div>
    </div>
  );
}
