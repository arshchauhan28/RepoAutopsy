from __future__ import annotations

import ast
import re
from collections import defaultdict
from pathlib import PurePosixPath
from app.analyzers.dependencies import analyze_dependencies, JS_TS_EXTENSIONS
from app.analyzers.classifier import (
    classify_file,
    is_eligible_for_ast_parsing,
)
from app.analyzers.metrics import (
    is_lockfile,
    is_generated_or_data_file,
    is_configuration_file,
    is_maintainable_source_candidate,
)

# Common ecosystem technologies mapping with rules for declared / imported / configured
ECOSYSTEM_RULES = {
    "react": ("React", "frontend"),
    "next": ("Next.js", "frontend"),
    "vue": ("Vue.js", "frontend"),
    "svelte": ("Svelte", "frontend"),
    "tailwind": ("Tailwind CSS", "frontend"),
    "@xyflow/react": ("React Flow", "frontend"),
    "monaco-editor": ("Monaco Editor", "frontend"),
    "fastapi": ("FastAPI", "backend"),
    "flask": ("Flask", "backend"),
    "django": ("Django", "backend"),
    "express": ("Express", "backend"),
    "nest": ("NestJS", "backend"),
    "sqlalchemy": ("SQLAlchemy", "data"),
    "pydantic": ("Pydantic", "data"),
    "psycopg": ("PostgreSQL Driver", "data"),
    "pg": ("PostgreSQL Driver", "data"),
    "prisma": ("Prisma ORM", "data"),
    "mongoose": ("MongoDB Mongoose", "data"),
    "sqlite3": ("SQLite", "data"),
    "redis": ("Redis Client", "data"),
    "pytest": ("PyTest", "testing"),
    "jest": ("Jest", "testing"),
    "vitest": ("Vitest", "testing"),
    "openai": ("OpenAI SDK", "ai"),
    "anthropic": ("Anthropic SDK", "ai"),
    "groq": ("Groq SDK", "ai"),
    "langchain": ("LangChain", "ai"),
    "torch": ("PyTorch", "ai"),
    "tensorflow": ("TensorFlow", "ai"),
    "numpy": ("NumPy", "data"),
    "pandas": ("Pandas", "data"),
    "httpx": ("HTTPX", "network"),
    "axios": ("Axios", "network"),
    "uvicorn": ("Uvicorn ASGI", "backend"),
}

# Component classification patterns based on paths and semantics
COMPONENT_SIGNATURES = [
    {
        "id": "comp-api-routes",
        "name": "API Routes & Endpoints",
        "layer": "api",
        "role": "Handles HTTP requests, route matching, parameter validation and HTTP response mapping.",
        "patterns": [r"(?:^|/)(?:api|routes|endpoints|controllers|handlers)(?:/|$)", r"(?:^|/)(?:views|routers)\.py$"],
    },
    {
        "id": "comp-services",
        "name": "Business Logic & Services",
        "layer": "domain",
        "role": "Encapsulates application logic, workflows, domain rules, and orchestrates lower-level modules.",
        "patterns": [r"(?:^|/)(?:services|domain|usecases|managers|actions)(?:/|$)", r"(?:^|/)(?:service|logic)\.py$"],
    },
    {
        "id": "comp-data-models",
        "name": "Data Models & Storage",
        "layer": "data",
        "role": "Defines database schemas, ORM entities, validation schemas, and database connection lifecycle.",
        "patterns": [r"(?:^|/)(?:models|db|database|schemas|entities|migrations|prisma)(?:/|$)", r"(?:^|/)(?:model|schema|session|database)\.py$"],
    },
    {
        "id": "comp-auth-security",
        "name": "Auth & Security",
        "layer": "security",
        "role": "Manages user authentication, authorization checks, session tokens, and security policies.",
        "patterns": [r"(?:^|/)(?:auth|security|guards|oauth|jwt|permissions)(?:/|$)", r"(?:^|/)(?:auth|security)\.(?:py|ts|js)$"],
    },
    {
        "id": "comp-integrations",
        "name": "External Integrations & Clients",
        "layer": "integration",
        "role": "Communicates with third-party APIs, webhooks, LLM providers, and external services.",
        "patterns": [r"(?:^|/)(?:integrations|clients|adapters|webhooks|sdk)(?:/|$)", r"(?:^|/)(?:client|external|github_service|ai_service)\.(?:py|ts|js)$"],
    },
    {
        "id": "comp-frontend-pages",
        "name": "Frontend Pages & Routing",
        "layer": "presentation",
        "role": "Renders user-facing pages, handles client/server layout routing, and page transitions.",
        "patterns": [r"(?:^|/)(?:pages|app|routes)/(?:.*[A-Za-z0-9_-]+/page\.[a-z]+|.*\.(?:tsx|jsx|vue|svelte)$)", r"^frontend/app/.*page\.[a-z]+$"],
    },
    {
        "id": "comp-ui-components",
        "name": "Reusable UI Components",
        "layer": "presentation",
        "role": "Provides modular UI elements, design system components, cards, tables, and dialogs.",
        "patterns": [r"(?:^|/)(?:components|widgets|ui|views)/(?:.*)$", r"(?:^|/)components\.(?:tsx|jsx)$"],
    },
    {
        "id": "comp-core-utils",
        "name": "Core Config & Utilities",
        "layer": "infrastructure",
        "role": "Shared helper functions, environment configuration, formatters, and cross-cutting utilities.",
        "patterns": [r"(?:^|/)(?:utils|lib|common|helpers|core|config)(?:/|$)", r"(?:^|/)(?:config|settings|constants|utils)\.(?:py|ts|js)$"],
    },
    {
        "id": "comp-tests",
        "name": "Test Suite & Fixtures",
        "layer": "testing",
        "role": "Automated unit tests, integration tests, mock data, and test runner configurations.",
        "patterns": [r"(?:^|/)(?:tests|__tests__|spec|e2e|testing)(?:/|$)", r"(?:test_[^/]+\.py|.*\.test\.[a-z]+|.*\.spec\.[a-z]+)$"],
    },
    {
        "id": "comp-devops-infra",
        "name": "Deployment & Infrastructure",
        "layer": "infrastructure",
        "role": "Containerization, CI/CD pipelines, reverse proxy, build scripts, and cloud configurations.",
        "patterns": [r"(?:docker-compose.*|Dockerfile.*|\.github/.*|k8s/.*|render\.yaml|vercel\.json|nginx.*)$"],
    },
    {
        "id": "comp-config-env",
        "name": "Configuration & Tooling",
        "layer": "infrastructure",
        "role": "Project configuration, linters, compiler flags, and workspace settings.",
        "patterns": [r"(?:tsconfig.*|\.eslintrc.*|\.prettierrc.*|next\.config.*|tailwind\.config.*|vite\.config.*|postcss\.config.*|pyproject\.toml|setup\.cfg|\.env.*)$"],
    },
    {
        "id": "comp-docs-specs",
        "name": "Documentation & Specs",
        "layer": "general",
        "role": "Architecture documentation, API specifications, changelogs, and guides.",
        "patterns": [r"(?:^|/)(?:docs|documentation)/", r"\.(?:md|markdown|rst|txt)$", r"(?:README|LICENSE|CHANGELOG)"],
    },
]

SEMANTIC_RELATIONS: dict[tuple[str, str], str] = {
    ("comp-frontend-pages", "comp-ui-components"): "Renders UI",
    ("comp-frontend-pages", "comp-api-routes"): "Dispatches Requests",
    ("comp-frontend-pages", "comp-core-utils"): "Shared Utilities",
    ("comp-api-routes", "comp-services"): "Delegates Logic",
    ("comp-api-routes", "comp-auth-security"): "Guards Access",
    ("comp-api-routes", "comp-data-models"): "Validates Schemas",
    ("comp-services", "comp-data-models"): "Data Access",
    ("comp-services", "comp-integrations"): "External Services",
    ("comp-services", "comp-core-utils"): "Uses Utilities",
    ("comp-auth-security", "comp-data-models"): "User Storage",
    ("comp-tests", "comp-services"): "Unit Tests",
    ("comp-tests", "comp-api-routes"): "Integration Tests",
}


def classify_file_to_component(file_path: str) -> str:
    path_norm = str(PurePosixPath(file_path)).replace("\\", "/")
    cat = classify_file(path_norm)
    if cat in {"generated_code", "build_output", "vendored_dependency"}:
        return "comp-build-artifacts"
    if cat == "test":
        return "comp-tests"
    if cat == "documentation":
        return "comp-docs-specs"
    if cat == "infrastructure":
        return "comp-devops-infra"

    for comp in COMPONENT_SIGNATURES:
        for pat in comp["patterns"]:
            if re.search(pat, path_norm, re.IGNORECASE):
                return comp["id"]
    return "comp-core-utils"


def extract_symbols_from_file(path: str, content: str) -> list[dict]:
    """
    Extracts high-level architectural symbols (classes, functions, endpoints) from code.
    Returns list of { name, type, line, path }.
    """
    symbols: list[dict] = []
    suffix = PurePosixPath(path).suffix.lower()

    if suffix == ".py":
        try:
            tree = ast.parse(content, filename=path)
            for node in tree.body:
                if isinstance(node, ast.ClassDef):
                    symbols.append({
                        "name": node.name,
                        "type": "class",
                        "line": node.lineno,
                        "file_path": path,
                    })
                elif isinstance(node, (ast.FunctionDef, ast.AsyncFunctionDef)):
                    is_endpoint = False
                    for dec in node.decorator_list:
                        dec_repr = ast.unparse(dec) if hasattr(ast, "unparse") else ""
                        if any(k in dec_repr for k in ["get", "post", "put", "delete", "patch", "route"]):
                            is_endpoint = True
                    symbols.append({
                        "name": node.name,
                        "type": "endpoint" if is_endpoint else "function",
                        "line": node.lineno,
                        "file_path": path,
                    })
        except Exception:
            pass

    elif suffix in JS_TS_EXTENSIONS:
        lines = content.splitlines()
        for idx, line in enumerate(lines, start=1):
            cl = line.strip()
            # Exported functions
            m_func = re.search(r"\bexport\s+(?:async\s+)?function\s+([A-Za-z0-9_]+)", cl)
            if m_func:
                symbols.append({
                    "name": m_func.group(1),
                    "type": "function",
                    "line": idx,
                    "file_path": path,
                })
                continue
            # Exported classes
            m_class = re.search(r"\bexport\s+class\s+([A-Za-z0-9_]+)", cl)
            if m_class:
                symbols.append({
                    "name": m_class.group(1),
                    "type": "class",
                    "line": idx,
                    "file_path": path,
                })
                continue
            # Route handlers (Next.js App router GET, POST, etc.)
            m_route = re.search(r"\bexport\s+(?:async\s+)?function\s+(GET|POST|PUT|DELETE|PATCH)\b", cl)
            if m_route:
                symbols.append({
                    "name": m_route.group(1),
                    "type": "endpoint",
                    "line": idx,
                    "file_path": path,
                })

    return symbols[:20]


def detect_entry_points(files: dict[str, str]) -> list[dict]:
    """
    Identifies application entry points with verified proof.
    """
    entry_points = []
    for path, content in files.items():
        path_norm = str(PurePosixPath(path)).replace("\\", "/")

        # 1. FastAPI / ASGI
        if path_norm.endswith(".py"):
            if re.search(r"\b(?:app|application)\s*=\s*(?:FastAPI|Starlette)\s*\(", content):
                entry_points.append({
                    "path": path_norm,
                    "type": "api_server",
                    "framework": "FastAPI",
                    "symbol": "app",
                    "evidence": f"Instantiated FastAPI application in {path_norm}",
                })
            elif re.search(r"\b(?:app|application)\s*=\s*Flask\s*\(", content):
                entry_points.append({
                    "path": path_norm,
                    "type": "api_server",
                    "framework": "Flask",
                    "symbol": "app",
                    "evidence": f"Instantiated Flask application in {path_norm}",
                })
            elif path_norm.endswith("__main__.py") or path_norm == "cli.py":
                entry_points.append({
                    "path": path_norm,
                    "type": "cli",
                    "framework": "Python CLI",
                    "symbol": "__main__",
                    "evidence": f"CLI execution entry point at {path_norm}",
                })

        # 2. Next.js App Router / Pages
        if re.search(r"(?:^|/)(?:frontend/)?(?:src/)?app/page\.[a-z]+$", path_norm):
            entry_points.append({
                "path": path_norm,
                "type": "frontend_root",
                "framework": "Next.js",
                "symbol": "default",
                "evidence": f"Next.js root page route at {path_norm}",
            })
        elif re.search(r"(?:^|/)(?:frontend/)?(?:src/)?pages/index\.[a-z]+$", path_norm):
            entry_points.append({
                "path": path_norm,
                "type": "frontend_root",
                "framework": "React / Next.js",
                "symbol": "default",
                "evidence": f"Pages router root index at {path_norm}",
            })

        # 3. Node / Express server
        if path_norm in {"server.js", "server.ts", "src/server.ts", "backend/src/server.ts"}:
            if re.search(r"\bexpress\s*\(", content):
                entry_points.append({
                    "path": path_norm,
                    "type": "api_server",
                    "framework": "Express",
                    "symbol": "app",
                    "evidence": f"Express server instance in {path_norm}",
                })

    return entry_points


def detect_technology_stack(files: dict[str, str], dep_data: dict) -> list[dict]:
    """
    Evidence-based technology detection.
    Distinguishes runtime_confirmed, configured, imported, and declared.
    """
    detected: dict[str, dict] = {}

    def add_tech(name: str, category: str, ev_type: str, conf: str, ev_text: str, file_path: str):
        if name not in detected:
            detected[name] = {
                "name": name,
                "category": category,
                "evidence_type": ev_type,
                "confidence": conf,
                "evidence": ev_text,
                "files": [file_path],
            }
        else:
            # Upgrade evidence if higher confidence
            priority = {"runtime_confirmed": 3, "configured": 2, "imported": 2, "declared": 1}
            cur_p = priority.get(detected[name]["evidence_type"], 0)
            new_p = priority.get(ev_type, 0)
            if new_p > cur_p:
                detected[name]["evidence_type"] = ev_type
                detected[name]["confidence"] = conf
                detected[name]["evidence"] = ev_text
            if file_path not in detected[name]["files"]:
                detected[name]["files"].append(file_path)

    # 1. Runtime confirmed from entry points
    entry_points = detect_entry_points(files)
    for ep in entry_points:
        fw = ep["framework"]
        if "FastAPI" in fw:
            add_tech("FastAPI", "backend", "runtime_confirmed", "verified", ep["evidence"], ep["path"])
        elif "Flask" in fw:
            add_tech("Flask", "backend", "runtime_confirmed", "verified", ep["evidence"], ep["path"])
        elif "Next.js" in fw:
            add_tech("Next.js", "frontend", "runtime_confirmed", "verified", ep["evidence"], ep["path"])
        elif "Express" in fw:
            add_tech("Express", "backend", "runtime_confirmed", "verified", ep["evidence"], ep["path"])

    # 2. Configured files
    for path, content in files.items():
        name_lower = PurePosixPath(path).name.lower()
        if "next.config" in name_lower:
            add_tech("Next.js", "frontend", "configured", "verified", f"Configured in {path}", path)
        if "tailwind.config" in name_lower:
            add_tech("Tailwind CSS", "frontend", "configured", "verified", f"Configured in {path}", path)
        if "docker-compose" in name_lower or "dockerfile" in name_lower:
            add_tech("Docker", "infrastructure", "configured", "verified", f"Container configuration in {path}", path)
        if "tsconfig.json" in name_lower:
            add_tech("TypeScript", "frontend", "configured", "verified", f"TypeScript compiler configured in {path}", path)

    # 3. Imported packages from AST
    for pkg_item in dep_data.get("external_packages", []):
        pkg_name = pkg_item["package"].lower()
        for rule_key, (tech_label, category) in ECOSYSTEM_RULES.items():
            if rule_key == pkg_name or pkg_name.startswith(f"{rule_key}-"):
                add_tech(
                    tech_label,
                    category,
                    "imported",
                    "verified",
                    f"Imported in source files ({pkg_item['usage_count']} usage references)",
                    "source-code",
                )

    # 4. Declared in manifests
    for path, content in files.items():
        path_lower = path.lower()
        if "package.json" in path_lower or "requirements.txt" in path_lower or "pyproject.toml" in path_lower:
            for rule_key, (tech_label, category) in ECOSYSTEM_RULES.items():
                if rule_key in content.lower():
                    add_tech(
                        tech_label,
                        category,
                        "declared",
                        "strong_evidence",
                        f"Declared dependency in {path}",
                        path,
                    )

    return sorted(detected.values(), key=lambda t: t["name"])


def build_nested_file_tree(files: dict[str, str]) -> dict:
    root = {
        "name": "root",
        "path": "",
        "type": "directory",
        "file_count": 0,
        "total_lines": 0,
        "total_size": 0,
        "children": {},
    }

    for path, content in sorted(files.items()):
        parts = PurePosixPath(path).parts
        curr = root
        file_lines = content.count("\n") + (1 if content else 0)
        file_size = len(content.encode("utf-8"))

        curr["file_count"] += 1
        curr["total_lines"] += file_lines
        curr["total_size"] += file_size

        for i, part in enumerate(parts):
            is_file = i == len(parts) - 1
            if is_file:
                ext = PurePosixPath(part).suffix.lower()
                curr["children"][part] = {
                    "name": part,
                    "path": path,
                    "type": "file",
                    "category": classify_file(path),
                    "extension": ext,
                    "lines": file_lines,
                    "size": file_size,
                }
            else:
                if part not in curr["children"]:
                    sub_path = "/".join(parts[: i + 1])
                    curr["children"][part] = {
                        "name": part,
                        "path": sub_path,
                        "type": "directory",
                        "file_count": 0,
                        "total_lines": 0,
                        "total_size": 0,
                        "children": {},
                    }
                curr = curr["children"][part]
                curr["file_count"] += 1
                curr["total_lines"] += file_lines
                curr["total_size"] += file_size

    def format_node(node: dict) -> dict:
        if node["type"] == "file":
            return node
        sorted_children = sorted(
            node["children"].values(),
            key=lambda x: (0 if x["type"] == "directory" else 1, x["name"].lower()),
        )
        return {
            "name": node["name"],
            "path": node["path"],
            "type": "directory",
            "file_count": node["file_count"],
            "total_lines": node["total_lines"],
            "total_size": node["total_size"],
            "children": [format_node(c) for c in sorted_children],
        }

    return format_node(root)


def analyze_architecture(files: dict[str, str]) -> dict:
    """
    Analyze codebase architecture with evidence-based component recovery,
    dependency graphs, entry points, and verified technology detection.
    """
    # 1. Dependency Graph
    dep_data = analyze_dependencies(files)

    # 2. Technology Stack & Entry Points
    technologies = detect_technology_stack(files, dep_data)
    entry_points = detect_entry_points(files)

    # 3. Component categorization
    components_map: dict[str, dict] = {}
    sig_lookup = {c["id"]: c for c in COMPONENT_SIGNATURES}

    file_to_comp: dict[str, str] = {}
    for path, content in files.items():
        comp_id = classify_file_to_component(path)
        file_to_comp[path] = comp_id
        if comp_id not in components_map:
            sig = sig_lookup.get(
                comp_id,
                {
                    "id": comp_id,
                    "name": "Root Scripts & Utilities",
                    "layer": "infrastructure",
                    "role": "Project-level helper scripts and miscellaneous source files.",
                },
            )
            components_map[comp_id] = {
                "id": sig["id"],
                "name": sig["name"],
                "layer": sig["layer"],
                "role": sig["role"],
                "file_count": 0,
                "total_lines": 0,
                "technologies": set(),
                "files": [],
                "symbols": [],
                "evidence_references": [],
            }
        lines = content.count("\n") + (1 if content else 0)
        components_map[comp_id]["file_count"] += 1
        if not is_lockfile(path):
            components_map[comp_id]["total_lines"] += lines
        components_map[comp_id]["files"].append({"path": path, "lines": lines})

        # Extract symbols and evidence references
        if is_eligible_for_ast_parsing(path, classify_file(path)):
            syms = extract_symbols_from_file(path, content)
            components_map[comp_id]["symbols"].extend(syms[:5])
            for s in syms[:3]:
                components_map[comp_id]["evidence_references"].append({
                    "file_path": path,
                    "line": s["line"],
                    "symbol": s["name"],
                    "evidence_type": "ast_symbol",
                })

    # Associate technologies with components
    for tech in technologies:
        for f in tech.get("files", []):
            cid = file_to_comp.get(f)
            if cid and cid in components_map:
                components_map[cid]["technologies"].add(tech["name"])

    # 4. Inter-component edges based on real module import edges
    comp_edge_weights: dict[tuple[str, str], int] = defaultdict(int)
    for edge in dep_data["edges"]:
        if edge.get("is_external"):
            continue
        src = edge["source"]
        tgt = edge["target"]
        src_comp = file_to_comp.get(src)
        tgt_comp = file_to_comp.get(tgt)
        if src_comp and tgt_comp and src_comp != tgt_comp:
            comp_edge_weights[(src_comp, tgt_comp)] += 1

    layer_order = {
        "presentation": 0,
        "api": 1,
        "domain": 2,
        "security": 2,
        "integration": 3,
        "data": 4,
        "infrastructure": 5,
        "testing": 6,
        "general": 7,
    }

    active_components = [
        c for c in components_map.values()
        if c["id"] != "comp-build-artifacts" or len(components_map) <= 1
    ]
    active_components = sorted(
        active_components,
        key=lambda c: (layer_order.get(c["layer"], 9), -c["file_count"]),
    )

    overview_nodes = []
    for c in active_components:
        overview_nodes.append({
            "id": c["id"],
            "label": c["name"],
            "type": "componentNode",
            "layer": c["layer"],
            "role": c["role"],
            "file_count": c["file_count"],
            "total_lines": c["total_lines"],
            "technologies": sorted(c["technologies"]),
            "sample_files": [f["path"] for f in c["files"][:8]],
            "symbols_count": len(c["symbols"]),
        })

    active_ids = {c["id"] for c in active_components}
    overview_edges = []
    for (src_c, tgt_c), weight in comp_edge_weights.items():
        if src_c in active_ids and tgt_c in active_ids:
            rel_label = SEMANTIC_RELATIONS.get((src_c, tgt_c))
            edge_label = f"{rel_label} ({weight})" if rel_label else f"{weight} link{'s' if weight > 1 else ''}"
            overview_edges.append({
                "id": f"comp_edge_{src_c}_{tgt_c}",
                "source": src_c,
                "target": tgt_c,
                "label": edge_label,
                "weight": weight,
                "animated": True,
            })

    if not overview_edges and len(overview_nodes) > 1:
        comp_ids = {c["id"] for c in active_components}
        inferred = [
            ("comp-frontend-pages", "comp-ui-components"),
            ("comp-frontend-pages", "comp-api-routes"),
            ("comp-api-routes", "comp-services"),
            ("comp-services", "comp-data-models"),
            ("comp-api-routes", "comp-data-models"),
            ("comp-services", "comp-integrations"),
            ("comp-api-routes", "comp-auth-security"),
        ]
        for src, tgt in inferred:
            if src in comp_ids and tgt in comp_ids:
                rel_label = SEMANTIC_RELATIONS.get((src, tgt), "inferred flow")
                overview_edges.append({
                    "id": f"inferred_{src}_{tgt}",
                    "source": src,
                    "target": tgt,
                    "label": rel_label,
                    "weight": 1,
                    "animated": False,
                })

    file_hierarchy = build_nested_file_tree(files)

    top_counts = defaultdict(int)
    for p in files.keys():
        parts = PurePosixPath(p).parts
        root_folder = parts[0] if len(parts) > 1 else "root"
        top_counts[root_folder] += 1

    legacy_nodes = [{"id": "root", "label": "Repository", "type": "root"}]
    legacy_edges = []
    for i, (folder, count) in enumerate(sorted(top_counts.items(), key=lambda x: -x[1])[:12]):
        nid = f"folder-{i}"
        legacy_nodes.append({"id": nid, "label": folder, "type": "folder", "files": count})
        legacy_edges.append({"source": "root", "target": nid})

    incoming_map = defaultdict(list)
    outgoing_map = defaultdict(list)
    for (src, tgt), w in comp_edge_weights.items():
        if src in active_ids and tgt in active_ids:
            outgoing_map[src].append({"component_id": tgt, "weight": w})
            incoming_map[tgt].append({"component_id": src, "weight": w})

    components_summary = [
        {
            "id": c["id"],
            "name": c["name"],
            "layer": c["layer"],
            "file_count": c["file_count"],
            "total_lines": c["total_lines"],
            "technologies": sorted(c["technologies"]),
            "role": c["role"],
            "files": [{"path": f["path"], "lines": f["lines"]} for f in c["files"]],
            "sample_files": [f["path"] for f in c["files"][:10]],
            "symbols": c["symbols"][:10],
            "evidence_references": c["evidence_references"][:6],
            "incoming_connections": incoming_map.get(c["id"], []),
            "outgoing_connections": outgoing_map.get(c["id"], []),
            "coverage_status": "fully_analyzed" if c["file_count"] > 0 else "partially_analyzed",
        }
        for c in active_components
    ]

    return {
        "components": components_summary,
        "overview_nodes": overview_nodes,
        "overview_edges": overview_edges,
        "dependency_graph": dep_data,
        "file_hierarchy": file_hierarchy,
        "entry_points": entry_points,
        "technologies_detailed": technologies,
        # Backward compatibility
        "nodes": legacy_nodes,
        "edges": legacy_edges,
        "top_level": dict(top_counts),
        "ecosystem": [t["name"] for t in technologies],
    }
