# Python extension's API

This npm module implements an API facade for the Python extension in VS Code.

## Example

The source code of the example can be found [here](TODO Update example extension link here)

First we need to define a `package.json` for the extension that wants to use the API:

```jsonc
{
	"name": "...",
	...
	// depend on the Python extension
	"extensionDependencies": [
		"ms-python.python"
	],
	// Depend on the Python extension facade npm module to get easier API access to the
	// core extension.
	"dependencies": {
		"@vscode/python-extension": "..."
	},
}
```

TODO insert example here

```typescript
TODO
```
