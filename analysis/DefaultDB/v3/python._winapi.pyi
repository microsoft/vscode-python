import builtins

CREATE_NEW_CONSOLE = 16
CREATE_NEW_PROCESS_GROUP = 512
def CloseHandle(handle):
    'Close handle.'
    pass

def ConnectNamedPipe(handle, overlapped):
    pass

def CreateFile(file_name, desired_access, share_mode, security_attributes, creation_disposition, flags_and_attributes, template_file):
    pass

def CreateJunction(src_path, dst_path):
    pass

def CreateNamedPipe(name, open_mode, pipe_mode, max_instances, out_buffer_size, in_buffer_size, default_timeout, security_attributes):
    pass

def CreatePipe(pipe_attrs, size):
    'Create an anonymous pipe.\n\n  pipe_attrs\n    Ignored internally, can be None.\n\nReturns a 2-tuple of handles, to the read and write ends of the pipe.'
    pass

def CreateProcess(application_name, command_line, proc_attrs, thread_attrs, inherit_handles, creation_flags, env_mapping, current_directory, startup_info):
    'Create a new process and its primary thread.\n\n  proc_attrs\n    Ignored internally, can be None.\n  thread_attrs\n    Ignored internally, can be None.\n\nThe return value is a tuple of the process handle, thread handle,\nprocess ID, and thread ID.'
    pass

DUPLICATE_CLOSE_SOURCE = 1
DUPLICATE_SAME_ACCESS = 2
def DuplicateHandle(source_process_handle, source_handle, target_process_handle, desired_access, inherit_handle, options):
    'Return a duplicate handle object.\n\nThe duplicate handle refers to the same object as the original\nhandle. Therefore, any changes to the object are reflected\nthrough both handles.'
    pass

ERROR_ALREADY_EXISTS = 183
ERROR_BROKEN_PIPE = 109
ERROR_IO_PENDING = 997
ERROR_MORE_DATA = 234
ERROR_NETNAME_DELETED = 64
ERROR_NO_DATA = 232
ERROR_NO_SYSTEM_RESOURCES = 1450
ERROR_OPERATION_ABORTED = 995
ERROR_PIPE_BUSY = 231
ERROR_PIPE_CONNECTED = 535
ERROR_SEM_TIMEOUT = 121
def ExitProcess(ExitCode):
    pass

FILE_FLAG_FIRST_PIPE_INSTANCE = 524288
FILE_FLAG_OVERLAPPED = 1073741824
FILE_GENERIC_READ = 1179785
FILE_GENERIC_WRITE = 1179926
GENERIC_READ = 2147483648
GENERIC_WRITE = 1073741824
def GetCurrentProcess():
    'Return a handle object for the current process.'
    pass

def GetExitCodeProcess(process):
    'Return the termination status of the specified process.'
    pass

def GetLastError():
    pass

def GetModuleFileName(module_handle):
    'Return the fully-qualified path for the file that contains module.\n\nThe module must have been loaded by the current process.\n\nThe module parameter should be a handle to the loaded module\nwhose path is being requested. If this parameter is 0,\nGetModuleFileName retrieves the path of the executable file\nof the current process.'
    pass

def GetStdHandle(std_handle):
    'Return a handle to the specified standard device.\n\n  std_handle\n    One of STD_INPUT_HANDLE, STD_OUTPUT_HANDLE, or STD_ERROR_HANDLE.\n\nThe integer associated with the handle object is returned.'
    pass

def GetVersion():
    'Return the version number of the current operating system.'
    pass

INFINITE = 4294967295
NMPWAIT_WAIT_FOREVER = 4294967295
NULL = 0
OPEN_EXISTING = 3
def OpenProcess(desired_access, inherit_handle, process_id):
    pass

class Overlapped(builtins.object):
    'OVERLAPPED structure wrapper'
    def GetOverlappedResult(self, wait):
        pass
    
    __class__ = Overlapped
    @classmethod
    def __init_subclass__(cls):
        'This method is called when a class is subclassed.\n\nThe default implementation does nothing. It may be\noverridden to extend subclasses.\n'
        return None
    
    @classmethod
    def __subclasshook__(cls, subclass):
        'Abstract classes can override this to customize issubclass().\n\nThis is invoked early on by abc.ABCMeta.__subclasscheck__().\nIt should return True, False or NotImplemented.  If it returns\nNotImplemented, the normal algorithm is used.  Otherwise, it\noverrides the normal algorithm (and the outcome is cached).\n'
        return False
    
    def cancel(self):
        pass
    
    @property
    def event(self):
        'overlapped event handle'
        pass
    
    def getbuffer(self):
        pass
    

PIPE_ACCESS_DUPLEX = 3
PIPE_ACCESS_INBOUND = 1
PIPE_READMODE_MESSAGE = 2
PIPE_TYPE_MESSAGE = 4
PIPE_UNLIMITED_INSTANCES = 255
PIPE_WAIT = 0
PROCESS_ALL_ACCESS = 2097151
PROCESS_DUP_HANDLE = 64
def PeekNamedPipe(handle, size):
    pass

def ReadFile(handle, size, overlapped):
    pass

STARTF_USESHOWWINDOW = 1
STARTF_USESTDHANDLES = 256
STD_ERROR_HANDLE = 4294967284
STD_INPUT_HANDLE = 4294967286
STD_OUTPUT_HANDLE = 4294967285
STILL_ACTIVE = 259
SW_HIDE = 0
def SetNamedPipeHandleState(named_pipe, mode, max_collection_count, collect_data_timeout):
    pass

def TerminateProcess(handle, exit_code):
    'Terminate the specified process and all of its threads.'
    pass

WAIT_ABANDONED_0 = 128
WAIT_OBJECT_0 = 0
WAIT_TIMEOUT = 258
def WaitForMultipleObjects(handle_seq, wait_flag, milliseconds):
    pass

def WaitForSingleObject(handle, milliseconds):
    'Wait for a single object.\n\nWait until the specified object is in the signaled state or\nthe time-out interval elapses. The timeout value is specified\nin milliseconds.'
    pass

def WaitNamedPipe(name, timeout):
    pass

def WriteFile(handle, buffer, overlapped):
    pass

__doc__ = None
__name__ = '_winapi'
__package__ = ''
