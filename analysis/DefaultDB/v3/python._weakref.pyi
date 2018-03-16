import builtins

weakcallableproxy = builtins.type
weakproxy = builtins.type
weakref = builtins.type
weakref = builtins.type
CallableProxyType = weakcallableproxy()
ProxyType = weakproxy()
ReferenceType = weakref()
__doc__ = 'Weak-reference support module.'
__name__ = '_weakref'
__package__ = ''
def _remove_dead_weakref(dct, key):
    'Atomically remove key from dict if it points to a dead weakref.'
    pass

def getweakrefcount(object):
    "Return the number of weak references to 'object'."
    pass

def getweakrefs(object):
    "getweakrefs(object) -- return a list of all weak reference objects\nthat point to 'object'."
    pass

def proxy(object, callback):
    "proxy(object[, callback]) -- create a proxy object that weakly\nreferences 'object'.  'callback', if given, is called with a\nreference to the proxy when 'object' is about to be finalized."
    pass

ref = weakref()
