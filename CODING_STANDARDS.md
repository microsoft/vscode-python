## Coding guidelines for TypeScript

-   The following standards are inspired from [Coding guidelines for TypeScript](https://github.com/Microsoft/TypeScript/wiki/Coding-guidelines) (which you should follow when something is not specified in this document, although any pre-existing practices in a file being edited trump either style guide).

### Names

-   Use `PascalCase` for type names.
-   Use `I` as a prefix for interface names only when an interface is implemented by a class.
-   Use `PascalCase` for enum values.
-   Use `camelCase` for function names.
-   Use `camelCase` for property names and local variables.
-   Do not use `_` as a prefix for private properties (unless used as backing properties).
-   Use whole words in names when possible.

### Types

-   Do not export types/functions unless you need to share it across multiple components.
-   Do not introduce new types/values to the global namespace.
-   Shared types should be defined in `types.ts`.
    Within a file, type definitions should come first.

### null and undefined

Use undefined. Do not use null.

### Comments

-   Comments must end with a period.
-   Use JSDoc style comments for functions, interfaces, enums, and classes.

### Strings

Use single quotes for strings.

### Imports

-   Use ES6 module imports.
-   Do not use bare `import *`; all imports should either explicitly pull in an object or import an entire module, otherwise you're implicitly polluting the global namespace and making it difficult to figure out from code examination where a name originates from.

### Style

-   Use `prettier` to format `TypeScript` and `JavaScript` code.
-   Use arrow functions over anonymous function expressions.
-   Always surround loop and conditional bodies with curly braces. Statements on the same line are allowed to omit braces.
-   Open curly braces always go on the same line as whatever necessitates them.
-   Parenthesized constructs should have no surrounding whitespace.
-   A single space follows commas, colons, and semicolons in those constructs. For example:

    -   `for (var i = 0, n = str.length; i < 10; i++) { }`
    -   `if (x < 10) { }`
    -   `function f(x: number, y: string): void { }`

-   `else` goes on the same line from the closing curly brace.
-   Use 4 spaces per indentation.
-   All files must end with an empty line.
