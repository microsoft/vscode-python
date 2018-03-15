import __builtin__
import hotshot

class LogReaderType(__builtin__.object):
    'logreader(filename) --> log-iterator\nCreate a log-reader for the timing information file.'
    __class__ = LogReaderType
    def __getattribute__(self):
        "x.__getattribute__('name') <==> x.name"
        pass
    
    def __getitem__(self, index):
        'x.__getitem__(y) <==> x[y]'
        pass
    
    def __iter__(self):
        'x.__iter__() <==> iter(x)'
        return LogReaderType()
    
    @classmethod
    def __subclasshook__(cls, subclass):
        'Abstract classes can override this to customize issubclass().\n\nThis is invoked early on by abc.ABCMeta.__subclasscheck__().\nIt should return True, False or NotImplemented.  If it returns\nNotImplemented, the normal algorithm is used.  Otherwise, it\noverrides the normal algorithm (and the outcome is cached).\n'
        return False
    
    def close(self):
        'close()\nClose the log file, preventing additional records from being read.'
        pass
    
    @property
    def closed(self):
        "True if the logreader's input file has already been closed."
        pass
    
    def fileno(self):
        'fileno() -> file descriptor\nReturns the file descriptor for the log file, if open.\nRaises ValueError if the log file is closed.'
        pass
    
    @property
    def info(self):
        'Dictionary mapping informational keys to lists of values.'
        pass
    
    def next(self):
        'x.next() -> the next value, or raise StopIteration'
        pass
    

ProfilerError = hotshot.ProfilerError
class ProfilerType(__builtin__.object):
    'High-performance profiler object.\n\nMethods:\n\nclose():      Stop the profiler and close the log files.\nfileno():     Returns the file descriptor of the log file.\nruncall():    Run a single function call with profiling enabled.\nruncode():    Execute a code object with profiling enabled.\nstart():      Install the profiler and return.\nstop():       Remove the profiler.\n\nAttributes (read-only):\n\nclosed:       True if the profiler has already been closed.\nframetimings: True if ENTER/EXIT events collect timing information.\nlineevents:   True if line events are reported to the profiler.\nlinetimings:  True if line events collect timing information.'
    __class__ = ProfilerType
    def __getattribute__(self):
        "x.__getattribute__('name') <==> x.name"
        pass
    
    @classmethod
    def __subclasshook__(cls, subclass):
        'Abstract classes can override this to customize issubclass().\n\nThis is invoked early on by abc.ABCMeta.__subclasscheck__().\nIt should return True, False or NotImplemented.  If it returns\nNotImplemented, the normal algorithm is used.  Otherwise, it\noverrides the normal algorithm (and the outcome is cached).\n'
        return False
    
    def addinfo(self, key, value):
        'addinfo(key, value)\nInsert an ADD_INFO record into the log.'
        pass
    
    def close(self):
        'close()\nShut down this profiler and close the log files, even if its active.'
        pass
    
    @property
    def closed(self):
        "True if the profiler's output file has already been closed."
        pass
    
    def fileno(self):
        'fileno() -> file descriptor\nReturns the file descriptor for the log file, if open.\nRaises ValueError if the log file is closed.'
        pass
    
    @property
    def frametimings(self):
        pass
    
    @property
    def lineevents(self):
        pass
    
    @property
    def linetimings(self):
        pass
    
    def runcall(self, callable, args, kw):
        'runcall(callable[, args[, kw]]) -> callable()\nProfile a specific function call, returning the result of that call.'
        pass
    
    def runcode(self, code, globals, locals):
        'runcode(code, globals[, locals])\nExecute a code object while collecting profile data.  If locals is\nomitted, globals is used for the locals as well.'
        pass
    
    def start(self):
        'start()\nInstall this profiler for the current thread.'
        pass
    
    def stop(self):
        'stop()\nRemove this profiler from the current thread.'
        pass
    

WHAT_ADD_INFO = 19
WHAT_DEFINE_FILE = 35
WHAT_DEFINE_FUNC = 67
WHAT_ENTER = 0
WHAT_EXIT = 1
WHAT_LINENO = 2
WHAT_LINE_TIMES = 51
WHAT_OTHER = 3
__doc__ = None
__name__ = '_hotshot'
__package__ = None
__version__ = ''
def coverage(logfilename):
    "coverage(logfilename) -> profiler\nReturns a profiler that doesn't collect any timing information, which is\nuseful in building a coverage analysis tool."
    pass

def logreader(filename):
    'logreader(filename) --> log-iterator\nCreate a log-reader for the timing information file.'
    pass

def profiler(logfilename, lineevents, linetimes):
    'profiler(logfilename[, lineevents[, linetimes]]) -> profiler\nCreate a new profiler object.'
    pass

def resolution():
    'resolution() -> (performance-counter-ticks, update-frequency)\nReturn the resolution of the timer provided by the QueryPerformanceCounter()\nfunction.  The first value is the smallest observed change, and the second\nis the result of QueryPerformanceFrequency().'
    pass

