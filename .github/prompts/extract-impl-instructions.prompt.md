---
mode: edit
---

Analyze the specified part of the VS Code Python Extension codebase to generate or update implementation instructions in `.github/instructions/<component>.instructions.md`.

## Task

Create concise developer guidance focused on:

### Implementation Essentials

-   **Core patterns**: How this component is typically implemented and extended
-   **Key interfaces**: Essential classes, services, and APIs with usage examples
-   **Integration points**: How this component interacts with other extension parts
-   **Common tasks**: Typical development scenarios with step-by-step guidance

### Content Structure

````markdown
---
description: 'Implementation guide for the <component> part of the Python Extension'
---

# <Component> Implementation Guide

## Overview

Brief description of the component's purpose and role in VS Code Python Extension.

## Key Concepts

-   Main abstractions and their responsibilities
-   Important interfaces and base classes

## Common Implementation Patterns

### Pattern 1: [Specific Use Case]

```typescript
// Code example showing typical implementation
```
````

### Pattern 2: [Another Use Case]

```typescript
// Another practical example
```

## Integration Points

-   How this component connects to other VS Code Python Extension systems
-   Required services and dependencies
-   Extension points and contribution models

## Essential APIs

-   Key methods and interfaces developers need
-   Common parameters and return types

## Gotchas and Best Practices

-   Non-obvious behaviors to watch for
-   Performance considerations
-   Common mistakes to avoid

```

## Guidelines
- **Be specific**: Use actual class names, method signatures, and file paths
- **Show examples**: Include working code snippets from the codebase
- **Target implementation**: Focus on how to build with/extend this component
- **Keep it actionable**: Every section should help developers accomplish tasks

Source conventions from existing `.github/instructions/*.instructions.md`, `CONTRIBUTING.md`, and codebase patterns.

If `.github/instructions/<component>.instructions.md` exists, intelligently merge new insights with existing content.
```
