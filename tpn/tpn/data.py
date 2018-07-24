from __future__ import annotations

import dataclasses


@dataclasses.dataclass
class Project:
    """Represents the details of a project."""

    name: str
    version: str
    url: str
    license: Optional[str] = None
    error: Optional[Exception] = None