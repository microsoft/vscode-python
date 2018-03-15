import builtins

DEBUG_COLLECTABLE = 2
DEBUG_LEAK = 38
DEBUG_SAVEALL = 32
DEBUG_STATS = 1
DEBUG_UNCOLLECTABLE = 4
__doc__ = 'This module provides access to the garbage collector for reference cycles.\n\nenable() -- Enable automatic garbage collection.\ndisable() -- Disable automatic garbage collection.\nisenabled() -- Returns true if automatic collection is enabled.\ncollect() -- Do a full collection right now.\nget_count() -- Return the current collection counts.\nget_stats() -- Return list of dictionaries containing per-generation stats.\nset_debug() -- Set debugging flags.\nget_debug() -- Get debugging flags.\nset_threshold() -- Set the collection thresholds.\nget_threshold() -- Return the current the collection thresholds.\nget_objects() -- Return a list of all objects tracked by the collector.\nis_tracked() -- Returns true if a given object is tracked.\nget_referrers() -- Return the list of objects that refer to an object.\nget_referents() -- Return the list of objects that an object refers to.\n'
__name__ = 'gc'
__package__ = ''
callbacks = builtins.list()
def collect(generation):
    'collect([generation]) -> n\n\nWith no arguments, run a full collection.  The optional argument\nmay be an integer specifying which generation to collect.  A ValueError\nis raised if the generation number is invalid.\n\nThe number of unreachable objects is returned.\n'
    pass

def disable():
    'disable() -> None\n\nDisable automatic garbage collection.\n'
    pass

def enable():
    'enable() -> None\n\nEnable automatic garbage collection.\n'
    pass

garbage = builtins.list()
def get_count():
    'get_count() -> (count0, count1, count2)\n\nReturn the current collection counts\n'
    pass

def get_debug():
    'get_debug() -> flags\n\nGet the garbage collection debugging flags.\n'
    pass

def get_objects():
    'get_objects() -> [...]\n\nReturn a list of objects tracked by the collector (excluding the list\nreturned).\n'
    pass

def get_referents():
    'get_referents(*objs) -> list\nReturn the list of objects that are directly referred to by objs.'
    pass

def get_referrers():
    'get_referrers(*objs) -> list\nReturn the list of objects that directly refer to any of objs.'
    pass

def get_stats():
    'get_stats() -> [...]\n\nReturn a list of dictionaries containing per-generation statistics.\n'
    pass

def get_threshold():
    'get_threshold() -> (threshold0, threshold1, threshold2)\n\nReturn the current collection thresholds\n'
    pass

def is_tracked(obj):
    'is_tracked(obj) -> bool\n\nReturns true if the object is tracked by the garbage collector.\nSimple atomic objects will return false.\n'
    pass

def isenabled():
    'isenabled() -> status\n\nReturns true if automatic garbage collection is enabled.\n'
    pass

def set_debug(flags):
    'set_debug(flags) -> None\n\nSet the garbage collection debugging flags. Debugging information is\nwritten to sys.stderr.\n\nflags is an integer and can have the following bits turned on:\n\n  DEBUG_STATS - Print statistics during collection.\n  DEBUG_COLLECTABLE - Print collectable objects found.\n  DEBUG_UNCOLLECTABLE - Print unreachable but uncollectable objects found.\n  DEBUG_SAVEALL - Save objects to gc.garbage rather than freeing them.\n  DEBUG_LEAK - Debug leaking programs (everything but STATS).\n'
    pass

def set_threshold(threshold0, threshold1, threshold2):
    'set_threshold(threshold0, [threshold1, threshold2]) -> None\n\nSets the collection thresholds.  Setting threshold0 to zero disables\ncollection.\n'
    pass

