"""
FlowLang CLI - Completions Command

Generate shell completion scripts for bash, zsh, and fish.
"""

import sys


BASH_COMPLETION = """# FlowLang bash completion script
# Source this file or add it to ~/.bash_completion.d/

_flowlang_completion() {
    local cur prev opts
    COMPREPLY=()
    cur="${COMP_WORDS[COMP_CWORD]}"
    prev="${COMP_WORDS[COMP_CWORD-1]}"

    # Main commands
    local commands="init doctor upgrade version completions"

    # Command options
    local init_opts="--template --name --description --no-git"
    local doctor_opts="--verbose --fix"
    local upgrade_opts="--check --pre"
    local version_opts="--json"

    # If we're completing the first argument
    if [ $COMP_CWORD -eq 1 ]; then
        COMPREPLY=( $(compgen -W "${commands} --version --help" -- ${cur}) )
        return 0
    fi

    # Complete based on the command
    case "${COMP_WORDS[1]}" in
        init)
            COMPREPLY=( $(compgen -W "${init_opts}" -- ${cur}) )
            ;;
        doctor)
            COMPREPLY=( $(compgen -W "${doctor_opts}" -- ${cur}) )
            ;;
        upgrade)
            COMPREPLY=( $(compgen -W "${upgrade_opts}" -- ${cur}) )
            ;;
        version)
            COMPREPLY=( $(compgen -W "${version_opts}" -- ${cur}) )
            ;;
        completions)
            COMPREPLY=( $(compgen -W "bash zsh fish" -- ${cur}) )
            ;;
    esac
}

complete -F _flowlang_completion flowlang
"""

ZSH_COMPLETION = """#compdef flowlang
# FlowLang zsh completion script
# Place in ~/.zsh/completions/ or any directory in $fpath

_flowlang() {
    local -a commands
    commands=(
        'init:Create a new flow project interactively'
        'doctor:Check your FlowLang environment'
        'upgrade:Upgrade FlowLang to the latest version'
        'version:Show FlowLang version information'
        'completions:Generate shell completion scripts'
    )

    local -a init_opts
    init_opts=(
        '--template[Use a specific template]:template:'
        '--name[Flow name]:name:'
        '--description[Flow description]:description:'
        '--no-git[Skip git repository initialization]'
    )

    local -a doctor_opts
    doctor_opts=(
        '--verbose[Show detailed diagnostic information]'
        '--fix[Attempt to fix common issues automatically]'
    )

    local -a upgrade_opts
    upgrade_opts=(
        '--check[Check for updates without installing]'
        '--pre[Include pre-release versions]'
    )

    local -a version_opts
    version_opts=(
        '--json[Output in JSON format]'
    )

    local -a completions_opts
    completions_opts=(
        'bash:Bash completion script'
        'zsh:Zsh completion script'
        'fish:Fish completion script'
    )

    _arguments -C \\
        '1: :->command' \\
        '*:: :->option'

    case $state in
        command)
            _describe 'flowlang command' commands
            _arguments '--version[Show version]' '--help[Show help]'
            ;;
        option)
            case $words[1] in
                init)
                    _arguments $init_opts
                    ;;
                doctor)
                    _arguments $doctor_opts
                    ;;
                upgrade)
                    _arguments $upgrade_opts
                    ;;
                version)
                    _arguments $version_opts
                    ;;
                completions)
                    _describe 'shell type' completions_opts
                    ;;
            esac
            ;;
    esac
}

_flowlang
"""

FISH_COMPLETION = """# FlowLang fish completion script
# Place in ~/.config/fish/completions/flowlang.fish

# Main commands
complete -c flowlang -f -n '__fish_use_subcommand' -a 'init' -d 'Create a new flow project interactively'
complete -c flowlang -f -n '__fish_use_subcommand' -a 'doctor' -d 'Check your FlowLang environment'
complete -c flowlang -f -n '__fish_use_subcommand' -a 'upgrade' -d 'Upgrade FlowLang to the latest version'
complete -c flowlang -f -n '__fish_use_subcommand' -a 'version' -d 'Show FlowLang version information'
complete -c flowlang -f -n '__fish_use_subcommand' -a 'completions' -d 'Generate shell completion scripts'

# Global options
complete -c flowlang -f -l version -d 'Show version'
complete -c flowlang -f -l help -d 'Show help'

# init command options
complete -c flowlang -f -n '__fish_seen_subcommand_from init' -l template -d 'Use a specific template'
complete -c flowlang -f -n '__fish_seen_subcommand_from init' -l name -d 'Flow name'
complete -c flowlang -f -n '__fish_seen_subcommand_from init' -l description -d 'Flow description'
complete -c flowlang -f -n '__fish_seen_subcommand_from init' -l no-git -d 'Skip git repository initialization'

# doctor command options
complete -c flowlang -f -n '__fish_seen_subcommand_from doctor' -l verbose -d 'Show detailed diagnostic information'
complete -c flowlang -f -n '__fish_seen_subcommand_from doctor' -l fix -d 'Attempt to fix common issues automatically'

# upgrade command options
complete -c flowlang -f -n '__fish_seen_subcommand_from upgrade' -l check -d 'Check for updates without installing'
complete -c flowlang -f -n '__fish_seen_subcommand_from upgrade' -l pre -d 'Include pre-release versions'

# version command options
complete -c flowlang -f -n '__fish_seen_subcommand_from version' -l json -d 'Output in JSON format'

# completions command arguments
complete -c flowlang -f -n '__fish_seen_subcommand_from completions' -a 'bash' -d 'Bash completion script'
complete -c flowlang -f -n '__fish_seen_subcommand_from completions' -a 'zsh' -d 'Zsh completion script'
complete -c flowlang -f -n '__fish_seen_subcommand_from completions' -a 'fish' -d 'Fish completion script'
"""


def cmd_completions(args) -> int:
    """
    Generate shell completion scripts.

    Outputs completion script for the specified shell to stdout.
    """
    try:
        shell = args.shell.lower()

        if shell == 'bash':
            print(BASH_COMPLETION)
            print("# To enable bash completion, run:", file=sys.stderr)
            print("#   flowlang completions bash >> ~/.bash_completion", file=sys.stderr)
            print("#   source ~/.bash_completion", file=sys.stderr)
        elif shell == 'zsh':
            print(ZSH_COMPLETION)
            print("# To enable zsh completion, run:", file=sys.stderr)
            print("#   mkdir -p ~/.zsh/completions", file=sys.stderr)
            print("#   flowlang completions zsh > ~/.zsh/completions/_flowlang", file=sys.stderr)
            print("#   # Add to ~/.zshrc: fpath=(~/.zsh/completions $fpath)", file=sys.stderr)
            print("#   # Then run: compinit", file=sys.stderr)
        elif shell == 'fish':
            print(FISH_COMPLETION)
            print("# To enable fish completion, run:", file=sys.stderr)
            print("#   mkdir -p ~/.config/fish/completions", file=sys.stderr)
            print("#   flowlang completions fish > ~/.config/fish/completions/flowlang.fish", file=sys.stderr)
        else:
            print(f"❌ Unknown shell: {shell}", file=sys.stderr)
            print("Supported shells: bash, zsh, fish", file=sys.stderr)
            return 1

        return 0

    except Exception as e:
        print(f"❌ Error: {e}", file=sys.stderr)
        return 1
