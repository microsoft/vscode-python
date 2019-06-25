# Copyright (c) Microsoft Corporation. All rights reserved.
# Licensed under the MIT License.

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
    purpose: Optional[str] = None

    @property
    def npm(self):
        return f"https://www.npmjs.com/package/{self.name}"
