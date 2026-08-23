# Ayaw Kalimti

Ayaw Kalimti is a personal-first, context-aware task application intended to surface a Task when the user has a practical opportunity to act on it.

## Status

The product baseline, domain glossary, production-track architecture, and technology stack are approved. The production-track workspace is bootstrapped; application behavior and release approval remain separate.

## Documentation

- [Product specification](docs/PRODUCT_SPEC.md)
- [Domain glossary](docs/CONTEXT.md)
- [System architecture and technology decisions](docs/ARCHITECTURE.md)
- [Repository instructions](AGENTS.md)

## Development

Requires Node 24.19.0 and Corepack. The pinned package manager is npm 11.12.1.

```powershell
corepack npm@11.12.1 ci
corepack npm@11.12.1 run check
```

`check` verifies formatting, linting, type checking, Jest foundations, generated-code drift, and dependency-tree validity. It makes no provider calls and does not provision, deploy, or release anything.
