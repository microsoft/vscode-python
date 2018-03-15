CREATE_NEW_CONSOLE = 16
CREATE_NEW_PROCESS_GROUP = 512
def CreatePipe(pipe_attrs, size):
    'CreatePipe(pipe_attrs, size) -> (read_handle, write_handle)\n\nCreate an anonymous pipe, and return handles to the read and\nwrite ends of the pipe.\n\npipe_attrs is ignored internally and can be None.'
    pass

def CreateProcess(app_name, cmd_line, proc_attrs, thread_attrs, inherit, flags, env_mapping, curdir, startup_info):
    'CreateProcess(app_name, cmd_line, proc_attrs, thread_attrs,\n               inherit, flags, env_mapping, curdir,\n               startup_info) -> (proc_handle, thread_handle,\n                                 pid, tid)\n\nCreate a new process and its primary thread. The return\nvalue is a tuple of the process handle, thread handle,\nprocess ID, and thread ID.\n\nproc_attrs and thread_attrs are ignored internally and can be None.'
    pass

DUPLICATE_SAME_ACCESS = 2
def DuplicateHandle(source_proc_handle, source_handle, target_proc_handle, target_handle, access, inherit, options):
    'DuplicateHandle(source_proc_handle, source_handle,\n                 target_proc_handle, target_handle, access,\n                 inherit[, options]) -> handle\n\nReturn a duplicate handle object.\n\nThe duplicate handle refers to the same object as the original\nhandle. Therefore, any changes to the object are reflected\nthrough both handles.'
    pass

def GetCurrentProcess():
    'GetCurrentProcess() -> handle\n\nReturn a handle object for the current process.'
    pass

def GetExitCodeProcess(handle):
    'GetExitCodeProcess(handle) -> Exit code\n\nReturn the termination status of the specified process.'
    pass

def GetModuleFileName(module):
    'GetModuleFileName(module) -> path\n\nReturn the fully-qualified path for the file that contains\nthe specified module. The module must have been loaded by the\ncurrent process.\n\nThe module parameter should be a handle to the loaded module\nwhose path is being requested. If this parameter is 0, \nGetModuleFileName retrieves the path of the executable file\nof the current process.'
    pass

def GetStdHandle(handle):
    'GetStdHandle(handle) -> integer\n\nReturn a handle to the specified standard device\n(STD_INPUT_HANDLE, STD_OUTPUT_HANDLE, STD_ERROR_HANDLE).\nThe integer associated with the handle object is returned.'
    pass

def GetVersion():
    'GetVersion() -> version\n\nReturn the version number of the current operating system.'
    pass

INFINITE = -1
STARTF_USESHOWWINDOW = 1
STARTF_USESTDHANDLES = 256
STD_ERROR_HANDLE = -12
STD_INPUT_HANDLE = -10
STD_OUTPUT_HANDLE = -11
STILL_ACTIVE = 259
SW_HIDE = 0
def TerminateProcess(handle, exit_code):
    'TerminateProcess(handle, exit_code) -> None\n\nTerminate the specified process and all of its threads.'
    pass

WAIT_OBJECT_0 = 0
def WaitForSingleObject(handle, timeout):
    'WaitForSingleObject(handle, timeout) -> result\n\nWait until the specified object is in the signaled state or\nthe time-out interval elapses. The timeout value is specified\nin milliseconds.'
    pass

__doc__ = None
__name__ = '_subprocess'
__package__ = None
