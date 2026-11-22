"""
Question Quality Benchmark for RepoAutopsy CodeVitals 3.0 (Sprint 3).
Evaluates question validity rate, evidence grounding, scope accuracy,
and deduplication across 5 distinct repository architecture archetypes:
1. Full-Stack Web Application (RepoAutopsy archetype)
2. FastAPI Async Microservice
3. Next.js Frontend Monolith
4. Python Library / Utilities
5. Minimal CLI without Database
"""
import sys
import os
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))

from datetime import datetime
from app.models.analysis import Analysis
from app.models.finding import Finding
from app.services.codevitals_service import (
    build_repository_knowledge_model,
    get_assessable_components,
    generate_assessment_questions,
    validate_question,
    deduplicate_questions,
)


def create_profile_analysis(archetype: str) -> Analysis:
    """Creates realistic repository architectures for diverse benchmark archetypes."""
    if archetype == "fastapi_backend":
        analysis = Analysis(
            id="bench-fastapi",
            owner="fastapi-org",
            repo_name="FastAPIService",
            status="completed",
            summary="High-performance async REST API with Pydantic schemas and dependency injection.",
            languages={"Python": 95, "Dockerfile": 5},
            metrics={"total_files": 35, "code_lines": 4200},
            created_at=datetime.utcnow(),
            architecture={
                "components": [
                    {
                        "id": "comp-api-routes",
                        "name": "API Route Controllers",
                        "layer": "api",
                        "role": "Receives HTTP requests and dispatches to business services.",
                        "file_count": 8,
                        "total_lines": 1400,
                        "technologies": ["FastAPI", "Pydantic"],
                        "sample_files": ["app/api/v1/users.py", "app/api/v1/orders.py"],
                        "files": [{"path": "app/api/v1/users.py", "lines": 600}, {"path": "app/api/v1/orders.py", "lines": 800}],
                    },
                    {
                        "id": "comp-services",
                        "name": "Domain Service Logic",
                        "layer": "service",
                        "role": "Encapsulates order processing and billing business rules.",
                        "file_count": 6,
                        "total_lines": 1600,
                        "technologies": ["Python", "AsyncIO"],
                        "sample_files": ["app/services/billing.py", "app/services/user_mgr.py"],
                        "files": [{"path": "app/services/billing.py", "lines": 900}, {"path": "app/services/user_mgr.py", "lines": 700}],
                    },
                ],
                "overview_edges": [{"source": "comp-api-routes", "target": "comp-services", "label": "Invokes Logic"}],
                "dependency_graph": {"circular_dependencies": [], "external_packages": [{"package": "fastapi", "usage_count": 10}]},
            },
        )
    elif archetype == "nextjs_frontend":
        analysis = Analysis(
            id="bench-nextjs",
            owner="next-org",
            repo_name="NextStorefront",
            status="completed",
            summary="React-based Next.js App Router ecommerce frontend.",
            languages={"TypeScript": 85, "CSS": 15},
            metrics={"total_files": 45, "code_lines": 5800},
            created_at=datetime.utcnow(),
            architecture={
                "components": [
                    {
                        "id": "comp-frontend-pages",
                        "name": "App Router Page Views",
                        "layer": "presentation",
                        "role": "Renders React server components and dynamic client pages.",
                        "file_count": 14,
                        "total_lines": 2800,
                        "technologies": ["Next.js", "React", "TailwindCSS"],
                        "sample_files": ["app/catalog/page.tsx", "app/cart/page.tsx"],
                        "files": [{"path": "app/catalog/page.tsx", "lines": 800}, {"path": "app/cart/page.tsx", "lines": 600}],
                    },
                    {
                        "id": "comp-ui-components",
                        "name": "Reusable UI Components",
                        "layer": "presentation",
                        "role": "Modular buttons, modals, and product card primitives.",
                        "file_count": 16,
                        "total_lines": 2200,
                        "technologies": ["React", "Lucide"],
                        "sample_files": ["components/ProductCard.tsx", "components/Modal.tsx"],
                        "files": [{"path": "components/ProductCard.tsx", "lines": 400}],
                    },
                ],
                "overview_edges": [{"source": "comp-frontend-pages", "target": "comp-ui-components", "label": "Renders Components"}],
                "dependency_graph": {"circular_dependencies": [], "external_packages": [{"package": "next", "usage_count": 14}]},
            },
        )
    elif archetype == "python_library":
        analysis = Analysis(
            id="bench-lib",
            owner="pylib-org",
            repo_name="DataSanitizer",
            status="completed",
            summary="High-speed stream parsing and validation library with zero external dependencies.",
            languages={"Python": 100},
            metrics={"total_files": 18, "code_lines": 2100},
            created_at=datetime.utcnow(),
            architecture={
                "components": [
                    {
                        "id": "comp-core-parser",
                        "name": "Core Stream Parser",
                        "layer": "domain",
                        "role": "Extracts tokens from binary streams with zero copy allocations.",
                        "file_count": 5,
                        "total_lines": 1200,
                        "technologies": ["Python"],
                        "sample_files": ["sanitizer/parser.py", "sanitizer/lexer.py"],
                        "files": [{"path": "sanitizer/parser.py", "lines": 700}, {"path": "sanitizer/lexer.py", "lines": 500}],
                    },
                    {
                        "id": "comp-rules",
                        "name": "Validation Rule Engine",
                        "layer": "domain",
                        "role": "Applies sanitization and schema conformance checks.",
                        "file_count": 4,
                        "total_lines": 800,
                        "technologies": ["Python"],
                        "sample_files": ["sanitizer/rules.py"],
                        "files": [{"path": "sanitizer/rules.py", "lines": 800}],
                    },
                ],
                "overview_edges": [{"source": "comp-rules", "target": "comp-core-parser", "label": "Processes Tokens"}],
                "dependency_graph": {"circular_dependencies": [], "external_packages": []},
            },
        )
    elif archetype == "minimal_cli":
        analysis = Analysis(
            id="bench-cli",
            owner="cli-org",
            repo_name="RepoInspectorCLI",
            status="completed",
            summary="Lightweight command-line interface with no database requirements.",
            languages={"Python": 90, "Shell": 10},
            metrics={"total_files": 10, "code_lines": 950},
            created_at=datetime.utcnow(),
            architecture={
                "components": [
                    {
                        "id": "comp-cli-entry",
                        "name": "CLI Arguments & Dispatch",
                        "layer": "presentation",
                        "role": "Parses argv flags and executes console commands.",
                        "file_count": 3,
                        "total_lines": 450,
                        "technologies": ["Argparse"],
                        "sample_files": ["cli/main.py"],
                        "files": [{"path": "cli/main.py", "lines": 450}],
                    }
                ],
                "overview_edges": [],
                "dependency_graph": {"circular_dependencies": [], "external_packages": []},
            },
        )
    else:  # fullstack default (RepoAutopsy archetype)
        analysis = Analysis(
            id="bench-fullstack",
            owner="arshchauhan28",
            repo_name="RepoAutopsy",
            status="completed",
            summary="A comprehensive codebase intelligence and developer assessment platform.",
            languages={"Python": 45, "TypeScript": 40, "CSS": 15},
            metrics={"total_files": 65, "code_lines": 8200},
            created_at=datetime.utcnow(),
            architecture={
                "components": [
                    {
                        "id": "comp-api-routes",
                        "name": "API Routes & Endpoints",
                        "layer": "api",
                        "role": "Handles HTTP requests and route matching.",
                        "file_count": 8,
                        "total_lines": 1200,
                        "technologies": ["FastAPI", "Pydantic"],
                        "sample_files": ["backend/app/api/interviews.py", "backend/app/api/analyses.py"],
                        "files": [{"path": "backend/app/api/interviews.py", "lines": 650}, {"path": "backend/app/api/analyses.py", "lines": 350}],
                    },
                    {
                        "id": "comp-services",
                        "name": "Core Business Services",
                        "layer": "service",
                        "role": "Encapsulates assessment scoring, evaluation, and repository intelligence.",
                        "file_count": 6,
                        "total_lines": 2100,
                        "technologies": ["Python", "OpenAI"],
                        "sample_files": ["backend/app/services/codevitals_service.py", "backend/app/services/interview_service.py"],
                        "files": [{"path": "backend/app/services/codevitals_service.py", "lines": 1100}, {"path": "backend/app/services/interview_service.py", "lines": 400}],
                    },
                    {
                        "id": "comp-frontend-pages",
                        "name": "Frontend Pages & Routing",
                        "layer": "presentation",
                        "role": "Renders user-facing pages and handles navigation.",
                        "file_count": 12,
                        "total_lines": 2400,
                        "technologies": ["Next.js", "React"],
                        "sample_files": ["frontend/app/repositories/[id]/page.tsx"],
                        "files": [{"path": "frontend/app/repositories/[id]/page.tsx", "lines": 500}],
                    },
                    {
                        "id": "comp-data-models",
                        "name": "Data Models & Storage",
                        "layer": "data",
                        "role": "Defines database schemas and ORM entities.",
                        "file_count": 5,
                        "total_lines": 700,
                        "technologies": ["SQLAlchemy", "SQLite"],
                        "sample_files": ["backend/app/models/interview.py"],
                        "files": [{"path": "backend/app/models/interview.py", "lines": 300}],
                    },
                ],
                "overview_edges": [
                    {"source": "comp-frontend-pages", "target": "comp-api-routes", "label": "Dispatches Requests"},
                    {"source": "comp-api-routes", "target": "comp-services", "label": "Invokes Logic"},
                    {"source": "comp-services", "target": "comp-data-models", "label": "Queries & Persists"},
                ],
                "dependency_graph": {"circular_dependencies": [], "external_packages": [{"package": "fastapi", "usage_count": 12}]},
            },
        )
        analysis.findings = [
            Finding(
                id="f-bench-1",
                analysis_id=analysis.id,
                category="security",
                severity="high",
                title="Token check bypassed",
                description="Token validation missing in early endpoint",
                file_path="backend/app/api/interviews.py",
                line=42,
            )
        ]
    return analysis


def run_multi_repository_benchmark():
    archetypes = [
        "fullstack",
        "fastapi_backend",
        "nextjs_frontend",
        "python_library",
        "minimal_cli",
    ]

    benchmark_summary = {
        "archetypes_evaluated": len(archetypes),
        "total_generated": 0,
        "valid_questions": 0,
        "evidence_grounded": 0,
        "archetype_results": {},
        "types_distribution": {},
        "deduplication_stats": {},
    }

    for arch_name in archetypes:
        analysis = create_profile_analysis(arch_name)
        assessable = get_assessable_components(analysis)

        all_files = set()
        for c in assessable:
            all_files.update(c.get("all_files", []))
            all_files.update(c.get("sample_files", []))

        # Generate standard complete assessment
        questions = generate_assessment_questions(
            analysis=analysis,
            scope_type="complete",
            difficulty="intermediate",
            target_count=10,
        )

        valid_count = 0
        grounded_count = 0
        for q in questions:
            if validate_question(q, all_files):
                valid_count += 1
            if q.get("relevant_files") or q.get("evidence"):
                grounded_count += 1
            q_type = q.get("question_type", "unknown")
            benchmark_summary["types_distribution"][q_type] = benchmark_summary["types_distribution"].get(q_type, 0) + 1

        deduped = deduplicate_questions(questions)
        within_scope_dup_rate = round(1.0 - (len(deduped) / max(len(questions), 1)), 4)

        benchmark_summary["total_generated"] += len(questions)
        benchmark_summary["valid_questions"] += valid_count
        benchmark_summary["evidence_grounded"] += grounded_count
        benchmark_summary["archetype_results"][arch_name] = {
            "questions_generated": len(questions),
            "valid_rate": round(valid_count / max(len(questions), 1) * 100, 1),
            "within_scope_dedup_rate": f"{within_scope_dup_rate * 100}%",
        }

    benchmark_summary["overall_validity_rate"] = round(benchmark_summary["valid_questions"] / max(benchmark_summary["total_generated"], 1) * 100, 2)
    benchmark_summary["overall_grounding_rate"] = round(benchmark_summary["evidence_grounded"] / max(benchmark_summary["total_generated"], 1) * 100, 2)

    return benchmark_summary


if __name__ == "__main__":
    results = run_multi_repository_benchmark()
    print("==========================================================")
    print("CODEVITALS 3.0 MULTI-ARCHETYPE QUALITY BENCHMARK")
    print("==========================================================")
    print(f"Archetypes Evaluated: {results['archetypes_evaluated']}")
    print(f"Total Questions Evaluated: {results['total_generated']}")
    print(f"Overall Validity Rate: {results['overall_validity_rate']}%")
    print(f"Overall Evidence Grounding Rate: {results['overall_grounding_rate']}%")
    print(f"Question Formats Distribution: {results['types_distribution']}")
    print("Per-Archetype Breakdown:")
    for arch, stats in results["archetype_results"].items():
        print(f"  • {arch:20} -> Generated: {stats['questions_generated']:2d} | Valid: {stats['valid_rate']}% | Dedup Filter: {stats['within_scope_dedup_rate']}")
    print("==========================================================")
