import __builtin__

weakcallableproxy = __builtin__.type
weakproxy = __builtin__.type
weakref = __builtin__.type
weakref = __builtin__.type
CallableProxyType = weakcallableproxy()
ProxyType = weakproxy()
ReferenceType = weakref()
__doc__ = 'Weak-reference support module.'
__name__ = '_weakref'
__package__ = None
def _remove_dead_weakref(dict, key):
    '_remove_dead_weakref(dict, key) -- atomically remove key from dict\nif it points to a dead weakref.'
    pass

def getweakrefcount(object):
    "getweakrefcount(object) -- return the number of weak references\nto 'object'."
    pass

def getweakrefs(object):
    "getweakrefs(object) -- return a list of all weak reference objects\nthat point to 'object'."
    pass

def proxy(object, callback):
    "proxy(object[, callback]) -- create a proxy object that weakly\nreferences 'object'.  'callback', if given, is called with a\nreference to the proxy when 'object' is about to be finalized."
    pass

ref = weakref()
