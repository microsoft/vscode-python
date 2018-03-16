__doc__ = 'Debug module to trace memory blocks allocated by Python.'
__name__ = '_tracemalloc'
__package__ = ''
def _get_object_traceback(obj):
    '_get_object_traceback(obj)\n\nGet the traceback where the Python object obj was allocated.\nReturn a tuple of (filename: str, lineno: int) tuples.\n\nReturn None if the tracemalloc module is disabled or did not\ntrace the allocation of the object.'
    pass

def _get_traces():
    '_get_traces() -> list\n\nGet traces of all memory blocks allocated by Python.\nReturn a list of (size: int, traceback: tuple) tuples.\ntraceback is a tuple of (filename: str, lineno: int) tuples.\n\nReturn an empty list if the tracemalloc module is disabled.'
    pass

def clear_traces():
    'clear_traces()\n\nClear traces of memory blocks allocated by Python.'
    pass

def get_traceback_limit():
    'get_traceback_limit() -> int\n\nGet the maximum number of frames stored in the traceback\nof a trace.\n\nBy default, a trace of an allocated memory block only stores\nthe most recent frame: the limit is 1.'
    pass

def get_traced_memory():
    'get_traced_memory() -> (int, int)\n\nGet the current size and peak size of memory blocks traced\nby the tracemalloc module as a tuple: (current: int, peak: int).'
    pass

def get_tracemalloc_memory():
    'get_tracemalloc_memory() -> int\n\nGet the memory usage in bytes of the tracemalloc module\nused internally to trace memory allocations.'
    pass

def is_tracing():
    'is_tracing()->bool\n\nTrue if the tracemalloc module is tracing Python memory allocations,\nFalse otherwise.'
    pass

def start(nframe=1):
    'start(nframe: int=1)\n\nStart tracing Python memory allocations. Set also the maximum number \nof frames stored in the traceback of a trace to nframe.'
    pass

def stop():
    'stop()\n\nStop tracing Python memory allocations and clear traces\nof memory blocks allocated by Python.'
    pass

