"""
FlowLang CLI - Doctor Command

Environment validation and health checks.
"""

import sys
import os
import subprocess
import importlib.util
from pathlib import Path
from typing import List, Tuple, Optional


class HealthCheck:
    """Individual health check result"""

    def __init__(self, name: str, passed: bool, message: str, fix: Optional[str] = None):
        self.name = name
        self.passed = passed
        self.message = message
        self.fix = fix


def check_python_version() -> HealthCheck:
    """Check Python version compatibility"""
    import sys

    version = sys.version_info
    min_version = (3, 8)

    if version >= min_version:
        return HealthCheck(
            name="Python Version",
            passed=True,
            message=f"Python {version.major}.{version.minor}.{version.micro} (OK)"
        )
    else:
        return HealthCheck(
            name="Python Version",
            passed=False,
            message=f"Python {version.major}.{version.minor} (requires >= 3.8)",
            fix="Install Python 3.8 or higher"
        )


def check_package_installed(package_name: str, import_name: Optional[str] = None) -> HealthCheck:
    """Check if a Python package is installed"""
    if import_name is None:
        import_name = package_name

    spec = importlib.util.find_spec(import_name)

    if spec is not None:
        return HealthCheck(
            name=f"Package: {package_name}",
            passed=True,
            message=f"{package_name} is installed"
        )
    else:
        return HealthCheck(
            name=f"Package: {package_name}",
            passed=False,
            message=f"{package_name} is not installed",
            fix=f"pip install {package_name}"
        )


def check_flowlang_installation() -> HealthCheck:
    """Check FlowLang installation"""
    try:
        import flowlang
        version = getattr(flowlang, '__version__', 'unknown')

        return HealthCheck(
            name="FlowLang Installation",
            passed=True,
            message=f"FlowLang {version} is installed"
        )
    except ImportError:
        return HealthCheck(
            name="FlowLang Installation",
            passed=False,
            message="FlowLang is not installed correctly",
            fix="pip install -e . (from FlowLang directory)"
        )


def check_git_available() -> HealthCheck:
    """Check if git is available"""
    try:
        result = subprocess.run(
            ['git', '--version'],
            capture_output=True,
            text=True,
            timeout=5
        )

        if result.returncode == 0:
            version = result.stdout.strip()
            return HealthCheck(
                name="Git",
                passed=True,
                message=f"{version}"
            )
        else:
            return HealthCheck(
                name="Git",
                passed=False,
                message="Git command failed",
                fix="Install git from https://git-scm.com"
            )
    except (subprocess.TimeoutExpired, FileNotFoundError):
        return HealthCheck(
            name="Git",
            passed=False,
            message="Git is not available",
            fix="Install git from https://git-scm.com"
        )


def check_virtual_environment() -> HealthCheck:
    """Check if running in a virtual environment"""
    in_venv = hasattr(sys, 'real_prefix') or (
        hasattr(sys, 'base_prefix') and sys.base_prefix != sys.prefix
    )

    if in_venv:
        return HealthCheck(
            name="Virtual Environment",
            passed=True,
            message="Running in a virtual environment"
        )
    else:
        return HealthCheck(
            name="Virtual Environment",
            passed=False,
            message="Not running in a virtual environment (recommended)",
            fix="python -m venv myenv && source myenv/bin/activate"
        )


def check_templates_directory() -> HealthCheck:
    """Check if templates directory exists"""
    try:
        from .templates import TemplateManager

        manager = TemplateManager()
        templates = manager.list_templates()

        if templates:
            # templates is a list of dicts with 'name' key
            template_names = [t['name'] for t in templates]
            return HealthCheck(
                name="Templates",
                passed=True,
                message=f"Found {len(templates)} template(s): {', '.join(template_names)}"
            )
        else:
            return HealthCheck(
                name="Templates",
                passed=False,
                message="No templates found",
                fix="Check FlowLang installation"
            )
    except Exception as e:
        return HealthCheck(
            name="Templates",
            passed=False,
            message=f"Template system error: {e}",
            fix="Reinstall FlowLang"
        )


def run_health_checks(verbose: bool = False) -> List[HealthCheck]:
    """Run all health checks"""
    checks = [
        check_python_version(),
        check_flowlang_installation(),
        check_virtual_environment(),
        check_git_available(),
        check_templates_directory(),
    ]

    # Core dependencies
    core_packages = [
        ('pyyaml', 'yaml'),
        ('fastapi', 'fastapi'),
        ('uvicorn', 'uvicorn'),
        ('pydantic', 'pydantic'),
    ]

    for package_name, import_name in core_packages:
        checks.append(check_package_installed(package_name, import_name))

    return checks


def attempt_fixes(checks: List[HealthCheck]) -> int:
    """Attempt to automatically fix common issues"""
    fixed_count = 0
    failed_fixes = []

    print("\n🔧 Attempting automatic fixes...\n")

    for check in checks:
        if not check.passed and check.fix:
            # Only attempt to fix missing packages
            if "pip install" in check.fix and "pip install -e" not in check.fix:
                package = check.fix.replace("pip install ", "").strip()
                print(f"Installing {package}...")

                try:
                    subprocess.run(
                        [sys.executable, '-m', 'pip', 'install', package],
                        check=True,
                        capture_output=True
                    )
                    print(f"  ✅ {package} installed successfully")
                    fixed_count += 1
                except subprocess.CalledProcessError as e:
                    print(f"  ❌ Failed to install {package}")
                    failed_fixes.append(package)

    print(f"\n✅ Fixed {fixed_count} issue(s)")

    if failed_fixes:
        print(f"❌ Failed to fix {len(failed_fixes)} issue(s): {', '.join(failed_fixes)}")

    return fixed_count


def cmd_doctor(args) -> int:
    """
    Check FlowLang environment and installation.

    Validates Python version, dependencies, and configuration.
    """
    try:
        print("🩺 FlowLang Environment Check\n")

        checks = run_health_checks(verbose=args.verbose)

        # Print results
        passed = 0
        failed = 0

        for check in checks:
            if check.passed:
                icon = "✅"
                passed += 1
            else:
                icon = "❌"
                failed += 1

            print(f"{icon} {check.name}")

            if args.verbose or not check.passed:
                print(f"   {check.message}")

            if not check.passed and check.fix and not args.fix:
                print(f"   Fix: {check.fix}")

            if args.verbose or not check.passed:
                print()

        # Summary
        total = len(checks)
        print(f"\n📊 Summary: {passed}/{total} checks passed")

        if failed > 0:
            print(f"   {failed} issue(s) found")

            # Attempt fixes if requested
            if args.fix:
                fixed = attempt_fixes(checks)

                if fixed > 0:
                    print("\n🔄 Re-running health checks...\n")
                    # Re-run checks
                    return cmd_doctor(args)
            else:
                print("\n💡 Tip: Run 'flowlang doctor --fix' to attempt automatic fixes")

            return 1
        else:
            print("   All checks passed! 🎉")
            return 0

    except KeyboardInterrupt:
        print("\n\nInterrupted by user")
        return 130
    except Exception as e:
        print(f"\n❌ Error: {e}", file=sys.stderr)
        if args.verbose or '--debug' in sys.argv:
            import traceback
            traceback.print_exc()
        return 1
