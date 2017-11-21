# Coding Guidelines for TypeScript

## Names
- Use PascalCase for type names.
- Use PascalCase for enum values.
- Use camelCase for function names.
- Use camelCase for property names and local variables.
- Use "I" as a prefix for interface names when they are implemented by classes.
- Do not use "_" as a prefix for private properties (except when using private variables as backing store for getters and/or setters).
- Use whole words in names when possible.
- Exported constants must be capitalized using underscores to separate words.

## Interfaces
- Use Interfaces only when they are implemented by classes, else use Types.

## Types definitions
- Exportable types are to be placed within a file named `types.ts`.
- Private types are to be placed at the top of the file.
- Avoid use of `any` type.

## Documentation (comments)
- Comments must end with periods.
- Use JSDoc style for code documentation.

## General conventions
- Use single quotes for strings.
- Use `undefined` instead of `null.
- Use 4 spaces for indentation.
- All files must end with an empty lint.
