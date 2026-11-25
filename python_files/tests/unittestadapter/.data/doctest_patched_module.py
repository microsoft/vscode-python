"""
Patched doctest module.
This module's doctests will be patched to have proper IDs.

>>> 2 + 2
4
"""


def example_function():
    """
    Example function with doctest.

    >>> example_function()
    'works'
    """
    return "works"
