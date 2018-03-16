import builtins
import os

class DirEntry(builtins.object):
    __class__ = DirEntry
    def __fspath__(self):
        'returns the path for the entry'
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
    
    def inode(self):
        'return inode of the entry; cached per entry'
        pass
    
    def is_dir(self):
        'return True if the entry is a directory; cached per entry'
        pass
    
    def is_file(self):
        'return True if the entry is a file; cached per entry'
        pass
    
    def is_symlink(self):
        'return True if the entry is a symbolic link; cached per entry'
        pass
    
    @property
    def name(self):
        'the entry\'s base filename, relative to scandir() "path" argument'
        pass
    
    @property
    def path(self):
        "the entry's full path name; equivalent to os.path.join(scandir_path, entry.name)"
        pass
    
    def stat(self):
        'return stat_result object for the entry; cached per entry'
        pass
    

F_OK = 0
O_APPEND = 8
O_BINARY = 32768
O_CREAT = 256
O_EXCL = 1024
O_NOINHERIT = 128
O_RANDOM = 16
O_RDONLY = 0
O_RDWR = 2
O_SEQUENTIAL = 32
O_SHORT_LIVED = 4096
O_TEMPORARY = 64
O_TEXT = 16384
O_TRUNC = 512
O_WRONLY = 1
P_DETACH = 4
P_NOWAIT = 1
P_NOWAITO = 3
P_OVERLAY = 2
P_WAIT = 0
R_OK = 4
TMP_MAX = 2147483647
W_OK = 2
X_OK = 1
__doc__ = 'This module provides access to operating system functionality that is\nstandardized by the C Standard and the POSIX standard (a thinly\ndisguised Unix interface).  Refer to the library manual and\ncorresponding Unix manual entries for more information on calls.'
__name__ = 'nt'
__package__ = ''
def _exit(status):
    'Exit to the system with specified status, without normal exit processing.'
    pass

def _getdiskusage(path):
    'Return disk usage statistics about the given path as a (total, free) tuple.'
    pass

def _getfinalpathname(path):
    'A helper function for samepath on windows.'
    pass

def _getfullpathname(path):
    pass

def _getvolumepathname(path):
    'A helper function for ismount on Win32.'
    pass

_have_functions = builtins.list()
def _isdir(path):
    'Return true if the pathname refers to an existing directory.'
    pass

def abort():
    "Abort the interpreter immediately.\n\nThis function 'dumps core' or otherwise fails in the hardest way possible\non the hosting operating system.  This function never returns."
    pass

def access(path, mode):
    'Use the real uid/gid to test for access to a path.\n\n  path\n    Path to be tested; can be string or bytes\n  mode\n    Operating-system mode bitfield.  Can be F_OK to test existence,\n    or the inclusive-OR of R_OK, W_OK, and X_OK.\n  dir_fd\n    If not None, it should be a file descriptor open to a directory,\n    and path should be relative; path will then be relative to that\n    directory.\n  effective_ids\n    If True, access will use the effective uid/gid instead of\n    the real uid/gid.\n  follow_symlinks\n    If False, and the last element of the path is a symbolic link,\n    access will examine the symbolic link itself instead of the file\n    the link points to.\n\ndir_fd, effective_ids, and follow_symlinks may not be implemented\n  on your platform.  If they are unavailable, using them will raise a\n  NotImplementedError.\n\nNote that most operations will use the effective uid/gid, therefore this\n  routine can be used in a suid/sgid environment to test if the invoking user\n  has the specified access to the path.'
    pass

def chdir(path):
    'Change the current working directory to the specified path.\n\npath may always be specified as a string.\nOn some platforms, path may also be specified as an open file descriptor.\n  If this functionality is unavailable, using it raises an exception.'
    pass

def chmod(path, mode):
    'Change the access permissions of a file.\n\n  path\n    Path to be modified.  May always be specified as a str or bytes.\n    On some platforms, path may also be specified as an open file descriptor.\n    If this functionality is unavailable, using it raises an exception.\n  mode\n    Operating-system mode bitfield.\n  dir_fd\n    If not None, it should be a file descriptor open to a directory,\n    and path should be relative; path will then be relative to that\n    directory.\n  follow_symlinks\n    If False, and the last element of the path is a symbolic link,\n    chmod will modify the symbolic link itself instead of the file\n    the link points to.\n\nIt is an error to use dir_fd or follow_symlinks when specifying path as\n  an open file descriptor.\ndir_fd and follow_symlinks may not be implemented on your platform.\n  If they are unavailable, using them will raise a NotImplementedError.'
    pass

def close(fd):
    'Close a file descriptor.'
    pass

def closerange(fd_low, fd_high):
    'Closes all file descriptors in [fd_low, fd_high), ignoring errors.'
    pass

def cpu_count():
    'Return the number of CPUs in the system; return None if indeterminable.\n\nThis number is not equivalent to the number of CPUs the current process can\nuse.  The number of usable CPUs can be obtained with\n``len(os.sched_getaffinity(0))``'
    pass

def device_encoding(fd):
    "Return a string describing the encoding of a terminal's file descriptor.\n\nThe file descriptor must be attached to a terminal.\nIf the device is not a terminal, return None."
    pass

def dup(fd):
    'Return a duplicate of a file descriptor.'
    pass

def dup2(fd, fd2, inheritable):
    'Duplicate file descriptor.'
    pass

environ = builtins.dict()
error = builtins.OSError
def execv(path, argv):
    'Execute an executable path with arguments, replacing current process.\n\n  path\n    Path of executable file.\n  argv\n    Tuple or list of strings.'
    pass

def execve(path, argv, env):
    'Execute an executable path with arguments, replacing current process.\n\n  path\n    Path of executable file.\n  argv\n    Tuple or list of strings.\n  env\n    Dictionary of strings mapping to strings.'
    pass

def fspath(path):
    'Return the file system path representation of the object.\n\nIf the object is str or bytes, then allow it to pass through as-is. If the\nobject defines __fspath__(), then return the result of that method. All other\ntypes raise a TypeError.'
    pass

def fstat(fd):
    'Perform a stat system call on the given file descriptor.\n\nLike stat(), but for an open file descriptor.\nEquivalent to os.stat(fd).'
    pass

def fsync(fd):
    'Force write of fd to disk.'
    pass

def ftruncate(fd, length):
    'Truncate a file, specified by file descriptor, to a specific length.'
    pass

def get_handle_inheritable(handle):
    'Get the close-on-exe flag of the specified file descriptor.'
    pass

def get_inheritable(fd):
    'Get the close-on-exe flag of the specified file descriptor.'
    pass

def get_terminal_size():
    'Return the size of the terminal window as (columns, lines).\n\nThe optional argument fd (default standard output) specifies\nwhich file descriptor should be queried.\n\nIf the file descriptor is not connected to a terminal, an OSError\nis thrown.\n\nThis function will only be defined if an implementation is\navailable for this system.\n\nshutil.get_terminal_size is the high-level function which should \nnormally be used, os.get_terminal_size is the low-level implementation.'
    pass

def getcwd():
    'Return a unicode string representing the current working directory.'
    pass

def getcwdb():
    'Return a bytes string representing the current working directory.'
    pass

def getlogin():
    'Return the actual login name.'
    pass

def getpid():
    'Return the current process id.'
    pass

def getppid():
    "Return the parent's process id.\n\nIf the parent process has already exited, Windows machines will still\nreturn its id; others systems will return the id of the 'init' process (1)."
    pass

def isatty(fd):
    'Return True if the fd is connected to a terminal.\n\nReturn True if the file descriptor is an open file descriptor\nconnected to the slave end of a terminal.'
    pass

def kill(pid, signal):
    'Kill a process with a signal.'
    pass

def link(src, dst):
    'Create a hard link to a file.\n\nIf either src_dir_fd or dst_dir_fd is not None, it should be a file\n  descriptor open to a directory, and the respective path string (src or dst)\n  should be relative; the path will then be relative to that directory.\nIf follow_symlinks is False, and the last element of src is a symbolic\n  link, link will create a link to the symbolic link itself instead of the\n  file the link points to.\nsrc_dir_fd, dst_dir_fd, and follow_symlinks may not be implemented on your\n  platform.  If they are unavailable, using them will raise a\n  NotImplementedError.'
    pass

def listdir(path):
    "Return a list containing the names of the files in the directory.\n\npath can be specified as either str or bytes.  If path is bytes,\n  the filenames returned will also be bytes; in all other circumstances\n  the filenames returned will be str.\nIf path is None, uses the path='.'.\nOn some platforms, path may also be specified as an open file descriptor;\\\n  the file descriptor must refer to a directory.\n  If this functionality is unavailable, using it raises NotImplementedError.\n\nThe list is in arbitrary order.  It does not include the special\nentries '.' and '..' even if they are present in the directory."
    pass

def lseek(fd, position, how):
    'Set the position of a file descriptor.  Return the new position.\n\nReturn the new cursor position in number of bytes\nrelative to the beginning of the file.'
    pass

def lstat(path):
    'Perform a stat system call on the given path, without following symbolic links.\n\nLike stat(), but do not follow symbolic links.\nEquivalent to stat(path, follow_symlinks=False).'
    pass

def mkdir(path, mode):
    'Create a directory.\n\nIf dir_fd is not None, it should be a file descriptor open to a directory,\n  and path should be relative; path will then be relative to that directory.\ndir_fd may not be implemented on your platform.\n  If it is unavailable, using it will raise a NotImplementedError.\n\nThe mode argument is ignored on Windows.'
    pass

def open(path, flags, mode):
    'Open a file for low level IO.  Returns a file descriptor (integer).\n\nIf dir_fd is not None, it should be a file descriptor open to a directory,\n  and path should be relative; path will then be relative to that directory.\ndir_fd may not be implemented on your platform.\n  If it is unavailable, using it will raise a NotImplementedError.'
    pass

def pipe():
    'Create a pipe.\n\nReturns a tuple of two file descriptors:\n  (read_fd, write_fd)'
    pass

def putenv(name, value):
    'Change or add an environment variable.'
    pass

def read(fd, length):
    'Read from a file descriptor.  Returns a bytes object.'
    pass

def readlink(path):
    'readlink(path, *, dir_fd=None) -> path\n\nReturn a string representing the path to which the symbolic link points.\n\nIf dir_fd is not None, it should be a file descriptor open to a directory,\n  and path should be relative; path will then be relative to that directory.\ndir_fd may not be implemented on your platform.\n  If it is unavailable, using it will raise a NotImplementedError.'
    pass

def remove(path):
    'Remove a file (same as unlink()).\n\nIf dir_fd is not None, it should be a file descriptor open to a directory,\n  and path should be relative; path will then be relative to that directory.\ndir_fd may not be implemented on your platform.\n  If it is unavailable, using it will raise a NotImplementedError.'
    pass

def rename(src, dst):
    'Rename a file or directory.\n\nIf either src_dir_fd or dst_dir_fd is not None, it should be a file\n  descriptor open to a directory, and the respective path string (src or dst)\n  should be relative; the path will then be relative to that directory.\nsrc_dir_fd and dst_dir_fd, may not be implemented on your platform.\n  If they are unavailable, using them will raise a NotImplementedError.'
    pass

def replace(src, dst):
    'Rename a file or directory, overwriting the destination.\n\nIf either src_dir_fd or dst_dir_fd is not None, it should be a file\n  descriptor open to a directory, and the respective path string (src or dst)\n  should be relative; the path will then be relative to that directory.\nsrc_dir_fd and dst_dir_fd, may not be implemented on your platform.\n  If they are unavailable, using them will raise a NotImplementedError."'
    pass

def rmdir(path):
    'Remove a directory.\n\nIf dir_fd is not None, it should be a file descriptor open to a directory,\n  and path should be relative; path will then be relative to that directory.\ndir_fd may not be implemented on your platform.\n  If it is unavailable, using it will raise a NotImplementedError.'
    pass

def scandir(path='.'):
    "scandir(path='.') -> iterator of DirEntry objects for given path"
    pass

def set_handle_inheritable(handle, inheritable):
    'Set the inheritable flag of the specified handle.'
    pass

def set_inheritable(fd, inheritable):
    'Set the inheritable flag of the specified file descriptor.'
    pass

def spawnv(mode, path, argv):
    'Execute the program specified by path in a new process.\n\n  mode\n    Mode of process creation.\n  path\n    Path of executable file.\n  argv\n    Tuple or list of strings.'
    pass

def spawnve(mode, path, argv, env):
    'Execute the program specified by path in a new process.\n\n  mode\n    Mode of process creation.\n  path\n    Path of executable file.\n  argv\n    Tuple or list of strings.\n  env\n    Dictionary of strings mapping to strings.'
    pass

def startfile(filepath, operation):
    'startfile(filepath [, operation])\n\nStart a file with its associated application.\n\nWhen "operation" is not specified or "open", this acts like\ndouble-clicking the file in Explorer, or giving the file name as an\nargument to the DOS "start" command: the file is opened with whatever\napplication (if any) its extension is associated.\nWhen another "operation" is given, it specifies what should be done with\nthe file.  A typical operation is "print".\n\nstartfile returns as soon as the associated application is launched.\nThere is no option to wait for the application to close, and no way\nto retrieve the application\'s exit status.\n\nThe filepath is relative to the current directory.  If you want to use\nan absolute path, make sure the first character is not a slash ("/");\nthe underlying Win32 ShellExecute function doesn\'t work if it is.'
    pass

def stat(path):
    "Perform a stat system call on the given path.\n\n  path\n    Path to be examined; can be string, bytes, path-like object or\n    open-file-descriptor int.\n  dir_fd\n    If not None, it should be a file descriptor open to a directory,\n    and path should be a relative string; path will then be relative to\n    that directory.\n  follow_symlinks\n    If False, and the last element of the path is a symbolic link,\n    stat will examine the symbolic link itself instead of the file\n    the link points to.\n\ndir_fd and follow_symlinks may not be implemented\n  on your platform.  If they are unavailable, using them will raise a\n  NotImplementedError.\n\nIt's an error to use dir_fd or follow_symlinks when specifying path as\n  an open file descriptor."
    pass

def stat_float_times(newval):
    'stat_float_times([newval]) -> oldval\n\nDetermine whether os.[lf]stat represents time stamps as float objects.\n\nIf value is True, future calls to stat() return floats; if it is False,\nfuture calls return ints.\nIf value is omitted, return the current setting.\n'
    pass

class stat_result(builtins.tuple):
    'stat_result: Result from stat, fstat, or lstat.\n\nThis object may be accessed either as a tuple of\n  (mode, ino, dev, nlink, uid, gid, size, atime, mtime, ctime)\nor via the attributes st_mode, st_ino, st_dev, st_nlink, st_uid, and so on.\n\nPosix/windows: If your platform supports st_blksize, st_blocks, st_rdev,\nor st_flags, they are available as attributes only.\n\nSee os.stat for more information.'
    __class__ = stat_result
    @classmethod
    def __init_subclass__(cls):
        'This method is called when a class is subclassed.\n\nThe default implementation does nothing. It may be\noverridden to extend subclasses.\n'
        return None
    
    def __reduce__(self):
        return ''; return ()
    
    def __repr__(self):
        'Return repr(self).'
        pass
    
    @classmethod
    def __subclasshook__(cls, subclass):
        'Abstract classes can override this to customize issubclass().\n\nThis is invoked early on by abc.ABCMeta.__subclasscheck__().\nIt should return True, False or NotImplemented.  If it returns\nNotImplemented, the normal algorithm is used.  Otherwise, it\noverrides the normal algorithm (and the outcome is cached).\n'
        return False
    
    n_fields = 17
    n_sequence_fields = 10
    n_unnamed_fields = 3
    @property
    def st_atime(self):
        'time of last access'
        pass
    
    @property
    def st_atime_ns(self):
        'time of last access in nanoseconds'
        pass
    
    @property
    def st_ctime(self):
        'time of last change'
        pass
    
    @property
    def st_ctime_ns(self):
        'time of last change in nanoseconds'
        pass
    
    @property
    def st_dev(self):
        'device'
        pass
    
    @property
    def st_file_attributes(self):
        'Windows file attribute bits'
        pass
    
    @property
    def st_gid(self):
        'group ID of owner'
        pass
    
    @property
    def st_ino(self):
        'inode'
        pass
    
    @property
    def st_mode(self):
        'protection bits'
        pass
    
    @property
    def st_mtime(self):
        'time of last modification'
        pass
    
    @property
    def st_mtime_ns(self):
        'time of last modification in nanoseconds'
        pass
    
    @property
    def st_nlink(self):
        'number of hard links'
        pass
    
    @property
    def st_size(self):
        'total size, in bytes'
        pass
    
    @property
    def st_uid(self):
        'user ID of owner'
        pass
    

class statvfs_result(builtins.tuple):
    'statvfs_result: Result from statvfs or fstatvfs.\n\nThis object may be accessed either as a tuple of\n  (bsize, frsize, blocks, bfree, bavail, files, ffree, favail, flag, namemax),\nor via the attributes f_bsize, f_frsize, f_blocks, f_bfree, and so on.\n\nSee os.statvfs for more information.'
    __class__ = statvfs_result
    @classmethod
    def __init_subclass__(cls):
        'This method is called when a class is subclassed.\n\nThe default implementation does nothing. It may be\noverridden to extend subclasses.\n'
        return None
    
    def __reduce__(self):
        return ''; return ()
    
    def __repr__(self):
        'Return repr(self).'
        pass
    
    @classmethod
    def __subclasshook__(cls, subclass):
        'Abstract classes can override this to customize issubclass().\n\nThis is invoked early on by abc.ABCMeta.__subclasscheck__().\nIt should return True, False or NotImplemented.  If it returns\nNotImplemented, the normal algorithm is used.  Otherwise, it\noverrides the normal algorithm (and the outcome is cached).\n'
        return False
    
    @property
    def f_bavail(self):
        pass
    
    @property
    def f_bfree(self):
        pass
    
    @property
    def f_blocks(self):
        pass
    
    @property
    def f_bsize(self):
        pass
    
    @property
    def f_favail(self):
        pass
    
    @property
    def f_ffree(self):
        pass
    
    @property
    def f_files(self):
        pass
    
    @property
    def f_flag(self):
        pass
    
    @property
    def f_frsize(self):
        pass
    
    @property
    def f_namemax(self):
        pass
    
    n_fields = 10
    n_sequence_fields = 10
    n_unnamed_fields = 0

def strerror(code):
    'Translate an error code to a message string.'
    pass

def symlink(src, dst, target_is_directory):
    'Create a symbolic link pointing to src named dst.\n\ntarget_is_directory is required on Windows if the target is to be\n  interpreted as a directory.  (On Windows, symlink requires\n  Windows 6.0 or greater, and raises a NotImplementedError otherwise.)\n  target_is_directory is ignored on non-Windows platforms.\n\nIf dir_fd is not None, it should be a file descriptor open to a directory,\n  and path should be relative; path will then be relative to that directory.\ndir_fd may not be implemented on your platform.\n  If it is unavailable, using it will raise a NotImplementedError.'
    pass

def system(command):
    'Execute the command in a subshell.'
    pass

terminal_size = os.terminal_size
def times():
    'Return a collection containing process timing information.\n\nThe object returned behaves like a named tuple with these fields:\n  (utime, stime, cutime, cstime, elapsed_time)\nAll fields are floating point numbers.'
    pass

class times_result(builtins.tuple):
    'times_result: Result from os.times().\n\nThis object may be accessed either as a tuple of\n  (user, system, children_user, children_system, elapsed),\nor via the attributes user, system, children_user, children_system,\nand elapsed.\n\nSee os.times for more information.'
    __class__ = times_result
    @classmethod
    def __init_subclass__(cls):
        'This method is called when a class is subclassed.\n\nThe default implementation does nothing. It may be\noverridden to extend subclasses.\n'
        return None
    
    def __reduce__(self):
        return ''; return ()
    
    def __repr__(self):
        'Return repr(self).'
        pass
    
    @classmethod
    def __subclasshook__(cls, subclass):
        'Abstract classes can override this to customize issubclass().\n\nThis is invoked early on by abc.ABCMeta.__subclasscheck__().\nIt should return True, False or NotImplemented.  If it returns\nNotImplemented, the normal algorithm is used.  Otherwise, it\noverrides the normal algorithm (and the outcome is cached).\n'
        return False
    
    @property
    def children_system(self):
        'system time of children'
        pass
    
    @property
    def children_user(self):
        'user time of children'
        pass
    
    @property
    def elapsed(self):
        'elapsed time since an arbitrary point in the past'
        pass
    
    n_fields = 5
    n_sequence_fields = 5
    n_unnamed_fields = 0
    @property
    def system(self):
        'system time'
        pass
    
    @property
    def user(self):
        'user time'
        pass
    

def truncate(path, length):
    'Truncate a file, specified by path, to a specific length.\n\nOn some platforms, path may also be specified as an open file descriptor.\n  If this functionality is unavailable, using it raises an exception.'
    pass

def umask(mask):
    'Set the current numeric umask and return the previous umask.'
    pass

class uname_result(builtins.tuple):
    'uname_result: Result from os.uname().\n\nThis object may be accessed either as a tuple of\n  (sysname, nodename, release, version, machine),\nor via the attributes sysname, nodename, release, version, and machine.\n\nSee os.uname for more information.'
    __class__ = uname_result
    @classmethod
    def __init_subclass__(cls):
        'This method is called when a class is subclassed.\n\nThe default implementation does nothing. It may be\noverridden to extend subclasses.\n'
        return None
    
    def __reduce__(self):
        return ''; return ()
    
    def __repr__(self):
        'Return repr(self).'
        pass
    
    @classmethod
    def __subclasshook__(cls, subclass):
        'Abstract classes can override this to customize issubclass().\n\nThis is invoked early on by abc.ABCMeta.__subclasscheck__().\nIt should return True, False or NotImplemented.  If it returns\nNotImplemented, the normal algorithm is used.  Otherwise, it\noverrides the normal algorithm (and the outcome is cached).\n'
        return False
    
    @property
    def machine(self):
        'hardware identifier'
        pass
    
    n_fields = 5
    n_sequence_fields = 5
    n_unnamed_fields = 0
    @property
    def nodename(self):
        'name of machine on network (implementation-defined)'
        pass
    
    @property
    def release(self):
        'operating system release'
        pass
    
    @property
    def sysname(self):
        'operating system name'
        pass
    
    @property
    def version(self):
        'operating system version'
        pass
    

def unlink(path):
    'Remove a file (same as remove()).\n\nIf dir_fd is not None, it should be a file descriptor open to a directory,\n  and path should be relative; path will then be relative to that directory.\ndir_fd may not be implemented on your platform.\n  If it is unavailable, using it will raise a NotImplementedError.'
    pass

def urandom(size):
    'Return a bytes object containing random bytes suitable for cryptographic use.'
    pass

def utime(path, times):
    'Set the access and modified time of path.\n\npath may always be specified as a string.\nOn some platforms, path may also be specified as an open file descriptor.\n  If this functionality is unavailable, using it raises an exception.\n\nIf times is not None, it must be a tuple (atime, mtime);\n    atime and mtime should be expressed as float seconds since the epoch.\nIf ns is specified, it must be a tuple (atime_ns, mtime_ns);\n    atime_ns and mtime_ns should be expressed as integer nanoseconds\n    since the epoch.\nIf times is None and ns is unspecified, utime uses the current time.\nSpecifying tuples for both times and ns is an error.\n\nIf dir_fd is not None, it should be a file descriptor open to a directory,\n  and path should be relative; path will then be relative to that directory.\nIf follow_symlinks is False, and the last element of the path is a symbolic\n  link, utime will modify the symbolic link itself instead of the file the\n  link points to.\nIt is an error to use dir_fd or follow_symlinks when specifying path\n  as an open file descriptor.\ndir_fd and follow_symlinks may not be available on your platform.\n  If they are unavailable, using them will raise a NotImplementedError.'
    pass

def waitpid(pid, options):
    'Wait for completion of a given process.\n\nReturns a tuple of information regarding the process:\n    (pid, status << 8)\n\nThe options argument is ignored on Windows.'
    pass

def write(fd, data):
    'Write a bytes object to a file descriptor.'
    pass

