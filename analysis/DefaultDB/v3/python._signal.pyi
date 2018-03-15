CTRL_BREAK_EVENT = 1
CTRL_C_EVENT = 0
NSIG = 23
SIGABRT = 22
SIGBREAK = 21
SIGFPE = 8
SIGILL = 4
SIGINT = 2
SIGSEGV = 11
SIGTERM = 15
SIG_DFL = 0
SIG_IGN = 1
__doc__ = 'This module provides mechanisms to use signal handlers in Python.\n\nFunctions:\n\nalarm() -- cause SIGALRM after a specified time [Unix only]\nsetitimer() -- cause a signal (described below) after a specified\n               float time and the timer may restart then [Unix only]\ngetitimer() -- get current value of timer [Unix only]\nsignal() -- set the action for a given signal\ngetsignal() -- get the signal action for a given signal\npause() -- wait until a signal arrives [Unix only]\ndefault_int_handler() -- default SIGINT handler\n\nsignal constants:\nSIG_DFL -- used to refer to the system default handler\nSIG_IGN -- used to ignore the signal\nNSIG -- number of defined signals\nSIGINT, SIGTERM, etc. -- signal numbers\n\nitimer constants:\nITIMER_REAL -- decrements in real time, and delivers SIGALRM upon\n               expiration\nITIMER_VIRTUAL -- decrements only when the process is executing,\n               and delivers SIGVTALRM upon expiration\nITIMER_PROF -- decrements both when the process is executing and\n               when the system is executing on behalf of the process.\n               Coupled with ITIMER_VIRTUAL, this timer is usually\n               used to profile the time spent by the application\n               in user and kernel space. SIGPROF is delivered upon\n               expiration.\n\n\n*** IMPORTANT NOTICE ***\nA signal handler function is called with two arguments:\nthe first is the signal number, the second is the interrupted stack frame.'
__name__ = '_signal'
__package__ = ''
def default_int_handler():
    'default_int_handler(...)\n\nThe default handler for SIGINT installed by Python.\nIt raises KeyboardInterrupt.'
    pass

def getsignal(signalnum):
    'Return the current action for the given signal.\n\nThe return value can be:\n  SIG_IGN -- if the signal is being ignored\n  SIG_DFL -- if the default action for the signal is in effect\n  None    -- if an unknown handler is in effect\n  anything else -- the callable Python object used as a handler'
    pass

def set_wakeup_fd(fd):
    'set_wakeup_fd(fd) -> fd\n\nSets the fd to be written to (with the signal number) when a signal\ncomes in.  A library can use this to wakeup select or poll.\nThe previous fd or -1 is returned.\n\nThe fd must be non-blocking.'
    pass

def signal(signalnum, handler):
    'Set the action for the given signal.\n\nThe action can be SIG_DFL, SIG_IGN, or a callable Python object.\nThe previous action is returned.  See getsignal() for possible return values.\n\n*** IMPORTANT NOTICE ***\nA signal handler function is called with two arguments:\nthe first is the signal number, the second is the interrupted stack frame.'
    pass

