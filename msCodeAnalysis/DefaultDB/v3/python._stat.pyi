FILE_ATTRIBUTE_ARCHIVE = 32
FILE_ATTRIBUTE_COMPRESSED = 2048
FILE_ATTRIBUTE_DEVICE = 64
FILE_ATTRIBUTE_DIRECTORY = 16
FILE_ATTRIBUTE_ENCRYPTED = 16384
FILE_ATTRIBUTE_HIDDEN = 2
FILE_ATTRIBUTE_INTEGRITY_STREAM = 32768
FILE_ATTRIBUTE_NORMAL = 128
FILE_ATTRIBUTE_NOT_CONTENT_INDEXED = 8192
FILE_ATTRIBUTE_NO_SCRUB_DATA = 131072
FILE_ATTRIBUTE_OFFLINE = 4096
FILE_ATTRIBUTE_READONLY = 1
FILE_ATTRIBUTE_REPARSE_POINT = 1024
FILE_ATTRIBUTE_SPARSE_FILE = 512
FILE_ATTRIBUTE_SYSTEM = 4
FILE_ATTRIBUTE_TEMPORARY = 256
FILE_ATTRIBUTE_VIRTUAL = 65536
SF_APPEND = 262144
SF_ARCHIVED = 65536
SF_IMMUTABLE = 131072
SF_NOUNLINK = 1048576
SF_SNAPSHOT = 2097152
ST_ATIME = 7
ST_CTIME = 9
ST_DEV = 2
ST_GID = 5
ST_INO = 1
ST_MODE = 0
ST_MTIME = 8
ST_NLINK = 3
ST_SIZE = 6
ST_UID = 4
S_ENFMT = 1024
S_IEXEC = 64
S_IFBLK = 24576
S_IFCHR = 8192
S_IFDIR = 16384
S_IFDOOR = 0
S_IFIFO = 4096
S_IFLNK = 40960
def S_IFMT():
    "Return the portion of the file's mode that describes the file type."
    pass

S_IFPORT = 0
S_IFREG = 32768
S_IFSOCK = 49152
S_IFWHT = 0
def S_IMODE():
    "Return the portion of the file's mode that can be set by os.chmod()."
    pass

S_IREAD = 256
S_IRGRP = 32
S_IROTH = 4
S_IRUSR = 256
S_IRWXG = 56
S_IRWXO = 7
S_IRWXU = 448
def S_ISBLK(mode):
    'S_ISBLK(mode) -> bool\n\nReturn True if mode is from a block special device file.'
    pass

def S_ISCHR(mode):
    'S_ISCHR(mode) -> bool\n\nReturn True if mode is from a character special device file.'
    pass

def S_ISDIR(mode):
    'S_ISDIR(mode) -> bool\n\nReturn True if mode is from a directory.'
    pass

def S_ISDOOR(mode):
    'S_ISDOOR(mode) -> bool\n\nReturn True if mode is from a door.'
    pass

def S_ISFIFO(mode):
    'S_ISFIFO(mode) -> bool\n\nReturn True if mode is from a FIFO (named pipe).'
    pass

S_ISGID = 1024
def S_ISLNK(mode):
    'S_ISLNK(mode) -> bool\n\nReturn True if mode is from a symbolic link.'
    pass

def S_ISPORT(mode):
    'S_ISPORT(mode) -> bool\n\nReturn True if mode is from an event port.'
    pass

def S_ISREG(mode):
    'S_ISREG(mode) -> bool\n\nReturn True if mode is from a regular file.'
    pass

def S_ISSOCK(mode):
    'S_ISSOCK(mode) -> bool\n\nReturn True if mode is from a socket.'
    pass

S_ISUID = 2048
S_ISVTX = 512
def S_ISWHT(mode):
    'S_ISWHT(mode) -> bool\n\nReturn True if mode is from a whiteout.'
    pass

S_IWGRP = 16
S_IWOTH = 2
S_IWRITE = 128
S_IWUSR = 128
S_IXGRP = 8
S_IXOTH = 1
S_IXUSR = 64
UF_APPEND = 4
UF_COMPRESSED = 32
UF_HIDDEN = 32768
UF_IMMUTABLE = 2
UF_NODUMP = 1
UF_NOUNLINK = 16
UF_OPAQUE = 8
__doc__ = 'S_IFMT_: file type bits\nS_IFDIR: directory\nS_IFCHR: character device\nS_IFBLK: block device\nS_IFREG: regular file\nS_IFIFO: fifo (named pipe)\nS_IFLNK: symbolic link\nS_IFSOCK: socket file\nS_IFDOOR: door\nS_IFPORT: event port\nS_IFWHT: whiteout\n\nS_ISUID: set UID bit\nS_ISGID: set GID bit\nS_ENFMT: file locking enforcement\nS_ISVTX: sticky bit\nS_IREAD: Unix V7 synonym for S_IRUSR\nS_IWRITE: Unix V7 synonym for S_IWUSR\nS_IEXEC: Unix V7 synonym for S_IXUSR\nS_IRWXU: mask for owner permissions\nS_IRUSR: read by owner\nS_IWUSR: write by owner\nS_IXUSR: execute by owner\nS_IRWXG: mask for group permissions\nS_IRGRP: read by group\nS_IWGRP: write by group\nS_IXGRP: execute by group\nS_IRWXO: mask for others (not in group) permissions\nS_IROTH: read by others\nS_IWOTH: write by others\nS_IXOTH: execute by others\n\nUF_NODUMP: do not dump file\nUF_IMMUTABLE: file may not be changed\nUF_APPEND: file may only be appended to\nUF_OPAQUE: directory is opaque when viewed through a union stack\nUF_NOUNLINK: file may not be renamed or deleted\nUF_COMPRESSED: OS X: file is hfs-compressed\nUF_HIDDEN: OS X: file should not be displayed\nSF_ARCHIVED: file may be archived\nSF_IMMUTABLE: file may not be changed\nSF_APPEND: file may only be appended to\nSF_NOUNLINK: file may not be renamed or deleted\nSF_SNAPSHOT: file is a snapshot file\n\nST_MODE\nST_INO\nST_DEV\nST_NLINK\nST_UID\nST_GID\nST_SIZE\nST_ATIME\nST_MTIME\nST_CTIME\n\nFILE_ATTRIBUTE_*: Windows file attribute constants\n                   (only present on Windows)\n'
__name__ = '_stat'
__package__ = ''
def filemode():
    "Convert a file's mode to a string of the form '-rwxrwxrwx'"
    pass

