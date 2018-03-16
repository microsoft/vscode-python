CRT_ASSEMBLY_VERSION = '14.0.24210.0'
LK_LOCK = 1
LK_NBLCK = 2
LK_NBRLCK = 4
LK_RLCK = 3
LK_UNLCK = 0
SEM_FAILCRITICALERRORS = 1
SEM_NOALIGNMENTFAULTEXCEPT = 4
SEM_NOGPFAULTERRORBOX = 2
SEM_NOOPENFILEERRORBOX = 32768
def SetErrorMode(mode):
    'Wrapper around SetErrorMode.'
    pass

__doc__ = None
__name__ = 'msvcrt'
__package__ = ''
def get_osfhandle(fd):
    'Return the file handle for the file descriptor fd.\n\nRaises IOError if fd is not recognized.'
    pass

def getch():
    "Read a keypress and return the resulting character as a byte string.\n\nNothing is echoed to the console. This call will block if a keypress is\nnot already available, but will not wait for Enter to be pressed. If the\npressed key was a special function key, this will return '\\000' or\n'\\xe0'; the next call will return the keycode. The Control-C keypress\ncannot be read with this function."
    pass

def getche():
    'Similar to getch(), but the keypress will be echoed if possible.'
    pass

def getwch():
    'Wide char variant of getch(), returning a Unicode value.'
    pass

def getwche():
    'Wide char variant of getche(), returning a Unicode value.'
    pass

def heapmin():
    'Minimize the malloc() heap.\n\nForce the malloc() heap to clean itself up and return unused blocks\nto the operating system. On failure, this raises OSError.'
    pass

def kbhit():
    'Return true if a keypress is waiting to be read.'
    pass

def locking(fd, mode, nbytes):
    'Lock part of a file based on file descriptor fd from the C runtime.\n\nRaises IOError on failure. The locked region of the file extends from\nthe current file position for nbytes bytes, and may continue beyond\nthe end of the file. mode must be one of the LK_* constants listed\nbelow. Multiple regions in a file may be locked at the same time, but\nmay not overlap. Adjacent regions are not merged; they must be unlocked\nindividually.'
    pass

def open_osfhandle(handle, flags):
    'Create a C runtime file descriptor from the file handle handle.\n\nThe flags parameter should be a bitwise OR of os.O_APPEND, os.O_RDONLY,\nand os.O_TEXT. The returned file descriptor may be used as a parameter\nto os.fdopen() to create a file object.'
    pass

def putch(char):
    'Print the byte string char to the console without buffering.'
    pass

def putwch(unicode_char):
    'Wide char variant of putch(), accepting a Unicode value.'
    pass

def setmode(fd, mode):
    'Set the line-end translation mode for the file descriptor fd.\n\nTo set it to text mode, flags should be os.O_TEXT; for binary, it\nshould be os.O_BINARY.\n\nReturn value is the previous mode.'
    pass

def ungetch(char):
    'Opposite of getch.\n\nCause the byte string char to be "pushed back" into the\nconsole buffer; it will be the next character read by\ngetch() or getche().'
    pass

def ungetwch(unicode_char):
    'Wide char variant of ungetch(), accepting a Unicode value.'
    pass

