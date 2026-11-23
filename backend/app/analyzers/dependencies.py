from __future__ import annotations

import ast
import json
import re
from collections import defaultdict
from pathlib import PurePosixPath
from app.analyzers.classifier import classify_file

JS_TS_EXTENSIONS = {".js", ".jsx", ".ts", ".tsx", ".mjs", ".cjs", ".mts", ".cts"}
RESOLVE_EXTENSIONS = ["", ".ts", ".tsx", ".js", ".jsx", ".mjs", ".cjs", "/index.ts", "/index.tsx", "/index.js", "/index.jsx"]

JS_IMPORT_RE = re.compile(
    r"""(?:import\s+(?:[\w*\s{},$]+\s+from\s+)?['"]([^'"]+)['"]|export\s+(?:[\w*\s{},$]+\s+from\s+)['"]([^'"]+)['"]|require\(\s*['"]([^'"]+)['"]\s*\)|import\(\s*['"]([^'"]+)['"]\s*\))""",
    re.MULTILINE,
)

PYTHON_STDLIB_MODULES = {
    "sys", "os", "re", "json", "time", "math", "datetime", "typing",
    "collections", "pathlib", "uuid", "io", "copy", "itertools",
    "functools", "enum", "dataclasses", "abc", "contextlib", "hashlib",
    "logging", "shutil", "tempfile", "traceback", "subprocess", "unittest",
    "threading", "asyncio", "socket", "urllib", "http", "email", "secrets",
    "random", "sqlite3", "csv", "xml", "html", "inspect", "typing_extensions",
    "weakref", "warnings", "zipfile", "tarfile", "gzip", "glob", "fnmatch",
    "platform", "signal", "errno", "operator", "base64", "binascii",
}


def _normalize_path(p: str) -> str:
    return str(PurePosixPath(p)).replace("\\", "/")


def extract_tsconfig_aliases(files: dict[str, str]) -> dict[str, str]:
    """
    Extracts TypeScript / JavaScript path aliases from tsconfig.json or jsconfig.json.
    Returns prefix -> target_prefix mapping (e.g. "@/*" -> "src/*" or "@components/*" -> "components/*").
    """
    aliases: dict[str, str] = {}
    for cfg_name in ["tsconfig.json", "jsconfig.json", "frontend/tsconfig.json", "frontend/jsconfig.json"]:
        if cfg_name in files:
            content = files[cfg_name]
            # Strip comments
            cleaned = re.sub(r"/\*[\s\S]*?\*/", "", content)
            cleaned = re.sub(r"//.*$", "", cleaned, flags=re.MULTILINE)
            # Remove trailing commas before closing braces
            cleaned = re.sub(r",\s*([}\]])", r"\1", cleaned)
            try:
                data = json.loads(cleaned)
                compiler_opts = data.get("compilerOptions", {})
                base_url = compiler_opts.get("baseUrl", "").strip("./")
                paths = compiler_opts.get("paths", {})
                prefix_root = str(PurePosixPath(cfg_name).parent).replace("\\", "/")
                if prefix_root == ".":
                    prefix_root = ""

                for alias_pat, target_list in paths.items():
                    if target_list and isinstance(target_list, list):
                        target_pat = target_list[0].lstrip("./")
                        # Combine with baseUrl and prefix_root
                        full_target = f"{prefix_root}/{base_url}/{target_pat}".strip("/")
                        full_target = re.sub(r"/+", "/", full_target)
                        aliases[alias_pat] = full_target
            except Exception:
                continue
    return aliases


def extract_python_imports(file_path: str, content: str) -> list[tuple[str, str, bool, int]]:
    """
    Extract imports from Python code using AST.
    Returns list of (module_name, imported_symbol, is_relative, level).
    """
    imports: list[tuple[str, str, bool, int]] = []
    try:
        tree = ast.parse(content, filename=file_path)
    except Exception:
        # Fallback to regex if syntax error
        for line in content.splitlines():
            line_str = line.strip()
            if line_str.startswith("import "):
                parts = line_str[7:].split(",")
                for p in parts:
                    name = p.strip().split()[0].split(".")[0]
                    if name:
                        imports.append((name, "", False, 0))
            elif line_str.startswith("from "):
                match = re.match(r"^from\s+(\.*[\w.]*)\s+import\s+([\w*,\s]+)", line_str)
                if match:
                    mod = match.group(1)
                    dots_match = re.match(r"^(\.+)", mod)
                    level = len(dots_match.group(1)) if dots_match else 0
                    symbols = [s.strip().split()[0] for s in match.group(2).split(",") if s.strip()]
                    for sym in symbols:
                        imports.append((mod, sym, level > 0, level))
        return imports

    for node in ast.walk(tree):
        if isinstance(node, ast.Import):
            for alias in node.names:
                imports.append((alias.name, "", False, 0))
        elif isinstance(node, ast.ImportFrom):
            mod = node.module or ""
            level = node.level or 0
            if node.names:
                for alias in node.names:
                    imports.append((mod, alias.name, level > 0, level))
            else:
                imports.append((mod, "", level > 0, level))
    return imports


def extract_js_imports(content: str) -> list[str]:
    """
    Extract imported specifiers from JavaScript/TypeScript code.
    """
    imports: list[str] = []
    cleaned = re.sub(r"/\*[\s\S]*?\*/", "", content)
    cleaned = re.sub(r"//.*$", "", cleaned, flags=re.MULTILINE)

    for match in JS_IMPORT_RE.finditer(cleaned):
        specifier = match.group(1) or match.group(2) or match.group(3) or match.group(4)
        if specifier:
            imports.append(specifier.strip())
    return imports


def resolve_python_import(
    source_path: str,
    mod_name: str,
    symbol: str,
    is_rel: bool,
    level: int,
    all_files: set[str],
) -> str | None:
    """
    Accurately resolve a Python import to a file in all_files.
    Tries submodule first (mod_name.symbol), then base module (mod_name).
    """
    source_dir_parts = list(PurePosixPath(source_path).parts[:-1])

    candidates = []

    # 1. Relative import
    if is_rel or level > 0:
        steps_up = max(0, level - 1)
        if steps_up > len(source_dir_parts):
            return None
        target_dir_parts = source_dir_parts[:len(source_dir_parts) - steps_up] if steps_up > 0 else source_dir_parts
        base_dir = "/".join(target_dir_parts)

        sub_parts = mod_name.lstrip(".").split(".") if mod_name.lstrip(".") else []
        target_path_base = f"{base_dir}/{'/'.join(sub_parts)}".strip("/")

        # Check submodule with symbol
        if symbol and symbol != "*":
            candidates.append(f"{target_path_base}/{symbol}.py")
            candidates.append(f"{target_path_base}/{symbol}/__init__.py")
        candidates.append(f"{target_path_base}.py")
        candidates.append(f"{target_path_base}/__init__.py")

    else:
        # 2. Absolute import
        sub_parts = mod_name.split(".") if mod_name else []
        target_path_base = "/".join(sub_parts)

        if symbol and symbol != "*":
            candidates.append(f"{target_path_base}/{symbol}.py")
            candidates.append(f"{target_path_base}/{symbol}/__init__.py")
        candidates.append(f"{target_path_base}.py")
        candidates.append(f"{target_path_base}/__init__.py")

    # Match candidates directly
    for cand in candidates:
        cand_norm = _normalize_path(cand)
        if cand_norm in all_files:
            return cand_norm

    # Check common project prefixes (e.g. backend/, src/, app/)
    for prefix in ["backend", "src", "app", "frontend"]:
        for cand in candidates:
            cand_pre = _normalize_path(f"{prefix}/{cand}")
            if cand_pre in all_files:
                return cand_pre

    # Check relative to root directory matching suffix
    for cand in candidates:
        cand_suffix = "/" + cand.strip("/")
        for f in all_files:
            if f.endswith(cand_suffix):
                return f

    return None


def resolve_js_import(
    source_path: str,
    specifier: str,
    all_files: set[str],
    tsconfig_aliases: dict[str, str],
) -> str | None:
    """
    Resolve a JS/TS specifier to an internal file in all_files.
    Handles relative paths, index files, and tsconfig path aliases.
    """
    source_dir = str(PurePosixPath(source_path).parent)
    if source_dir == ".":
        source_dir = ""

    target_norm: str | None = None

    if specifier.startswith("./") or specifier.startswith("../"):
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

    else:
        # Check tsconfig aliases
        for alias_pat, target_pat in tsconfig_aliases.items():
            if alias_pat.endswith("/*") and specifier.startswith(alias_pat[:-2] + "/"):
                sub_spec = specifier[len(alias_pat[:-2]) + 1:]
                base_target = target_pat[:-2]
                candidate_base = f"{base_target}/{sub_spec}"
                for ext in RESOLVE_EXTENSIONS:
                    cand = _normalize_path(f"{candidate_base}{ext}")
                    if cand in all_files:
                        return cand
            elif alias_pat == specifier:
                for ext in RESOLVE_EXTENSIONS:
                    cand = _normalize_path(f"{target_pat}{ext}")
                    if cand in all_files:
                        return cand

        # Standard @/ or ~ fallback
        if specifier.startswith("@/"):
            rest = specifier[2:]
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


def classify_relationship_type(source_path: str, target_path: str) -> str:
    """
    Classify semantic relationship type between two dependent files.
    """
    src_lower = source_path.lower()
    tgt_lower = target_path.lower()

    if any(k in src_lower for k in ["api", "route", "endpoint", "controller"]):
        if any(k in tgt_lower for k in ["service", "manager", "logic"]):
            return "route-to-handler"
        if any(k in tgt_lower for k in ["model", "schema", "entity"]):
            return "route-to-schema"

    if any(k in src_lower for k in ["service", "logic", "usecase"]):
        if any(k in tgt_lower for k in ["model", "schema", "db", "database"]):
            return "service-to-model"
        if any(k in tgt_lower for k in ["client", "integration", "adapter"]):
            return "service-to-client"

    if any(k in src_lower for k in ["test", "spec"]):
        return "test-dependency"

    if PurePosixPath(source_path).parent == PurePosixPath(target_path).parent:
        return "internal-module"

    return "imports"


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
                cycle_start = rec_stack.index(neighbor)
                cycle = rec_stack[cycle_start:] + [neighbor]
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
    Produces nodes, edges with relationship semantics, cycle detection, and external package summaries.
    """
    all_files = set(files.keys())
    tsconfig_aliases = extract_tsconfig_aliases(files)

    internal_adj: dict[str, set[str]] = defaultdict(set)
    external_deps: dict[str, set[str]] = defaultdict(set)
    raw_edges: list[dict] = []

    file_meta: dict[str, dict] = {}
    for path, content in files.items():
        suffix = PurePosixPath(path).suffix.lower()
        lines = content.count("\n") + (1 if content else 0)
        file_meta[path] = {
            "path": path,
            "lines": lines,
            "ext": suffix,
            "category": classify_file(path),
        }

        # Python
        if suffix == ".py":
            imports = extract_python_imports(path, content)
            for mod_name, symbol, is_rel, level in imports:
                resolved = resolve_python_import(path, mod_name, symbol, is_rel, level, all_files)
                if resolved and resolved != path:
                    internal_adj[path].add(resolved)
                    rel_type = classify_relationship_type(path, resolved)
                    raw_edges.append({
                        "source": path,
                        "target": resolved,
                        "import_name": f"{mod_name}.{symbol}" if symbol else mod_name,
                        "relationship_type": rel_type,
                        "is_external": False,
                    })
                elif not is_rel and mod_name:
                    top_pkg = mod_name.split(".")[0]
                    if top_pkg and top_pkg not in PYTHON_STDLIB_MODULES:
                        external_deps[top_pkg].add(path)

        # JavaScript / TypeScript
        elif suffix in JS_TS_EXTENSIONS:
            specifiers = extract_js_imports(content)
            for spec in specifiers:
                resolved = resolve_js_import(path, spec, all_files, tsconfig_aliases)
                if resolved and resolved != path:
                    internal_adj[path].add(resolved)
                    rel_type = classify_relationship_type(path, resolved)
                    raw_edges.append({
                        "source": path,
                        "target": resolved,
                        "import_name": spec,
                        "relationship_type": rel_type,
                        "is_external": False,
                    })
                elif not spec.startswith(".") and not spec.startswith("/") and not spec.startswith("@/"):
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
    active_internal = set(internal_adj.keys()) | {tgt for targets in internal_adj.values() for tgt in targets}

    for path in sorted(active_internal):
        meta = file_meta.get(path, {"lines": 0, "ext": "", "category": "unknown"})
        nodes.append({
            "id": path,
            "label": PurePosixPath(path).name,
            "path": path,
            "type": "internal",
            "category": meta["category"],
            "lines": meta["lines"],
            "extension": meta["ext"],
            "in_degree": in_degree[path],
            "out_degree": out_degree[path],
            "is_circular": path in circular_nodes,
        })

    # External nodes
    for pkg, using_files in sorted(external_deps.items(), key=lambda x: len(x[1]), reverse=True)[:35]:
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
        for uf in sorted(using_files)[:8]:
            raw_edges.append({
                "source": uf,
                "target": f"ext:{pkg}",
                "import_name": pkg,
                "relationship_type": "external-dependency",
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
                "relationship_type": e.get("relationship_type", "imports"),
                "is_external": e["is_external"],
                "is_circular": e["source"] in circular_nodes and e["target"] in circular_nodes,
            })

    external_packages_summary = [
        {"package": pkg, "usage_count": len(files_set)}
        for pkg, files_set in sorted(external_deps.items(), key=lambda x: len(x[1]), reverse=True)
    ]

    # Build grouped modules summary
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

    for pkg, using_files in external_deps.items():
        for uf in using_files:
            grp = file_to_group.get(uf)
            if grp and grp in groups_map:
                groups_map[grp]["external_packages"].add(pkg)

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
