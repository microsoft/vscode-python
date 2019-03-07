from collections import namedtuple


class TestPath(namedtuple('TestPath', 'root relfile func sub')):
    """Where to find a single test."""


class TestInfo(namedtuple('TestInfo', 'id name path lineno markers')):
    """Info for a single test."""
