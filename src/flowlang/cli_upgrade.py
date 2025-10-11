"""
FlowLang CLI - Upgrade Command

Update FlowLang package and migrate projects.
"""

import sys
import subprocess
import json
from typing import Optional, Dict, Any


def get_current_version() -> str:
    """Get currently installed FlowLang version"""
    try:
        from . import __version__
        return __version__
    except (ImportError, AttributeError):
        return "unknown"


def get_latest_version(include_pre: bool = False) -> Optional[str]:
    """Get latest available version from PyPI"""
    try:
        # Use pip to check for available versions
        result = subprocess.run(
            [sys.executable, '-m', 'pip', 'index', 'versions', 'flowlang'],
            capture_output=True,
            text=True,
            timeout=10
        )

        if result.returncode == 0:
            # Parse output to get latest version
            # Format: "flowlang (X.Y.Z)"
            lines = result.stdout.strip().split('\n')
            for line in lines:
                if 'Available versions:' in line:
                    versions_str = line.split('Available versions:')[1].strip()
                    versions = [v.strip() for v in versions_str.split(',')]

                    if include_pre:
                        return versions[0] if versions else None
                    else:
                        # Filter out pre-release versions (containing alpha, beta, rc, dev)
                        stable_versions = [
                            v for v in versions
                            if not any(pre in v.lower() for pre in ['a', 'b', 'rc', 'dev'])
                        ]
                        return stable_versions[0] if stable_versions else None

        return None

    except (subprocess.TimeoutExpired, subprocess.CalledProcessError, FileNotFoundError):
        return None


def check_for_updates(include_pre: bool = False) -> Dict[str, Any]:
    """Check if updates are available"""
    current = get_current_version()
    latest = get_latest_version(include_pre)

    return {
        'current_version': current,
        'latest_version': latest,
        'update_available': latest is not None and latest != current,
    }


def upgrade_flowlang(include_pre: bool = False) -> bool:
    """Upgrade FlowLang package"""
    try:
        cmd = [sys.executable, '-m', 'pip', 'install', '--upgrade', 'flowlang']

        if include_pre:
            cmd.append('--pre')

        print("📦 Upgrading FlowLang...\n")

        result = subprocess.run(
            cmd,
            check=True,
            text=True
        )

        return result.returncode == 0

    except subprocess.CalledProcessError:
        return False


def cmd_upgrade(args) -> int:
    """
    Upgrade FlowLang to the latest version.

    Checks PyPI for updates and installs the latest version.
    """
    try:
        # Check for updates
        if args.check:
            print("🔍 Checking for updates...\n")

            update_info = check_for_updates(include_pre=args.pre)

            current = update_info['current_version']
            latest = update_info['latest_version']

            print(f"Current version: {current}")

            if latest:
                print(f"Latest version:  {latest}")

                if update_info['update_available']:
                    print(f"\n✨ Update available: {current} → {latest}")
                    print("\nRun 'flowlang upgrade' to update")
                    return 0
                else:
                    print("\n✅ You are using the latest version")
                    return 0
            else:
                print("❌ Could not check for updates (PyPI unavailable)")
                return 1

        # Perform upgrade
        print("🔍 Checking for updates...\n")

        update_info = check_for_updates(include_pre=args.pre)
        current = update_info['current_version']
        latest = update_info['latest_version']

        print(f"Current version: {current}")

        if latest:
            print(f"Latest version:  {latest}")
        else:
            print("❌ Could not check for updates")
            print("\n💡 Tip: You can still try upgrading with:")
            print(f"   pip install --upgrade flowlang")
            return 1

        if not update_info['update_available']:
            print("\n✅ You are already using the latest version")
            return 0

        print(f"\n📦 Upgrading {current} → {latest}...")

        # Confirm upgrade
        response = input("\nProceed with upgrade? [Y/n]: ").strip().lower()
        if response and response != 'y':
            print("Cancelled.")
            return 0

        # Perform upgrade
        success = upgrade_flowlang(include_pre=args.pre)

        if success:
            print("\n✅ FlowLang upgraded successfully!")
            print(f"\n   {current} → {latest}")

            # Get new version
            try:
                # Reload the module to get updated version
                import importlib
                import flowlang
                importlib.reload(flowlang)
                new_version = getattr(flowlang, '__version__', 'unknown')
                print(f"\n   Current version: {new_version}")
            except:
                pass

            print("\n💡 Tip: Restart any running FlowLang servers to use the new version")
            return 0
        else:
            print("\n❌ Upgrade failed")
            print("\n💡 Tip: Try upgrading manually with:")
            print(f"   pip install --upgrade flowlang")
            return 1

    except KeyboardInterrupt:
        print("\n\nInterrupted by user")
        return 130
    except Exception as e:
        print(f"\n❌ Error: {e}", file=sys.stderr)
        if '--debug' in sys.argv:
            import traceback
            traceback.print_exc()
        return 1
