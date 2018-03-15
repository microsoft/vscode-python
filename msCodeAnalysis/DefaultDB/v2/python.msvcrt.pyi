CRT_ASSEMBLY_VERSION = '9.0.21022.8'
LIBRARIES_ASSEMBLY_NAME_PREFIX = 'Microsoft.VC90'
LK_LOCK = 1
LK_NBLCK = 2
LK_NBRLCK = 4
LK_RLCK = 3
LK_UNLCK = 0
VC_ASSEMBLY_PUBLICKEYTOKEN = '1fc8b3b9a1e18e3b'
__doc__ = None
__name__ = 'msvcrt'
__package__ = None
def get_osfhandle(fd):
    'get_osfhandle(fd) -> file handle\n\nReturn the file handle for the file descriptor fd. Raises IOError\nif fd is not recognized.'
    pass

def getch():
    "getch() -> key character\n\nRead a keypress and return the resulting character. Nothing is echoed to\nthe console. This call will block if a keypress is not already\navailable, but will not wait for Enter to be pressed. If the pressed key\nwas a special function key, this will return '\\000' or '\\xe0'; the next\ncall will return the keycode. The Control-C keypress cannot be read with\nthis function."
    pass

def getche():
    'getche() -> key character\n\nSimilar to getch(), but the keypress will be echoed if it represents\na printable character.'
    pass

def getwch():
    'getwch() -> Unicode key character\n\nWide char variant of getch(), returning a Unicode value.'
    pass

def getwche():
    'getwche() -> Unicode key character\n\nWide char variant of getche(), returning a Unicode value.'
    pass

def heapmin():
    'heapmin() -> None\n\nForce the malloc() heap to clean itself up and return unused blocks\nto the operating system. On failure, this raises IOError.'
    pass

def kbhit():
    'kbhit() -> bool\n\nReturn true if a keypress is waiting to be read.'
    pass

def locking(fd, mode, nbytes):
    'locking(fd, mode, nbytes) -> None\n\nLock part of a file based on file descriptor fd from the C runtime.\nRaises IOError on failure. The locked region of the file extends from\nthe current file position for nbytes bytes, and may continue beyond\nthe end of the file. mode must be one of the LK_* constants listed\nbelow. Multiple regions in a file may be locked at the same time, but\nmay not overlap. Adjacent regions are not merged; they must be unlocked\nindividually.'
    pass

def open_osfhandle(handle, flags):
    'open_osfhandle(handle, flags) -> file descriptor\n\nCreate a C runtime file descriptor from the file handle handle. The\nflags parameter should be a bitwise OR of os.O_APPEND, os.O_RDONLY,\nand os.O_TEXT. The returned file descriptor may be used as a parameter\nto os.fdopen() to create a file object.'
    pass

def putch(char):
    'putch(char) -> None\n\nPrint the character char to the console without buffering.'
    pass

def putwch(unicode_char):
    'putwch(unicode_char) -> None\n\nWide char variant of putch(), accepting a Unicode value.'
    pass

def setmode(fd, mode):
    'setmode(fd, mode) -> Previous mode\n\nSet the line-end translation mode for the file descriptor fd. To set\nit to text mode, flags should be os.O_TEXT; for binary, it should be\nos.O_BINARY.'
    pass

def ungetch(char):
    'ungetch(char) -> None\n\nCause the character char to be "pushed back" into the console buffer;\nit will be the next character read by getch() or getche().'
    pass

def ungetwch(unicode_char):
    'ungetwch(unicode_char) -> None\n\nWide char variant of ungetch(), accepting a Unicode value.'
    pass

