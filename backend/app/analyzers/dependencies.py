from __future__ import annotations

import ast
import os
import re
from collections import defaultdict
from pathlib import PurePosixPath

JS_TS_EXTENSIONS = {".js", ".jsx", ".ts", ".tsx", ".mjs", ".cjs"}
RESOLVE_EXTENSIONS = ["", ".ts", ".tsx", ".js", ".jsx", ".mjs", ".cjs", "/index.ts", "/index.tsx", "/index.js", "/index.jsx"]

# JS/TS import regexes
JS_IMPORT_RE = re.compile(
    r"""(?:import\s+(?:[\w*\s{},$]+\s+from\s+)?['"]([^'"]+)['"]|export\s+(?:[\w*\s{},$]+\s+from\s+)['"]([^'"]+)['"]|require\(\s*['"]([^'"]+)['"]\s*\)|import\(\s*['"]([^'"]+)['"]\s*\))""",
    re.MULTILINE,
)


def _normalize_path(p: str) -> str:
    return str(PurePosixPath(p)).replace("\\", "/")


def extract_python_imports(file_path: str, content: str) -> list[tuple[str, bool]]:
    """
    Extract imports from Python code using AST.
    Returns list of (imported_name, is_relative).
    """
    imports: list[tuple[str, bool]] = []
    try:
        tree = ast.parse(content, filename=file_path)
    except Exception:
        # Fallback to regex if syntax error (e.g. invalid syntax or different Python version)
        for line in content.splitlines():
            line_str = line.strip()
            if line_str.startswith("import "):
                parts = line_str[7:].split(",")
                for p in parts:
                    name = p.strip().split()[0].split(".")[0]
                    if name:
                        imports.append((name, False))
            elif line_str.startswith("from "):
                match = re.match(r"^from\s+(\.*[\w.]*)\s+import", line_str)
                if match:
                    mod = match.group(1)
                    imports.append((mod, mod.startswith(".")))
        return imports

    for node in ast.walk(tree):
        if isinstance(node, ast.Import):
            for alias in node.names:
                imports.append((alias.name, False))
        elif isinstance(node, ast.ImportFrom):
            mod = node.module or ""
            if node.level and node.level > 0:
                dots = "." * node.level
                imports.append((f"{dots}{mod}", True))
            elif mod:
                imports.append((mod, False))
    return imports


def extract_js_imports(content: str) -> list[str]:
    """
    Extract imported specifiers from JavaScript/TypeScript code.
    """
    imports: list[str] = []
    # Strip comments to avoid false positives in documentation
    cleaned = re.sub(r"/\*[\s\S]*?\*/", "", content)
    cleaned = re.sub(r"//.*$", "", cleaned, flags=re.MULTILINE)

    for match in JS_IMPORT_RE.finditer(cleaned):
        specifier = match.group(1) or match.group(2) or match.group(3) or match.group(4)
        if specifier:
            imports.append(specifier.strip())
    return imports


def resolve_python_import(source_path: str, mod_name: str, all_files: set[str]) -> str | None:
    """
    Resolve a Python import to a file in all_files, or return None if external/standard library.
    """
    source_dir = str(PurePosixPath(source_path).parent)
    if source_dir == ".":
        source_dir = ""

    # Relative import
    if mod_name.startswith("."):
        dots_match = re.match(r"^(\.+)(.*)", mod_name)
        if not dots_match:
            return None
        dots, rest = dots_match.groups()
        level = len(dots)

        curr_parts = PurePosixPath(source_path).parts[:-1]
        steps_up = level - 1
        if steps_up > len(curr_parts):
            return None
        target_dir_parts = curr_parts[:len(curr_parts) - steps_up] if steps_up > 0 else curr_parts
        base_dir = "/".join(target_dir_parts)

        sub_parts = rest.split(".") if rest else []
        target_path_base = f"{base_dir}/{'/'.join(sub_parts)}".strip("/")
    else:
        # Absolute import within project or top-level package
        sub_parts = mod_name.split(".")
        target_path_base = "/".join(sub_parts)

    candidates = [
        f"{target_path_base}.py",
        f"{target_path_base}/__init__.py",
    ]

    for cand in candidates:
        cand_norm = _normalize_path(cand)
        if cand_norm in all_files:
            return cand_norm

    # Check if target is inside a known top-level folder like backend/ or src/
    for prefix in ["backend", "src", "app"]:
        for cand in candidates:
            cand_pre = _normalize_path(f"{prefix}/{cand}")
            if cand_pre in all_files:
                return cand_pre

    # Check matching by suffix
    for cand in candidates:
        cand_suffix = "/" + cand.strip("/")
        for f in all_files:
            if f.endswith(cand_suffix):
                return f

    return None


def resolve_js_import(source_path: str, specifier: str, all_files: set[str]) -> str | None:
    """
    Resolve a JS/TS specifier to an internal file in all_files.
    """
    source_dir = str(PurePosixPath(source_path).parent)
    if source_dir == ".":
        source_dir = ""

    target_norm: str | None = None

    if specifier.startswith("./") or specifier.startswith("../"):
        # Relative path
        combined = PurePosixPath(source_dir) / specifier
        parts = []
        for part in combined.parts:
            if part == ".":
                continue
            if part == "..":
                if parts:
                    parts.pop()
            else:
                parts.append(part)
        target_norm = "/".join(parts)
    elif specifier.startswith("@/"):
        # Path alias e.g. @/components/Button
        rest = specifier[2:]
        # Check direct or inside frontend / src
        prefixes = ["", "frontend/", "src/", "frontend/src/"]
        for p in prefixes:
            for ext in RESOLVE_EXTENSIONS:
                cand = _normalize_path(f"{p}{rest}{ext}")
                if cand in all_files:
                    return cand
        return None
    elif specifier.startswith("~"):
        rest = specifier.lstrip("~").lstrip("/")
        for ext in RESOLVE_EXTENSIONS:
            cand = _normalize_path(f"{rest}{ext}")
            if cand in all_files:
                return cand
        return None

    if target_norm:
        for ext in RESOLVE_EXTENSIONS:
            cand = _normalize_path(f"{target_norm}{ext}")
            if cand in all_files:
                return cand

    return None


def find_cycles(adj: dict[str, set[str]]) -> list[list[str]]:
    """
    Find circular dependencies in a directed graph using DFS.
    Returns list of cycle paths (e.g. ['a', 'b', 'c', 'a']).
    """
    cycles: list[list[str]] = []
    visited: set[str] = set()
    rec_stack: list[str] = []
    rec_set: set[str] = set()
    seen_cycle_fingerprints: set[str] = set()

    def dfs(node: str):
        visited.add(node)
        rec_stack.append(node)
        rec_set.add(node)

        for neighbor in sorted(adj.get(node, [])):
            if neighbor not in visited:
                dfs(neighbor)
            elif neighbor in rec_set:
                # Cycle found!
                cycle_start = rec_stack.index(neighbor)
                cycle = rec_stack[cycle_start:] + [neighbor]
                # Normalize cycle to prevent duplicate rotations
                nodes_in_cycle = cycle[:-1]
                if len(nodes_in_cycle) > 1:
                    min_idx = nodes_in_cycle.index(min(nodes_in_cycle))
                    rotated = nodes_in_cycle[min_idx:] + nodes_in_cycle[:min_idx]
                    fingerprint = "->".join(rotated)
                    if fingerprint not in seen_cycle_fingerprints:
                        seen_cycle_fingerprints.add(fingerprint)
                        cycles.append(cycle)

        rec_stack.pop()
        rec_set.remove(node)

    for n in sorted(adj.keys()):
        if n not in visited:
            dfs(n)

    return cycles


def analyze_dependencies(files: dict[str, str]) -> dict:
    """
    Analyze internal and external dependencies across all code files in the repository.
    Produces nodes, edges, cycle detection, and external package summaries.
    """
    all_files = set(files.keys())
    internal_adj: dict[str, set[str]] = defaultdict(set)
    external_deps: dict[str, set[str]] = defaultdict(set)  # pkg -> set of files using it
    raw_edges: list[dict] = []

    file_meta: dict[str, dict] = {}
    for path, content in files.items():
        suffix = PurePosixPath(path).suffix.lower()
        lines = content.count("\n") + (1 if content else 0)
        file_meta[path] = {
            "path": path,
            "lines": lines,
            "ext": suffix,
        }

        # Python
        if suffix == ".py":
            imports = extract_python_imports(path, content)
            for mod_name, is_rel in imports:
                resolved = resolve_python_import(path, mod_name, all_files)
                if resolved and resolved != path:
                    internal_adj[path].add(resolved)
                    raw_edges.append({
                        "source": path,
                        "target": resolved,
                        "import_name": mod_name,
                        "is_external": False,
                    })
                elif not is_rel:
                    top_pkg = mod_name.split(".")[0]
                    # Filter Python stdlib common modules
                    if top_pkg not in {"sys", "os", "re", "json", "time", "math", "datetime", "typing", "collections", "pathlib", "uuid", "io", "copy", "itertools", "functools", "enum", "dataclasses", "abc", "contextlib", "hashlib", "logging", "shutil", "tempfile", "traceback", "subprocess", "unittest", "threading", "asyncio"}:
                        external_deps[top_pkg].add(path)

        # JavaScript / TypeScript
        elif suffix in JS_TS_EXTENSIONS:
            specifiers = extract_js_imports(content)
            for spec in specifiers:
                resolved = resolve_js_import(path, spec, all_files)
                if resolved and resolved != path:
                    internal_adj[path].add(resolved)
                    raw_edges.append({
                        "source": path,
                        "target": resolved,
                        "import_name": spec,
                        "is_external": False,
                    })
                elif not spec.startswith(".") and not spec.startswith("/") and not spec.startswith("@/"):
                    # External package (e.g. react, lodash, @xyflow/react)
                    pkg_name = spec if not spec.startswith("@") else "/".join(spec.split("/")[:2])
                    pkg_name = pkg_name.split("/")[0] if not spec.startswith("@") else pkg_name
                    external_deps[pkg_name].add(path)

    # Detect cycles
    cycles = find_cycles(internal_adj)
    circular_nodes: set[str] = {node for cycle in cycles for node in cycle}

    # Calculate degrees
    in_degree: dict[str, int] = defaultdict(int)
    out_degree: dict[str, int] = defaultdict(int)
    for src, targets in internal_adj.items():
        out_degree[src] += len(targets)
        for tgt in targets:
            in_degree[tgt] += 1

    # Format nodes
    nodes: list[dict] = []
    # Active internal files (files that have dependencies or are depended upon)
    active_internal = set(internal_adj.keys()) | {tgt for targets in internal_adj.values() for tgt in targets}

    for path in sorted(active_internal):
        meta = file_meta.get(path, {"lines": 0, "ext": ""})
        nodes.append({
            "id": path,
            "label": PurePosixPath(path).name,
            "path": path,
            "type": "internal",
            "lines": meta["lines"],
            "extension": meta["ext"],
            "in_degree": in_degree[path],
            "out_degree": out_degree[path],
            "is_circular": path in circular_nodes,
        })

    # External nodes
    for pkg, using_files in sorted(external_deps.items(), key=lambda x: len(x[1]), reverse=True)[:30]:
        nodes.append({
            "id": f"ext:{pkg}",
            "label": pkg,
            "path": f"ext:{pkg}",
            "type": "external",
            "usage_count": len(using_files),
            "in_degree": len(using_files),
            "out_degree": 0,
            "is_circular": False,
        })
        for uf in sorted(using_files)[:10]:  # Link top users
            raw_edges.append({
                "source": uf,
                "target": f"ext:{pkg}",
                "import_name": pkg,
                "is_external": True,
            })

    # Deduplicate edges
    seen_edges: set[tuple[str, str]] = set()
    edges: list[dict] = []
    for e in raw_edges:
        key = (e["source"], e["target"])
        if key not in seen_edges:
            seen_edges.add(key)
            edges.append({
                "id": f"e_{len(edges)}",
                "source": e["source"],
                "target": e["target"],
                "import_name": e.get("import_name"),
                "is_external": e["is_external"],
                "is_circular": e["source"] in circular_nodes and e["target"] in circular_nodes,
            })

    external_packages_summary = [
        {"package": pkg, "usage_count": len(files_set)}
        for pkg, files_set in sorted(external_deps.items(), key=lambda x: len(x[1]), reverse=True)
    ]

    # Build grouped modules summary for Mode 1 (Module Overview)
    groups_map: dict[str, dict] = {}
    file_to_group: dict[str, str] = {}

    for path in sorted(active_internal):
        parts = PurePosixPath(path).parts
        if len(parts) >= 3 and parts[0] in {"backend", "frontend", "src"}:
            group_name = f"{parts[0]}/{parts[1]}"
            if parts[1] == "app" and len(parts) >= 4:
                group_name = f"{parts[0]}/{parts[1]}/{parts[2]}"
        elif len(parts) >= 2:
            group_name = f"{parts[0]}/{parts[1]}"
        else:
            group_name = "root"

        file_to_group[path] = group_name
        if group_name not in groups_map:
            groups_map[group_name] = {
                "id": f"grp:{group_name}",
                "name": group_name,
                "path": group_name,
                "modules": [],
                "lines": 0,
                "external_packages": set(),
                "in_degree": 0,
                "out_degree": 0,
            }
        meta = file_meta.get(path, {"lines": 0})
        groups_map[group_name]["modules"].append(path)
        groups_map[group_name]["lines"] += meta["lines"]

    # Record external packages per group
    for pkg, using_files in external_deps.items():
        for uf in using_files:
            grp = file_to_group.get(uf)
            if grp and grp in groups_map:
                groups_map[grp]["external_packages"].add(pkg)

    # Inter-group edges
    group_edge_weights: dict[tuple[str, str], int] = defaultdict(int)
    for edge in raw_edges:
        if edge.get("is_external"):
            continue
        src = edge["source"]
        tgt = edge["target"]
        g_src = file_to_group.get(src)
        g_tgt = file_to_group.get(tgt)
        if g_src and g_tgt and g_src != g_tgt:
            group_edge_weights[(g_src, g_tgt)] += 1
            if g_src in groups_map:
                groups_map[g_src]["out_degree"] += 1
            if g_tgt in groups_map:
                groups_map[g_tgt]["in_degree"] += 1

    grouped_nodes = [
        {
            "id": g["id"],
            "label": g["name"],
            "path": g["path"],
            "module_count": len(g["modules"]),
            "lines": g["lines"],
            "modules": sorted(g["modules"]),
            "external_packages": sorted(g["external_packages"]),
            "in_degree": g["in_degree"],
            "out_degree": g["out_degree"],
        }
        for g in sorted(groups_map.values(), key=lambda x: -len(x["modules"]))
    ]

    grouped_edges = [
        {
            "id": f"grp_e_{src}_{tgt}",
            "source": f"grp:{src}",
            "target": f"grp:{tgt}",
            "weight": weight,
            "label": f"{weight} link{'s' if weight > 1 else ''}",
        }
        for (src, tgt), weight in group_edge_weights.items()
    ]

    return {
        "nodes": nodes,
        "edges": edges,
        "grouped_modules": {
            "groups": grouped_nodes,
            "edges": grouped_edges,
        },
        "circular_dependencies": cycles,
        "external_packages": external_packages_summary[:50],
        "summary": {
            "internal_modules_count": len(active_internal),
            "external_packages_count": len(external_deps),
            "total_dependencies_count": len(edges),
            "circular_cycles_count": len(cycles),
        },
    }

