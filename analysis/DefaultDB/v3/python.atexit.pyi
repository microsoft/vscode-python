__doc__ = 'allow programmer to define multiple exit functions to be executedupon normal program termination.\n\nTwo public functions, register and unregister, are defined.\n'
__name__ = 'atexit'
__package__ = ''
def _clear():
    '_clear() -> None\n\nClear the list of previously registered exit functions.'
    pass

def _ncallbacks():
    '_ncallbacks() -> int\n\nReturn the number of registered exit functions.'
    pass

def _run_exitfuncs():
    '_run_exitfuncs() -> None\n\nRun all registered exit functions.'
    pass

def register(func):
    'register(func, *args, **kwargs) -> func\n\nRegister a function to be executed upon normal program termination\n\n    func - function to be called at exit\n    args - optional arguments to pass to func\n    kwargs - optional keyword arguments to pass to func\n\n    func is returned to facilitate usage as a decorator.'
    pass

def unregister(func):
    'unregister(func) -> None\n\nUnregister an exit function which was previously registered using\natexit.register\n\n    func - function to be unregistered'
    pass

