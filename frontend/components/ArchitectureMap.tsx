"use client";

import { Background, Controls, ReactFlow } from "@xyflow/react";

import "@xyflow/react/dist/style.css";

export function ArchitectureMap({ architecture }: { architecture: any }) {
  const folders = (architecture?.nodes || []).filter(
    (n: any) => n.id !== "root",
  );

  const nodes = [
    {
      id: "root",
      position: { x: 300, y: 30 },
      data: { label: "Repository" },
      style: {
        background: "#17122d",
        color: "#ffffff",
        border: "1px solid #7c6cff",
        borderRadius: 14,
        padding: 12,
        width: 150,
      },
    },

    ...folders.map((node: any, i: number) => ({
      id: node.id,
      position: {
        x: 60 + (i % 4) * 190,
        y: 150 + Math.floor(i / 4) * 110,
      },
      data: {
        label: `${node.label} · ${node.files}`,
      },
      style: {
        background: "#0e1727",
        color: "#cbd5e1",
        border: "1px solid rgba(148,163,184,.18)",
        borderRadius: 12,
        padding: 10,
        width: 155,
      },
    })),
  ];

  const edges = (architecture?.edges || []).map((e: any, i: number) => ({
    ...e,
    id: `edge-${i}`,
    animated: true,
    style: {
      stroke: "#64748b",
      strokeWidth: 1.5,
    },
  }));

  return (
    <div className="architecture-map h-[420px] overflow-hidden rounded-2xl border border-white/10 bg-[#080c16]">
      <ReactFlow
        nodes={nodes}
        edges={edges}
        fitView
        proOptions={{
          hideAttribution: false,
        }}
      >
        <Background color="#1e293b" gap={28} />

        <Controls className="repolens-controls" />
      </ReactFlow>
    </div>
  );
}
