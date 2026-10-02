"use client";

import { Background, Controls, ReactFlow } from "@xyflow/react";
import "@xyflow/react/dist/style.css";

export function ArchitectureMap({ architecture }: { architecture: any }) {
  const folders = (architecture?.nodes || []).filter((n: any) => n.id !== "root");

  const nodes = [
    {
      id: "root",
      position: { x: 300, y: 30 },
      data: { label: "Repository" },
      style: {
        background: "#17181b", color: "#f0ede7", border: "1px solid #f2b84b",
        borderRadius: 8, padding: 11, width: 150,
        boxShadow: "0 8px 25px rgba(0,0,0,.25)",
      },
    },
    ...folders.map((node: any, i: number) => ({
      id: node.id,
      position: { x: 60 + (i % 4) * 190, y: 150 + Math.floor(i / 4) * 110 },
      data: { label: `${node.label} · ${node.files}` },
      style: {
        background: "#101316", color: "#c8c4bc", border: "1px solid rgba(255,255,255,.12)",
        borderRadius: 7, padding: 10, width: 155,
      },
    })),
  ];

  const edges = (architecture?.edges || []).map((e: any, i: number) => ({
    ...e, id: `edge-${i}`, animated: true,
    style: { stroke: "#6d6961", strokeWidth: 1.4 },
  }));

  return (
    <div className="architecture-map h-[340px] overflow-hidden rounded-xl border border-white/[.09] bg-[#080a0c] sm:h-[420px]">
      <ReactFlow nodes={nodes} edges={edges} fitView proOptions={{ hideAttribution: false }}>
        <Background color="#202327" gap={28} />
        <Controls className="repolens-controls" />
      </ReactFlow>
    </div>
  );
}
