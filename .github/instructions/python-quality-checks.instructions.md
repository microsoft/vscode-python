---
applyTo: 'python_files/**'
description: Guide for running and fixing Python quality checks (Ruff and Pyright) that run in CI
---

# Python Quality Checks — Ruff and Pyright

Run the same Python quality checks that run in CI. All checks target `python_files/` and use config from `python_files/pyproject.toml`.

## Commands

```bash
npm run check-python              # Run both Ruff and Pyright
npm run check-python:ruff         # Linting and formatting only
npm run check-python:pyright      # Type checking only
```

## Fixing Ruff Errors

**Auto-fix most issues:**

```bash
cd python_files
python -m ruff check . --fix
python -m ruff format
npm run check-python:ruff  # Verify
```

**Manual fixes:**

-   Ruff shows file, line number, rule code (e.g., `F841`), and description
-   Open the file, read the error, fix the code
-   Common: line length (100 char max), import sorting, unused variables

## Fixing Pyright Errors

**Common patterns and fixes:**

-   **Undefined variable/import**: Add the missing import
-   **Type mismatch**: Correct the type or add type annotations
-   **Missing return type**: Add `-> ReturnType` to function signatures
    ```python
    def my_function() -> str:  # Add return type
        return "result"
    ```

**Verify:**

```bash
npm run check-python:pyright
```

## Configuration

-   **Ruff**: Line length 100, Python 3.8+, 40+ rule families (flake8, isort, pyupgrade, etc.)
-   **Pyright**: Version 1.1.308 (pinned), ignores `lib/` and 15+ legacy files
-   Config: `python_files/pyproject.toml` sections `[tool.ruff]` and `[tool.pyright]`

## Troubleshooting

**"Module not found" in Pyright**: Install dependencies

```bash
python -m pip install --upgrade -r build/test-requirements.txt
nox --session install_python_libs
```

**Import order errors**: Auto-fix with `ruff check . --fix`

**Type errors in ignored files**: Legacy files in `pyproject.toml` ignore list—fix if working on them

## Learnings

-   Always run `npm run check-python` before pushing to catch CI failures early (1)
-   Use `ruff check . --fix` to auto-fix most linting issues before manual review (1)
-   Pyright version must match CI (1.1.308) to avoid inconsistent results between local and CI runs (1)
