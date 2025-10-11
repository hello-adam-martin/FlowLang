"""
FlowLang CLI - Version Command

Display version and environment information.
"""

import sys
import json
import platform
from typing import Dict, Any


def get_version_info() -> Dict[str, Any]:
    """Get comprehensive version information"""
    try:
        from . import __version__
        flowlang_version = __version__
    except (ImportError, AttributeError):
        flowlang_version = "unknown"

    return {
        'flowlang_version': flowlang_version,
        'python_version': platform.python_version(),
        'python_implementation': platform.python_implementation(),
        'platform': platform.platform(),
        'architecture': platform.machine(),
    }


def cmd_version(args) -> int:
    """
    Display version information.

    Shows FlowLang version along with Python and platform details.
    """
    try:
        info = get_version_info()

        if args.json:
            # JSON output
            print(json.dumps(info, indent=2))
        else:
            # Human-readable output
            print(f"FlowLang version: {info['flowlang_version']}")
            print(f"Python version:   {info['python_version']} ({info['python_implementation']})")
            print(f"Platform:         {info['platform']}")
            print(f"Architecture:     {info['architecture']}")

        return 0

    except Exception as e:
        print(f"❌ Error: {e}", file=sys.stderr)
        return 1
