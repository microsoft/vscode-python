import __builtin__

__doc__ = '_warnings provides basic warning filtering support.\nIt is a helper module to speed up interpreter start-up.'
__name__ = '_warnings'
__package__ = None
default_action = 'default'
filters = __builtin__.list()
once_registry = __builtin__.dict()
def warn():
    'Issue a warning, or maybe ignore it or raise an exception.'
    pass

def warn_explicit():
    'Low-level inferface to warnings functionality.'
    pass

