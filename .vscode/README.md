# VS Code FlowLang Support

This directory contains VS Code configuration for enhanced FlowLang development experience.

## 🚀 Quick Start

### Prerequisites

Install the **YAML extension by Red Hat**:
1. Open VS Code
2. Go to Extensions (Cmd/Ctrl + Shift + X)
3. Search for "YAML" by Red Hat
4. Click Install

### That's It!

The schema and snippets are automatically activated for all `flow.yaml` files in this project.

## ✨ Features

### 1. Autocompletion

Start typing any FlowLang construct and VS Code will suggest valid options:

- Type `flow` + Tab → Complete flow template
- Type `task` + Tab → Task step template
- Type `parallel` + Tab → Parallel execution block
- Type `conditional` + Tab → If/then/else block
- Type `foreach` + Tab → Loop template

**Variable suggestions:**
- Type `${` → Suggests available variables (inputs, step outputs)

### 2. Real-time Validation

The JSON Schema validates your flow.yaml files as you type:

✅ **Catches errors instantly:**
- Required fields missing
- Invalid property names
- Wrong data types
- Invalid variable references
- Typos in flow constructs

### 3. Hover Documentation

Hover over any field to see:
- What the field does
- Valid values
- Examples
- Whether it's required

### 4. Code Snippets

All available snippets (type prefix + Tab):

| Prefix | Description |
|--------|-------------|
| `flow` | Complete flow template |
| `task` | Single task step |
| `taskif` | Conditional task step |
| `parallel` | Parallel execution |
| `conditional` | If/then/else block |
| `foreach` | For each loop |
| `input` | Input definition |
| `output` | Output definition |
| `varinput` | Reference to input variable |
| `varstep` | Reference to step output |
| `retry` | Retry configuration |
| `taskretry` | Task with retry |
| `taskerror` | Task with error handler |
| `taskdeps` | Task with dependencies |
| `taskfull` | Task with all options |

### 5. Format on Save

YAML files are automatically formatted with proper indentation (2 spaces).

## 📝 Usage Examples

### Creating a New Flow

1. Create a new file `flow.yaml`
2. Type `flow` and press Tab
3. Fill in the placeholders (Tab to move between them)
4. Save - validation happens automatically

### Adding a Task Step

1. Inside the `steps:` array
2. Type `task` and press Tab
3. Fill in task name, id, inputs

### Variable References

Type `${` and you'll see suggestions for:
- `${inputs.variable_name}` - Flow inputs
- `${step_id.output_name}` - Step outputs

## 🔧 Configuration

All configuration is in `.vscode/settings.json`:

```json
{
  "yaml.schemas": {
    "./flowlang-schema.json": ["**/flow.yaml"]
  },
  "yaml.validate": true,
  "yaml.completion": true,
  "yaml.hover": true
}
```

## 📚 Schema Reference

The complete FlowLang schema is defined in `flowlang-schema.json` at the project root.

**Supported constructs:**
- ✅ Task steps
- ✅ Parallel execution
- ✅ Conditional logic (if/then/else)
- ✅ Loops (for_each)
- ✅ Retry configuration
- ✅ Error handlers
- ✅ Dependencies
- ✅ Timeouts
- ✅ Variable resolution

## 🐛 Troubleshooting

### Validation Not Working

1. Ensure YAML extension is installed
2. Check file is named `flow.yaml`
3. Reload VS Code window (Cmd/Ctrl + Shift + P → "Reload Window")

### Snippets Not Appearing

1. Make sure you're in a YAML file
2. Start typing the snippet prefix
3. Press Tab (not Enter)
4. If still not working, check VS Code settings: `editor.snippetSuggestions` should be `"inline"` or `"top"`

### Schema Not Applied

1. Check `.vscode/settings.json` exists
2. Verify `flowlang-schema.json` is at project root
3. Reload VS Code window

## 💡 Tips

1. **Use Tab to navigate**: Snippets have tab stops - press Tab to jump between fields
2. **Cmd/Ctrl + Space**: Force trigger autocomplete suggestions
3. **Hover for help**: Hover over any field to see documentation
4. **Problems panel**: View all validation errors (Cmd/Ctrl + Shift + M)
5. **Format document**: Cmd/Ctrl + Shift + F to auto-format

## 🎯 Advanced

### Custom Snippets

Add your own snippets to `.vscode/flowlang.code-snippets`:

```json
{
  "My Custom Pattern": {
    "prefix": "mypattern",
    "body": [
      "- task: ${1:TaskName}",
      "  id: ${2:step_id}"
    ],
    "description": "My custom pattern"
  }
}
```

### Schema Updates

To add new validation rules, edit `flowlang-schema.json` and reload VS Code.

## 📖 Resources

- [FlowLang Documentation](../README.md)
- [YAML Language Server](https://github.com/redhat-developer/yaml-language-server)
- [JSON Schema Reference](https://json-schema.org/)

## 🤝 Contributing

Found an issue or have a suggestion? Please open an issue in the FlowLang repository.

---

**Happy FlowLang Development!** 🚀
