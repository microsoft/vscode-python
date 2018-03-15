import builtins

lock = builtins.type
LockType = lock()
class RLock(builtins.object):
    __class__ = RLock
    def __enter__(self):
        'acquire(blocking=True) -> bool\n\nLock the lock.  `blocking` indicates whether we should wait\nfor the lock to be available or not.  If `blocking` is False\nand another thread holds the lock, the method will return False\nimmediately.  If `blocking` is True and another thread holds\nthe lock, the method will wait for the lock to be released,\ntake it and then return True.\n(note: the blocking operation is interruptible.)\n\nIn all other cases, the method will return True immediately.\nPrecisely, if the current thread already holds the lock, its\ninternal counter is simply incremented. If nobody holds the lock,\nthe lock is taken and its internal counter initialized to 1.'
        pass
    
    def __exit__(self):
        'release()\n\nRelease the lock, allowing another thread that is blocked waiting for\nthe lock to acquire the lock.  The lock must be in the locked state,\nand must be locked by the same thread that unlocks it; otherwise a\n`RuntimeError` is raised.\n\nDo note that if the lock was acquire()d several times in a row by the\ncurrent thread, release() needs to be called as many times for the lock\nto be available for other threads.'
        pass
    
    @classmethod
    def __init_subclass__(cls):
        'This method is called when a class is subclassed.\n\nThe default implementation does nothing. It may be\noverridden to extend subclasses.\n'
        return None
    
    def __repr__(self):
        'Return repr(self).'
        pass
    
    @classmethod
    def __subclasshook__(cls, subclass):
        'Abstract classes can override this to customize issubclass().\n\nThis is invoked early on by abc.ABCMeta.__subclasscheck__().\nIt should return True, False or NotImplemented.  If it returns\nNotImplemented, the normal algorithm is used.  Otherwise, it\noverrides the normal algorithm (and the outcome is cached).\n'
        return False
    
    def _acquire_restore(self, state):
        '_acquire_restore(state) -> None\n\nFor internal use by `threading.Condition`.'
        pass
    
    def _is_owned(self):
        '_is_owned() -> bool\n\nFor internal use by `threading.Condition`.'
        pass
    
    def _release_save(self):
        '_release_save() -> tuple\n\nFor internal use by `threading.Condition`.'
        pass
    
    def acquire(self, blocking=True):
        'acquire(blocking=True) -> bool\n\nLock the lock.  `blocking` indicates whether we should wait\nfor the lock to be available or not.  If `blocking` is False\nand another thread holds the lock, the method will return False\nimmediately.  If `blocking` is True and another thread holds\nthe lock, the method will wait for the lock to be released,\ntake it and then return True.\n(note: the blocking operation is interruptible.)\n\nIn all other cases, the method will return True immediately.\nPrecisely, if the current thread already holds the lock, its\ninternal counter is simply incremented. If nobody holds the lock,\nthe lock is taken and its internal counter initialized to 1.'
        pass
    
    def release(self):
        'release()\n\nRelease the lock, allowing another thread that is blocked waiting for\nthe lock to acquire the lock.  The lock must be in the locked state,\nand must be locked by the same thread that unlocks it; otherwise a\n`RuntimeError` is raised.\n\nDo note that if the lock was acquire()d several times in a row by the\ncurrent thread, release() needs to be called as many times for the lock\nto be available for other threads.'
        pass
    

TIMEOUT_MAX = 4294967.0
__doc__ = "This module provides primitive operations to write multi-threaded programs.\nThe 'threading' module provides a more convenient interface."
__name__ = '_thread'
__package__ = ''
def _count():
    '_count() -> integer\n\nReturn the number of currently running Python threads, excluding \nthe main thread. The returned number comprises all threads created\nthrough `start_new_thread()` as well as `threading.Thread`, and not\nyet finished.\n\nThis function is meant for internal and specialized purposes only.\nIn most applications `threading.enumerate()` should be used instead.'
    pass

class _local(builtins.object):
    'Thread-local data'
    __class__ = _local
    def __delattr__(self, name):
        'Implement delattr(self, name).'
        pass
    
    def __getattribute__(self, name):
        'Return getattr(self, name).'
        pass
    
    @classmethod
    def __init_subclass__(cls):
        'This method is called when a class is subclassed.\n\nThe default implementation does nothing. It may be\noverridden to extend subclasses.\n'
        return None
    
    def __setattr__(self, name, value):
        'Implement setattr(self, name, value).'
        pass
    
    @classmethod
    def __subclasshook__(cls, subclass):
        'Abstract classes can override this to customize issubclass().\n\nThis is invoked early on by abc.ABCMeta.__subclasscheck__().\nIt should return True, False or NotImplemented.  If it returns\nNotImplemented, the normal algorithm is used.  Otherwise, it\noverrides the normal algorithm (and the outcome is cached).\n'
        return False
    

def _set_sentinel():
    '_set_sentinel() -> lock\n\nSet a sentinel lock that will be released when the current thread\nstate is finalized (after it is untied from the interpreter).\n\nThis is a private API for the threading module.'
    pass

def allocate():
    'allocate_lock() -> lock object\n(allocate() is an obsolete synonym)\n\nCreate a new lock object. See help(type(threading.Lock())) for\ninformation about locks.'
    pass

def allocate_lock():
    'allocate_lock() -> lock object\n(allocate() is an obsolete synonym)\n\nCreate a new lock object. See help(type(threading.Lock())) for\ninformation about locks.'
    pass

error = builtins.RuntimeError
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

