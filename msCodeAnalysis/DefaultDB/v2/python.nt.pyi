import __builtin__
import exceptions

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
TMP_MAX = 32767
W_OK = 2
X_OK = 1
__doc__ = 'This module provides access to operating system functionality that is\nstandardized by the C Standard and the POSIX standard (a thinly\ndisguised Unix interface).  Refer to the library manual and\ncorresponding Unix manual entries for more information on calls.'
__name__ = 'nt'
__package__ = None
def _exit(status):
    '_exit(status)\n\nExit to the system with specified status, without normal exit processing.'
    pass

def _getfullpathname():
    pass

def _isdir():
    'Return true if the pathname refers to an existing directory.'
    pass

def abort():
    "abort() -> does not return!\n\nAbort the interpreter immediately.  This 'dumps core' or otherwise fails\nin the hardest way possible on the hosting operating system."
    pass

def access(path, mode):
    'access(path, mode) -> True if granted, False otherwise\n\nUse the real uid/gid to test for access to a path.  Note that most\noperations will use the effective uid/gid, therefore this routine can\nbe used in a suid/sgid environment to test if the invoking user has the\nspecified access to the path.  The mode argument can be F_OK to test\nexistence, or the inclusive-OR of R_OK, W_OK, and X_OK.'
    pass

def chdir(path):
    'chdir(path)\n\nChange the current working directory to the specified path.'
    pass

def chmod(path, mode):
    'chmod(path, mode)\n\nChange the access permissions of a file.'
    pass

def close(fd):
    'close(fd)\n\nClose a file descriptor (for low level IO).'
    pass

def closerange(fd_low, fd_high):
    'closerange(fd_low, fd_high)\n\nCloses all file descriptors in [fd_low, fd_high), ignoring errors.'
    pass

def dup(fd):
    'dup(fd) -> fd2\n\nReturn a duplicate of a file descriptor.'
    pass

def dup2(old_fd, new_fd):
    'dup2(old_fd, new_fd)\n\nDuplicate file descriptor.'
    pass

environ = __builtin__.dict()
error = exceptions.OSError
def execv(path, args):
    'execv(path, args)\n\nExecute an executable path with arguments, replacing current process.\n\n    path: path of executable file\n    args: tuple or list of strings'
    pass

def execve(path, args, env):
    'execve(path, args, env)\n\nExecute a path with arguments and environment, replacing current process.\n\n    path: path of executable file\n    args: tuple or list of arguments\n    env: dictionary of strings mapping to strings'
    pass

def fdopen(fd, mode, bufsize):
    "fdopen(fd [, mode='r' [, bufsize]]) -> file_object\n\nReturn an open file object connected to a file descriptor."
    pass

def fstat(fd):
    'fstat(fd) -> stat result\n\nLike stat(), but for an open file descriptor.'
    pass

def fsync(fildes):
    'fsync(fildes)\n\nforce write of file with filedescriptor to disk.'
    pass

def getcwd():
    'getcwd() -> path\n\nReturn a string representing the current working directory.'
    pass

def getcwdu():
    'getcwdu() -> path\n\nReturn a unicode string representing the current working directory.'
    pass

def getpid():
    'getpid() -> pid\n\nReturn the current process id'
    pass

def isatty(fd):
    "isatty(fd) -> bool\n\nReturn True if the file descriptor 'fd' is an open file descriptor\nconnected to the slave end of a terminal."
    pass

def kill(pid, sig):
    'kill(pid, sig)\n\nKill a process with a signal.'
    pass

def listdir(path):
    "listdir(path) -> list_of_strings\n\nReturn a list containing the names of the entries in the directory.\n\n    path: path of directory to list\n\nThe list is in arbitrary order.  It does not include the special\nentries '.' and '..' even if they are present in the directory."
    pass

def lseek(fd, pos, how):
    'lseek(fd, pos, how) -> newpos\n\nSet the current position of a file descriptor.\nReturn the new cursor position in bytes, starting from the beginning.'
    pass

def lstat(path):
    'lstat(path) -> stat result\n\nLike stat(path), but do not follow symbolic links.'
    pass

def mkdir(path, mode=511):
    'mkdir(path [, mode=0777])\n\nCreate a directory.'
    pass

def open(filename, flag, mode=511):
    'open(filename, flag [, mode=0777]) -> fd\n\nOpen a file (for low level IO).'
    pass

def pipe():
    'pipe() -> (read_end, write_end)\n\nCreate a pipe.'
    pass

def popen(command, mode, bufsize):
    "popen(command [, mode='r' [, bufsize]]) -> pipe\n\nOpen a pipe to/from a command returning a file object."
    pass

def popen2():
    pass

def popen3():
    pass

def popen4():
    pass

def putenv(key, value):
    'putenv(key, value)\n\nChange or add an environment variable.'
    pass

def read(fd, buffersize):
    'read(fd, buffersize) -> string\n\nRead a file descriptor.'
    pass

def remove(path):
    'remove(path)\n\nRemove a file (same as unlink(path)).'
    pass

def rename(old, new):
    'rename(old, new)\n\nRename a file or directory.'
    pass

def rmdir(path):
    'rmdir(path)\n\nRemove a directory.'
    pass

def spawnv(mode, path, args):
    "spawnv(mode, path, args)\n\nExecute the program 'path' in a new process.\n\n    mode: mode of process creation\n    path: path of executable file\n    args: tuple or list of strings"
    pass

def spawnve(mode, path, args, env):
    "spawnve(mode, path, args, env)\n\nExecute the program 'path' in a new process.\n\n    mode: mode of process creation\n    path: path of executable file\n    args: tuple or list of arguments\n    env: dictionary of strings mapping to strings"
    pass

def startfile(filepath, operation):
    'startfile(filepath [, operation]) - Start a file with its associated\napplication.\n\nWhen "operation" is not specified or "open", this acts like\ndouble-clicking the file in Explorer, or giving the file name as an\nargument to the DOS "start" command: the file is opened with whatever\napplication (if any) its extension is associated.\nWhen another "operation" is given, it specifies what should be done with\nthe file.  A typical operation is "print".\n\nstartfile returns as soon as the associated application is launched.\nThere is no option to wait for the application to close, and no way\nto retrieve the application\'s exit status.\n\nThe filepath is relative to the current directory.  If you want to use\nan absolute path, make sure the first character is not a slash ("/");\nthe underlying Win32 ShellExecute function doesn\'t work if it is.'
    pass

def stat(path):
    'stat(path) -> stat result\n\nPerform a stat system call on the given path.'
    pass

def stat_float_times(newval):
    'stat_float_times([newval]) -> oldval\n\nDetermine whether os.[lf]stat represents time stamps as float objects.\nIf newval is True, future calls to stat() return floats, if it is False,\nfuture calls return ints. \nIf newval is omitted, return the current setting.\n'
    pass

class stat_result(__builtin__.object):
    'stat_result: Result from stat or lstat.\n\nThis object may be accessed either as a tuple of\n  (mode, ino, dev, nlink, uid, gid, size, atime, mtime, ctime)\nor via the attributes st_mode, st_ino, st_dev, st_nlink, st_uid, and so on.\n\nPosix/windows: If your platform supports st_blksize, st_blocks, st_rdev,\nor st_flags, they are available as attributes only.\n\nSee os.stat for more information.'
    def __add__(self, y):
        'x.__add__(y) <==> x+y'
        return stat_result()
    
    __class__ = stat_result
    def __contains__(self, value):
        'x.__contains__(y) <==> y in x'
        return False
    
    def __eq__(self, y):
        'x.__eq__(y) <==> x==y'
        return False
    
    def __ge__(self, y):
        'x.__ge__(y) <==> x>=y'
        return False
    
    def __getitem__(self, index):
        'x.__getitem__(y) <==> x[y]'
        pass
    
    def __getslice__(self, i, j):
        'x.__getslice__(i, j) <==> x[i:j]\n           \n           Use of negative indices is not supported.'
        return stat_result()
    
    def __gt__(self, y):
        'x.__gt__(y) <==> x>y'
        return False
    
    def __hash__(self):
        'x.__hash__() <==> hash(x)'
        return 0
    
    def __le__(self, y):
        'x.__le__(y) <==> x<=y'
        return False
    
    def __len__(self):
        'x.__len__() <==> len(x)'
        return 0
    
    def __lt__(self, y):
        'x.__lt__(y) <==> x<y'
        return False
    
    def __mul__(self, n):
        'x.__mul__(n) <==> x*n'
        return stat_result()
    
    def __ne__(self, y):
        'x.__ne__(y) <==> x!=y'
        return False
    
    def __reduce__(self):
        return ''; return ()
    
    def __repr__(self):
        'x.__repr__() <==> repr(x)'
        return ''
    
    def __rmul__(self, n):
        'x.__rmul__(n) <==> n*x'
        return stat_result()
    
    @classmethod
    def __subclasshook__(cls, subclass):
        'Abstract classes can override this to customize issubclass().\n\nThis is invoked early on by abc.ABCMeta.__subclasscheck__().\nIt should return True, False or NotImplemented.  If it returns\nNotImplemented, the normal algorithm is used.  Otherwise, it\noverrides the normal algorithm (and the outcome is cached).\n'
        return False
    
    n_fields = 13
    n_sequence_fields = 10
    n_unnamed_fields = 3
    @property
    def st_atime(self):
        'time of last access'
        pass
    
    @property
    def st_ctime(self):
        'time of last change'
        pass
    
    @property
    def st_dev(self):
        'device'
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
    

class statvfs_result(__builtin__.object):
    'statvfs_result: Result from statvfs or fstatvfs.\n\nThis object may be accessed either as a tuple of\n  (bsize, frsize, blocks, bfree, bavail, files, ffree, favail, flag, namemax),\nor via the attributes f_bsize, f_frsize, f_blocks, f_bfree, and so on.\n\nSee os.statvfs for more information.'
    def __add__(self, y):
        'x.__add__(y) <==> x+y'
        return statvfs_result()
    
    __class__ = statvfs_result
    def __contains__(self, value):
        'x.__contains__(y) <==> y in x'
        return False
    
    def __eq__(self, y):
        'x.__eq__(y) <==> x==y'
        return False
    
    def __ge__(self, y):
        'x.__ge__(y) <==> x>=y'
        return False
    
    def __getitem__(self, index):
        'x.__getitem__(y) <==> x[y]'
        pass
    
    def __getslice__(self, i, j):
        'x.__getslice__(i, j) <==> x[i:j]\n           \n           Use of negative indices is not supported.'
        return statvfs_result()
    
    def __gt__(self, y):
        'x.__gt__(y) <==> x>y'
        return False
    
    def __hash__(self):
        'x.__hash__() <==> hash(x)'
        return 0
    
    def __le__(self, y):
        'x.__le__(y) <==> x<=y'
        return False
    
    def __len__(self):
        'x.__len__() <==> len(x)'
        return 0
    
    def __lt__(self, y):
        'x.__lt__(y) <==> x<y'
        return False
    
    def __mul__(self, n):
        'x.__mul__(n) <==> x*n'
        return statvfs_result()
    
    def __ne__(self, y):
        'x.__ne__(y) <==> x!=y'
        return False
    
    def __reduce__(self):
        return ''; return ()
    
    def __repr__(self):
        'x.__repr__() <==> repr(x)'
        return ''
    
    def __rmul__(self, n):
        'x.__rmul__(n) <==> n*x'
        return statvfs_result()
    
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
    'strerror(code) -> string\n\nTranslate an error code to a message string.'
    pass

def system(command):
    'system(command) -> exit_status\n\nExecute the command (a string) in a subshell.'
    pass

def tempnam(dir, prefix):
    'tempnam([dir[, prefix]]) -> string\n\nReturn a unique name for a temporary file.\nThe directory and a prefix may be specified as strings; they may be omitted\nor None if not needed.'
    pass

def times():
    'times() -> (utime, stime, cutime, cstime, elapsed_time)\n\nReturn a tuple of floating point numbers indicating process times.'
    pass

def tmpfile():
    'tmpfile() -> file object\n\nCreate a temporary file with no directory entries.'
    pass

def tmpnam():
    'tmpnam() -> string\n\nReturn a unique name for a temporary file.'
    pass

def umask(new_mask):
    'umask(new_mask) -> old_mask\n\nSet the current numeric umask and return the previous umask.'
    pass

def unlink(path):
    'unlink(path)\n\nRemove a file (same as remove(path)).'
    pass

def urandom(n):
    'urandom(n) -> str\n\nReturn n random bytes suitable for cryptographic use.'
    pass

def utime(path, (atime, mtime)):
    'utime(path, (atime, mtime))\nutime(path, None)\n\nSet the access and modified time of the file to the given values.  If the\nsecond form is used, set the access and modified times to the current time.'
    pass

def waitpid(pid, options):
    'waitpid(pid, options) -> (pid, status << 8)\n\nWait for completion of a given process.  options is ignored on Windows.'
    pass

def write(fd, string):
    'write(fd, string) -> byteswritten\n\nWrite a string to a file descriptor.'
    pass

