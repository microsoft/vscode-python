import builtins

__doc__ = '_warnings provides basic warning filtering support.\nIt is a helper module to speed up interpreter start-up.'
__name__ = '_warnings'
__package__ = ''
_defaultaction = 'default'
def _filters_mutated():
    pass

_onceregistry = builtins.dict()
filters = builtins.list()
def warn():
    'Issue a warning, or maybe ignore it or raise an exception.'
    pass

def warn_explicit():
    'Low-level inferface to warnings functionality.'
    pass

