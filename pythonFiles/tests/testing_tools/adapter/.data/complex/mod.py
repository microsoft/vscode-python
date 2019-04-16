"""

Examples:

>>> square(1)
1
>>> square(2)
4
>>> square(3)
9
>>> spam = Spam()
>>> spam.eggs()
42
"""


def square(x):
    """

    Examples:

    >>> square(1)
    1
    >>> square(2)
    4
    >>> square(3)
    9
    """
    return x * x


class Spam(object):
    """

    Examples:

    >>> spam = Spam()
    >>> spam.eggs()
    42
    """

    def eggs(self):
        """

        Examples:

        >>> spam = Spam()
        >>> spam.eggs()
        42
        """
        return 42
