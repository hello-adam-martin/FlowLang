# FlowLang

A workflow orchestration language that helps people describe flows to achieve tasks in a structured, maintainable way.

## What is FlowLang?

FlowLang lets you design workflows in simple YAML, then automatically generates the code scaffolding. You implement tasks one at a time—like TDD for workflows—and always know exactly what's done vs pending. Deploy as a REST API and integrate with any app.

## Key Features

- **Design-first approach**: Write workflows in clean, readable YAML
- **TDD-style development**: Auto-generate task stubs with tests
- **Built-in progress tracking**: Always know what's implemented (3/15, 10/15, etc.)
- **API-first deployment**: REST + WebSockets included
- **Language-agnostic**: TypeScript/Python SDKs provided
- **Production-ready**: Auth, monitoring, and scaling built-in

## Quick Start

```bash
# Install dependencies
pip install -r requirements.txt

# Run a simple example
python flows/quickstart.py
```

## Example Flow

```yaml
flow: HelloWorld
inputs:
  - name: user_name
    type: string
    required: true

steps:
  - task: Greet
    id: greet_step
    inputs:
      name: ${inputs.user_name}
    outputs:
      - greeting
```

## Project Status

🚧 Currently in active development

## Documentation

See the [docs](./docs) folder for detailed documentation.

## License

MIT License
