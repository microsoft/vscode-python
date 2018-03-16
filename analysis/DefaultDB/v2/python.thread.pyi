import __builtin__
import exceptions

lock = __builtin__.type
LockType = lock()
__doc__ = "This module provides primitive operations to write multi-threaded programs.\nThe 'threading' module provides a more convenient interface."
__name__ = 'thread'
__package__ = None
def _count():
    '_count() -> integer\n\nReturn the number of currently running Python threads, excluding \nthe main thread. The returned number comprises all threads created\nthrough `start_new_thread()` as well as `threading.Thread`, and not\nyet finished.\n\nThis function is meant for internal and specialized purposes only.\nIn most applications `threading.enumerate()` should be used instead.'
    pass

class _local(__builtin__.object):
    'Thread-local data'
    __class__ = _local
    def __delattr__(self):
        "x.__delattr__('name') <==> del x.name"
        return None
    
    def __getattribute__(self):
        "x.__getattribute__('name') <==> x.name"
        pass
    
    def __setattr__(self):
        "x.__setattr__('name', value) <==> x.name = value"
        return None
    
    @classmethod
    def __subclasshook__(cls, subclass):
        'Abstract classes can override this to customize issubclass().\n\nThis is invoked early on by abc.ABCMeta.__subclasscheck__().\nIt should return True, False or NotImplemented.  If it returns\nNotImplemented, the normal algorithm is used.  Otherwise, it\noverrides the normal algorithm (and the outcome is cached).\n'
        return False
    

def allocate():
    'allocate_lock() -> lock object\n(allocate() is an obsolete synonym)\n\nCreate a new lock object.  See help(LockType) for information about locks.'
    pass

def allocate_lock():
    'allocate_lock() -> lock object\n(allocate() is an obsolete synonym)\n\nCreate a new lock object.  See help(LockType) for information about locks.'
    pass

class error(exceptions.Exception):
    __class__ = error
    __dict__ = __builtin__.dict()
    __module__ = 'thread'
    @classmethod
    def __subclasshook__(cls, subclass):
        'Abstract classes can override this to customize issubclass().\n\nThis is invoked early on by abc.ABCMeta.__subclasscheck__().\nIt should return True, False or NotImplemented.  If it returns\nNotImplemented, the normal algorithm is used.  Otherwise, it\noverrides the normal algorithm (and the outcome is cached).\n'
        return False
    
    @property
    def __weakref__(self):
        'list of weak references to the object (if defined)'
        pass
    

def exit():
    "exit()\n(exit_thread() is an obsolete synonym)\n\nThis is synonymous to ``raise SystemExit''.  It will cause the current\nthread to exit silently unless the exception is caught."
    pass

def exit_thread():
    "exit()\n(exit_thread() is an obsolete synonym)\n\nThis is synonymous to ``raise SystemExit''.  It will cause the current\nthread to exit silently unless the exception is caught."
    pass

def get_ident():
    "get_ident() -> integer\n\nReturn a non-zero integer that uniquely identifies the current thread\namongst other threads that exist simultaneously.\nThis may be used to identify per-thread resources.\nEven though on some platforms threads identities may appear to be\nallocated consecutive numbers starting at 1, this behavior should not\nbe relied upon, and the number should be seen purely as a magic cookie.\nA thread's identity may be reused for another thread after it exits."
    pass

def interrupt_main():
    'interrupt_main()\n\nRaise a KeyboardInterrupt in the main thread.\nA subthread can use this function to interrupt the main thread.'
    pass

def stack_size(size):
    'stack_size([size]) -> size\n\nReturn the thread stack size used when creating new threads.  The\noptional size argument specifies the stack size (in bytes) to be used\nfor subsequently created threads, and must be 0 (use platform or\nconfigured default) or a positive integer value of at least 32,768 (32k).\nIf changing the thread stack size is unsupported, a ThreadError\nexception is raised.  If the specified size is invalid, a ValueError\nexception is raised, and the stack size is unmodified.  32k bytes\n currently the minimum supported stack size value to guarantee\nsufficient stack space for the interpreter itself.\n\nNote that some platforms may have particular restrictions on values for\nthe stack size, such as requiring a minimum stack size larger than 32kB or\nrequiring allocation in multiples of the system memory page size\n- platform documentation should be referred to for more information\n(4kB pages are common; using multiples of 4096 for the stack size is\nthe suggested approach in the absence of more specific information).'
    pass

def start_new():
    'start_new_thread(function, args[, kwargs])\n(start_new() is an obsolete synonym)\n\nStart a new thread and return its identifier.  The thread will call the\nfunction with positional arguments from the tuple args and keyword arguments\ntaken from the optional dictionary kwargs.  The thread exits when the\nfunction returns; the return value is ignored.  The thread will also exit\nwhen the function raises an unhandled exception; a stack trace will be\nprinted unless the exception is SystemExit.\n'
    pass

def start_new_thread(function, args, kwargs):
    'start_new_thread(function, args[, kwargs])\n(start_new() is an obsolete synonym)\n\nStart a new thread and return its identifier.  The thread will call the\nfunction with positional arguments from the tuple args and keyword arguments\ntaken from the optional dictionary kwargs.  The thread exits when the\nfunction returns; the return value is ignored.  The thread will also exit\nwhen the function raises an unhandled exception; a stack trace will be\nprinted unless the exception is SystemExit.\n'
    pass

