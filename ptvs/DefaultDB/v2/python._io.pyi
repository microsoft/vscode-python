import __builtin__
import io

BlockingIOError = __builtin__.BlockingIOError
class BufferedRWPair(_BufferedIOBase):
    'A buffered reader and writer object together.\n\nA buffered reader object and buffered writer object put together to\nform a sequential IO object that can read and write. This is typically\nused with a socket or two-way pipe.\n\nreader and writer are RawIOBase objects that are readable and\nwriteable respectively. If the buffer_size is omitted it defaults to\nDEFAULT_BUFFER_SIZE.\n'
    __class__ = BufferedRWPair
    def __init__(self):
        'x.__init__(...) initializes x; see help(type(x)) for signature'
        pass
    
    @classmethod
    def __subclasshook__(cls, subclass):
        'Abstract classes can override this to customize issubclass().\n\nThis is invoked early on by abc.ABCMeta.__subclasscheck__().\nIt should return True, False or NotImplemented.  If it returns\nNotImplemented, the normal algorithm is used.  Otherwise, it\noverrides the normal algorithm (and the outcome is cached).\n'
        return False
    
    def close(self):
        pass
    
    @property
    def closed(self):
        pass
    
    def flush(self):
        pass
    
    def isatty(self):
        pass
    
    def peek(self):
        pass
    
    def read(self):
        pass
    
    def read1(self):
        pass
    
    def readable(self):
        pass
    
    def readinto(self):
        pass
    
    def writable(self):
        pass
    
    def write(self):
        pass
    

class BufferedRandom(_BufferedIOBase):
    "A buffered interface to random access streams.\n\nThe constructor creates a reader and writer for a seekable stream,\nraw, given in the first argument. If the buffer_size is omitted it\ndefaults to DEFAULT_BUFFER_SIZE. max_buffer_size isn't used anymore.\n"
    __class__ = BufferedRandom
    def __init__(self):
        'x.__init__(...) initializes x; see help(type(x)) for signature'
        pass
    
    def __repr__(self):
        'x.__repr__() <==> repr(x)'
        return ''
    
    def __sizeof__(self):
        return 0
    
    @classmethod
    def __subclasshook__(cls, subclass):
        'Abstract classes can override this to customize issubclass().\n\nThis is invoked early on by abc.ABCMeta.__subclasscheck__().\nIt should return True, False or NotImplemented.  If it returns\nNotImplemented, the normal algorithm is used.  Otherwise, it\noverrides the normal algorithm (and the outcome is cached).\n'
        return False
    
    def close(self):
        pass
    
    @property
    def closed(self):
        pass
    
    def detach(self):
        pass
    
    def fileno(self):
        pass
    
    def flush(self):
        pass
    
    def isatty(self):
        pass
    
    @property
    def mode(self):
        pass
    
    @property
    def name(self):
        pass
    
    def next(self):
        'x.next() -> the next value, or raise StopIteration'
        pass
    
    def peek(self):
        pass
    
    @property
    def raw(self):
        pass
    
    def read(self):
        pass
    
    def read1(self):
        pass
    
    def readable(self):
        pass
    
    def readinto(self):
        pass
    
    def readline(self):
        pass
    
    def seek(self):
        pass
    
    def seekable(self):
        pass
    
    def tell(self):
        pass
    
    def truncate(self):
        pass
    
    def writable(self):
        pass
    
    def write(self):
        pass
    

class BufferedReader(_BufferedIOBase):
    'Create a new buffered reader using the given readable raw IO object.'
    __class__ = BufferedReader
    def __init__(self):
        'x.__init__(...) initializes x; see help(type(x)) for signature'
        pass
    
    def __repr__(self):
        'x.__repr__() <==> repr(x)'
        return ''
    
    def __sizeof__(self):
        return 0
    
    @classmethod
    def __subclasshook__(cls, subclass):
        'Abstract classes can override this to customize issubclass().\n\nThis is invoked early on by abc.ABCMeta.__subclasscheck__().\nIt should return True, False or NotImplemented.  If it returns\nNotImplemented, the normal algorithm is used.  Otherwise, it\noverrides the normal algorithm (and the outcome is cached).\n'
        return False
    
    def close(self):
        pass
    
    @property
    def closed(self):
        pass
    
    def detach(self):
        pass
    
    def fileno(self):
        pass
    
    def flush(self):
        pass
    
    def isatty(self):
        pass
    
    @property
    def mode(self):
        pass
    
    @property
    def name(self):
        pass
    
    def next(self):
        'x.next() -> the next value, or raise StopIteration'
        pass
    
    def peek(self):
        pass
    
    @property
    def raw(self):
        pass
    
    def read(self):
        pass
    
    def read1(self):
        pass
    
    def readable(self):
        pass
    
    def readline(self):
        pass
    
    def seek(self):
        pass
    
    def seekable(self):
        pass
    
    def tell(self):
        pass
    
    def truncate(self):
        pass
    
    def writable(self):
        pass
    

class BufferedWriter(_BufferedIOBase):
    "A buffer for a writeable sequential RawIO object.\n\nThe constructor creates a BufferedWriter for the given writeable raw\nstream. If the buffer_size is not given, it defaults to\nDEFAULT_BUFFER_SIZE. max_buffer_size isn't used anymore.\n"
    __class__ = BufferedWriter
    def __init__(self):
        'x.__init__(...) initializes x; see help(type(x)) for signature'
        pass
    
    def __repr__(self):
        'x.__repr__() <==> repr(x)'
        return ''
    
    def __sizeof__(self):
        return 0
    
    @classmethod
    def __subclasshook__(cls, subclass):
        'Abstract classes can override this to customize issubclass().\n\nThis is invoked early on by abc.ABCMeta.__subclasscheck__().\nIt should return True, False or NotImplemented.  If it returns\nNotImplemented, the normal algorithm is used.  Otherwise, it\noverrides the normal algorithm (and the outcome is cached).\n'
        return False
    
    def close(self):
        pass
    
    @property
    def closed(self):
        pass
    
    def detach(self):
        pass
    
    def fileno(self):
        pass
    
    def flush(self):
        pass
    
    def isatty(self):
        pass
    
    @property
    def mode(self):
        pass
    
    @property
    def name(self):
        pass
    
    @property
    def raw(self):
        pass
    
    def readable(self):
        pass
    
    def seek(self):
        pass
    
    def seekable(self):
        pass
    
    def tell(self):
        pass
    
    def truncate(self):
        pass
    
    def writable(self):
        pass
    
    def write(self):
        pass
    

class BytesIO(_BufferedIOBase):
    'BytesIO([buffer]) -> object\n\nCreate a buffered I/O implementation using an in-memory bytes\nbuffer, ready for reading and writing.'
    __class__ = BytesIO
    def __getstate__(self):
        pass
    
    def __init__(self, buffer):
        'x.__init__(...) initializes x; see help(type(x)) for signature'
        pass
    
    def __iter__(self):
        'x.__iter__() <==> iter(x)'
        return BytesIO()
    
    def __setstate__(self, state):
        return None
    
    def __sizeof__(self):
        return 0
    
    @classmethod
    def __subclasshook__(cls, subclass):
        'Abstract classes can override this to customize issubclass().\n\nThis is invoked early on by abc.ABCMeta.__subclasscheck__().\nIt should return True, False or NotImplemented.  If it returns\nNotImplemented, the normal algorithm is used.  Otherwise, it\noverrides the normal algorithm (and the outcome is cached).\n'
        return False
    
    def close(self):
        'close() -> None.  Disable all I/O operations.'
        pass
    
    @property
    def closed(self):
        'True if the file is closed.'
        pass
    
    def flush(self):
        'flush() -> None.  Does nothing.'
        pass
    
    def getvalue(self):
        'getvalue() -> bytes.\n\nRetrieve the entire contents of the BytesIO object.'
        pass
    
    def isatty(self):
        'isatty() -> False.\n\nAlways returns False since BytesIO objects are not connected\nto a tty-like device.'
        pass
    
    def next(self):
        'x.next() -> the next value, or raise StopIteration'
        pass
    
    def read(self, size):
        'read([size]) -> read at most size bytes, returned as a string.\n\nIf the size argument is negative, read until EOF is reached.\nReturn an empty string at EOF.'
        pass
    
    def read1(self, size):
        'read1(size) -> read at most size bytes, returned as a string.\n\nIf the size argument is negative or omitted, read until EOF is reached.\nReturn an empty string at EOF.'
        pass
    
    def readable(self):
        'readable() -> bool. Returns True if the IO object can be read.'
        pass
    
    def readinto(self, b):
        'readinto(b) -> int.  Read up to len(b) bytes into b.\n\nReturns number of bytes read (0 for EOF), or None if the object\nis set not to block and has no data to read.'
        pass
    
    def readline(self, size):
        'readline([size]) -> next line from the file, as a string.\n\nRetain newline.  A non-negative size argument limits the maximum\nnumber of bytes to return (an incomplete line may be returned then).\nReturn an empty string at EOF.\n'
        pass
    
    def readlines(self, size):
        'readlines([size]) -> list of strings, each a line from the file.\n\nCall readline() repeatedly and return a list of the lines so read.\nThe optional size argument, if given, is an approximate bound on the\ntotal number of bytes in the lines returned.\n'
        pass
    
    def seek(self, pos, whence):
        'seek(pos[, whence]) -> int.  Change stream position.\n\nSeek to byte offset pos relative to position indicated by whence:\n     0  Start of stream (the default).  pos should be >= 0;\n     1  Current position - pos may be negative;\n     2  End of stream - pos usually negative.\nReturns the new absolute position.'
        pass
    
    def seekable(self):
        'seekable() -> bool. Returns True if the IO object can be seeked.'
        pass
    
    def tell(self):
        'tell() -> current file position, an integer\n'
        pass
    
    def truncate(self, size):
        'truncate([size]) -> int.  Truncate the file to at most size bytes.\n\nSize defaults to the current file position, as returned by tell().\nThe current file position is unchanged.  Returns the new size.\n'
        pass
    
    def writable(self):
        'writable() -> bool. Returns True if the IO object can be written.'
        pass
    
    def write(self, bytes):
        'write(bytes) -> int.  Write bytes to file.\n\nReturn the number of bytes written.'
        pass
    
    def writelines(self, sequence_of_strings):
        'writelines(sequence_of_strings) -> None.  Write strings to the file.\n\nNote that newlines are not added.  The sequence can be any iterable\nobject producing strings. This is equivalent to calling write() for\neach string.'
        pass
    

DEFAULT_BUFFER_SIZE = 8192
class FileIO(_RawIOBase):
    "file(name: str[, mode: str]) -> file IO object\n\nOpen a file.  The mode can be 'r' (default), 'w' or 'a' for reading,\nwriting or appending.  The file will be created if it doesn't exist\nwhen opened for writing or appending; it will be truncated when\nopened for writing.  Add a '+' to the mode to allow simultaneous\nreading and writing."
    __class__ = FileIO
    def __getattribute__(self):
        "x.__getattribute__('name') <==> x.name"
        pass
    
    def __init__(self):
        'x.__init__(...) initializes x; see help(type(x)) for signature'
        pass
    
    def __repr__(self):
        'x.__repr__() <==> repr(x)'
        return ''
    
    @classmethod
    def __subclasshook__(cls, subclass):
        'Abstract classes can override this to customize issubclass().\n\nThis is invoked early on by abc.ABCMeta.__subclasscheck__().\nIt should return True, False or NotImplemented.  If it returns\nNotImplemented, the normal algorithm is used.  Otherwise, it\noverrides the normal algorithm (and the outcome is cached).\n'
        return False
    
    def close(self):
        'close() -> None.  Close the file.\n\nA closed file cannot be used for further I/O operations.  close() may be\ncalled more than once without error.'
        pass
    
    @property
    def closed(self):
        'True if the file is closed'
        pass
    
    @property
    def closefd(self):
        'True if the file descriptor will be closed by close().'
        pass
    
    def fileno(self):
        'fileno() -> int.  Return the underlying file descriptor (an integer).'
        pass
    
    def isatty(self):
        'isatty() -> bool.  True if the file is connected to a TTY device.'
        pass
    
    @property
    def mode(self):
        'String giving the file mode'
        pass
    
    def read(self):
        "read(size: int) -> bytes.  read at most size bytes, returned as bytes.\n\nOnly makes one system call, so less data may be returned than requested\nIn non-blocking mode, returns None if no data is available.\nOn end-of-file, returns ''."
        pass
    
    def readable(self):
        'readable() -> bool.  True if file was opened in a read mode.'
        pass
    
    def readall(self):
        "readall() -> bytes.  read all data from the file, returned as bytes.\n\nIn non-blocking mode, returns as much as is immediately available,\nor None if no data is available.  On end-of-file, returns ''."
        pass
    
    def readinto(self):
        'readinto() -> Same as RawIOBase.readinto().'
        pass
    
    def seek(self):
        'seek(offset: int[, whence: int]) -> int.  Move to new file position\nand return the file position.\n\nArgument offset is a byte count.  Optional argument whence defaults to\nSEEK_SET or 0 (offset from start of file, offset should be >= 0); other values\nare SEEK_CUR or 1 (move relative to current position, positive or negative),\nand SEEK_END or 2 (move relative to end of file, usually negative, although\nmany platforms allow seeking beyond the end of a file).\n\nNote that not all file objects are seekable.'
        pass
    
    def seekable(self):
        'seekable() -> bool.  True if file supports random-access.'
        pass
    
    def tell(self):
        'tell() -> int.  Current file position.\n\nCan raise OSError for non seekable files.'
        pass
    
    def truncate(self):
        'truncate([size: int]) -> int.  Truncate the file to at most size bytes and\nreturn the truncated size.\n\nSize defaults to the current file position, as returned by tell().\nThe current file position is changed to the value of size.'
        pass
    
    def writable(self):
        'writable() -> bool.  True if file was opened in a write mode.'
        pass
    
    def write(self, b):
        'write(b) -> int.  Write array of bytes b, return number written.\n\nOnly makes one system call, so not all of the data may be written.\nThe number of bytes actually written is returned.  In non-blocking mode,\nreturns None if the write would block.'
        pass
    

class IncrementalNewlineDecoder(__builtin__.object):
    'Codec used when reading a file in universal newlines mode.  It wraps\nanother incremental decoder, translating \\r\\n and \\r into \\n.  It also\nrecords the types of newlines encountered.  When used with\ntranslate=False, it ensures that the newline sequence is returned in\none piece. When used with decoder=None, it expects unicode strings as\ndecode input and translates newlines without first invoking an external\ndecoder.\n'
    __class__ = IncrementalNewlineDecoder
    def __init__(self):
        'x.__init__(...) initializes x; see help(type(x)) for signature'
        pass
    
    @classmethod
    def __subclasshook__(cls, subclass):
        'Abstract classes can override this to customize issubclass().\n\nThis is invoked early on by abc.ABCMeta.__subclasscheck__().\nIt should return True, False or NotImplemented.  If it returns\nNotImplemented, the normal algorithm is used.  Otherwise, it\noverrides the normal algorithm (and the outcome is cached).\n'
        return False
    
    def decode(self):
        pass
    
    def getstate(self):
        pass
    
    @property
    def newlines(self):
        pass
    
    def reset(self):
        pass
    
    def setstate(self):
        pass
    

class StringIO(_TextIOBase):
    "Text I/O implementation using an in-memory buffer.\n\nThe initial_value argument sets the value of object.  The newline\nargument is like the one of TextIOWrapper's constructor."
    __class__ = StringIO
    def __getstate__(self):
        pass
    
    def __init__(self):
        'x.__init__(...) initializes x; see help(type(x)) for signature'
        pass
    
    def __setstate__(self, state):
        return None
    
    @classmethod
    def __subclasshook__(cls, subclass):
        'Abstract classes can override this to customize issubclass().\n\nThis is invoked early on by abc.ABCMeta.__subclasscheck__().\nIt should return True, False or NotImplemented.  If it returns\nNotImplemented, the normal algorithm is used.  Otherwise, it\noverrides the normal algorithm (and the outcome is cached).\n'
        return False
    
    def close(self):
        'Close the IO object. Attempting any further operation after the\nobject is closed will raise a ValueError.\n\nThis method has no effect if the file is already closed.\n'
        pass
    
    @property
    def closed(self):
        pass
    
    def getvalue(self):
        'Retrieve the entire contents of the object.'
        pass
    
    @property
    def line_buffering(self):
        pass
    
    @property
    def newlines(self):
        pass
    
    def next(self):
        'x.next() -> the next value, or raise StopIteration'
        pass
    
    def read(self):
        'Read at most n characters, returned as a string.\n\nIf the argument is negative or omitted, read until EOF\nis reached. Return an empty string at EOF.\n'
        pass
    
    def readable(self):
        'readable() -> bool. Returns True if the IO object can be read.'
        pass
    
    def readline(self):
        'Read until newline or EOF.\n\nReturns an empty string if EOF is hit immediately.\n'
        pass
    
    def seek(self):
        'Change stream position.\n\nSeek to character offset pos relative to position indicated by whence:\n    0  Start of stream (the default).  pos should be >= 0;\n    1  Current position - pos must be 0;\n    2  End of stream - pos must be 0.\nReturns the new absolute position.\n'
        pass
    
    def seekable(self):
        'seekable() -> bool. Returns True if the IO object can be seeked.'
        pass
    
    def tell(self):
        'Tell the current file position.'
        pass
    
    def truncate(self):
        'Truncate size to pos.\n\nThe pos argument defaults to the current file position, as\nreturned by tell().  The current file position is unchanged.\nReturns the new absolute position.\n'
        pass
    
    def writable(self):
        'writable() -> bool. Returns True if the IO object can be written.'
        pass
    
    def write(self):
        'Write string to file.\n\nReturns the number of characters written, which is always equal to\nthe length of the string.\n'
        pass
    

class TextIOWrapper(_TextIOBase):
    'Character and line based layer over a BufferedIOBase object, buffer.\n\nencoding gives the name of the encoding that the stream will be\ndecoded or encoded with. It defaults to locale.getpreferredencoding.\n\nerrors determines the strictness of encoding and decoding (see the\ncodecs.register) and defaults to "strict".\n\nnewline controls how line endings are handled. It can be None, \'\',\n\'\\n\', \'\\r\', and \'\\r\\n\'.  It works as follows:\n\n* On input, if newline is None, universal newlines mode is\n  enabled. Lines in the input can end in \'\\n\', \'\\r\', or \'\\r\\n\', and\n  these are translated into \'\\n\' before being returned to the\n  caller. If it is \'\', universal newline mode is enabled, but line\n  endings are returned to the caller untranslated. If it has any of\n  the other legal values, input lines are only terminated by the given\n  string, and the line ending is returned to the caller untranslated.\n\n* On output, if newline is None, any \'\\n\' characters written are\n  translated to the system default line separator, os.linesep. If\n  newline is \'\', no translation takes place. If newline is any of the\n  other legal values, any \'\\n\' characters written are translated to\n  the given string.\n\nIf line_buffering is True, a call to flush is implied when a call to\nwrite contains a newline character.'
    @property
    def _CHUNK_SIZE(self):
        pass
    
    __class__ = TextIOWrapper
    def __init__(self):
        'x.__init__(...) initializes x; see help(type(x)) for signature'
        pass
    
    def __repr__(self):
        'x.__repr__() <==> repr(x)'
        return ''
    
    @classmethod
    def __subclasshook__(cls, subclass):
        'Abstract classes can override this to customize issubclass().\n\nThis is invoked early on by abc.ABCMeta.__subclasscheck__().\nIt should return True, False or NotImplemented.  If it returns\nNotImplemented, the normal algorithm is used.  Otherwise, it\noverrides the normal algorithm (and the outcome is cached).\n'
        return False
    
    @property
    def buffer(self):
        pass
    
    def close(self):
        pass
    
    @property
    def closed(self):
        pass
    
    def detach(self):
        pass
    
    @property
    def encoding(self):
        pass
    
    @property
    def errors(self):
        pass
    
    def fileno(self):
        pass
    
    def flush(self):
        pass
    
    def isatty(self):
        pass
    
    @property
    def line_buffering(self):
        pass
    
    @property
    def name(self):
        pass
    
    @property
    def newlines(self):
        pass
    
    def next(self):
        'x.next() -> the next value, or raise StopIteration'
        pass
    
    def read(self):
        pass
    
    def readable(self):
        pass
    
    def readline(self):
        pass
    
    def seek(self):
        pass
    
    def seekable(self):
        pass
    
    def tell(self):
        pass
    
    def truncate(self):
        pass
    
    def writable(self):
        pass
    
    def write(self):
        pass
    

UnsupportedOperation = io.UnsupportedOperation
class _BufferedIOBase(_IOBase):
    'Base class for buffered IO objects.\n\nThe main difference with RawIOBase is that the read() method\nsupports omitting the size argument, and does not have a default\nimplementation that defers to readinto().\n\nIn addition, read(), readinto() and write() may raise\nBlockingIOError if the underlying raw stream is in non-blocking\nmode and not ready; unlike their raw counterparts, they will never\nreturn None.\n\nA typical implementation should not inherit from a RawIOBase\nimplementation, but wrap one.\n'
    __class__ = _BufferedIOBase
    @classmethod
    def __subclasshook__(cls, subclass):
        'Abstract classes can override this to customize issubclass().\n\nThis is invoked early on by abc.ABCMeta.__subclasscheck__().\nIt should return True, False or NotImplemented.  If it returns\nNotImplemented, the normal algorithm is used.  Otherwise, it\noverrides the normal algorithm (and the outcome is cached).\n'
        return False
    
    def detach(self):
        'Disconnect this buffer from its underlying raw stream and return it.\n\nAfter the raw stream has been detached, the buffer is in an unusable\nstate.\n'
        pass
    
    def read(self):
        "Read and return up to n bytes.\n\nIf the argument is omitted, None, or negative, reads and\nreturns all data until EOF.\n\nIf the argument is positive, and the underlying raw stream is\nnot 'interactive', multiple raw reads may be issued to satisfy\nthe byte count (unless EOF is reached first).  But for\ninteractive raw streams (as well as sockets and pipes), at most\none raw read will be issued, and a short result does not imply\nthat EOF is imminent.\n\nReturns an empty bytes object on EOF.\n\nReturns None if the underlying raw stream was open in non-blocking\nmode and no data is available at the moment.\n"
        pass
    
    def read1(self):
        'Read and return up to n bytes, with at most one read() call\nto the underlying raw stream. A short result does not imply\nthat EOF is imminent.\n\nReturns an empty bytes object on EOF.\n'
        pass
    
    def readinto(self):
        pass
    
    def write(self):
        'Write the given buffer to the IO stream.\n\nReturns the number of bytes written, which is always len(b).\n\nRaises BlockingIOError if the buffer is full and the\nunderlying raw stream cannot accept more data at the moment.\n'
        pass
    

class _IOBase(__builtin__.object):
    "The abstract base class for all I/O classes, acting on streams of\nbytes. There is no public constructor.\n\nThis class provides dummy implementations for many methods that\nderived classes can override selectively; the default implementations\nrepresent a file that cannot be read, written or seeked.\n\nEven though IOBase does not declare read, readinto, or write because\ntheir signatures will vary, implementations and clients should\nconsider those methods part of the interface. Also, implementations\nmay raise an IOError when operations they do not support are called.\n\nThe basic type used for binary data read from or written to a file is\nthe bytes type. Method arguments may also be bytearray or memoryview\nof arrays of bytes. In some cases, such as readinto, a writable\nobject such as bytearray is required. Text I/O classes work with\nunicode data.\n\nNote that calling any method (except additional calls to close(),\nwhich are ignored) on a closed stream should raise a ValueError.\n\nIOBase (and its subclasses) support the iterator protocol, meaning\nthat an IOBase object can be iterated over yielding the lines in a\nstream.\n\nIOBase also supports the :keyword:`with` statement. In this example,\nfp is closed after the suite of the with statement is complete:\n\nwith open('spam.txt', 'r') as fp:\n    fp.write('Spam and eggs!')\n"
    __class__ = _IOBase
    def __enter__(self):
        pass
    
    def __exit__(self):
        pass
    
    def __iter__(self):
        'x.__iter__() <==> iter(x)'
        return _IOBase()
    
    @classmethod
    def __subclasshook__(cls, subclass):
        'Abstract classes can override this to customize issubclass().\n\nThis is invoked early on by abc.ABCMeta.__subclasscheck__().\nIt should return True, False or NotImplemented.  If it returns\nNotImplemented, the normal algorithm is used.  Otherwise, it\noverrides the normal algorithm (and the outcome is cached).\n'
        return False
    
    def _checkClosed(self):
        pass
    
    def _checkReadable(self):
        pass
    
    def _checkSeekable(self):
        pass
    
    def _checkWritable(self):
        pass
    
    def close(self):
        'Flush and close the IO object.\n\nThis method has no effect if the file is already closed.\n'
        pass
    
    @property
    def closed(self):
        pass
    
    def fileno(self):
        'Returns underlying file descriptor if one exists.\n\nAn IOError is raised if the IO object does not use a file descriptor.\n'
        pass
    
    def flush(self):
        'Flush write buffers, if applicable.\n\nThis is not implemented for read-only and non-blocking streams.\n'
        pass
    
    def isatty(self):
        "Return whether this is an 'interactive' stream.\n\nReturn False if it can't be determined.\n"
        pass
    
    def next(self):
        'x.next() -> the next value, or raise StopIteration'
        pass
    
    def readable(self):
        'Return whether object was opened for reading.\n\nIf False, read() will raise IOError.'
        pass
    
    def readline(self):
        "Read and return a line from the stream.\n\nIf limit is specified, at most limit bytes will be read.\n\nThe line terminator is always b'\\n' for binary files; for text\nfiles, the newlines argument to open can be used to select the line\nterminator(s) recognized.\n"
        pass
    
    def readlines(self):
        'Return a list of lines from the stream.\n\nhint can be specified to control the number of lines read: no more\nlines will be read if the total size (in bytes/characters) of all\nlines so far exceeds hint.'
        pass
    
    def seek(self):
        'Change stream position.\n\nChange the stream position to the given byte offset. The offset is\ninterpreted relative to the position indicated by whence.  Values\nfor whence are:\n\n* 0 -- start of stream (the default); offset should be zero or positive\n* 1 -- current stream position; offset may be negative\n* 2 -- end of stream; offset is usually negative\n\nReturn the new absolute position.'
        pass
    
    def seekable(self):
        'Return whether object supports random access.\n\nIf False, seek(), tell() and truncate() will raise IOError.\nThis method may need to do a test seek().'
        pass
    
    def tell(self):
        'Return current stream position.'
        pass
    
    def truncate(self):
        'Truncate file to size bytes.\n\nFile pointer is left unchanged.  Size defaults to the current IO\nposition as reported by tell().  Returns the new size.'
        pass
    
    def writable(self):
        'Return whether object was opened for writing.\n\nIf False, read() will raise IOError.'
        pass
    
    def writelines(self):
        pass
    

class _RawIOBase(_IOBase):
    'Base class for raw binary I/O.'
    __class__ = _RawIOBase
    @classmethod
    def __subclasshook__(cls, subclass):
        'Abstract classes can override this to customize issubclass().\n\nThis is invoked early on by abc.ABCMeta.__subclasscheck__().\nIt should return True, False or NotImplemented.  If it returns\nNotImplemented, the normal algorithm is used.  Otherwise, it\noverrides the normal algorithm (and the outcome is cached).\n'
        return False
    
    def read(self):
        pass
    
    def readall(self):
        'Read until EOF, using multiple read() call.'
        pass
    

class _TextIOBase(_IOBase):
    "Base class for text I/O.\n\nThis class provides a character and line based interface to stream\nI/O. There is no readinto method because Python's character strings\nare immutable. There is no public constructor.\n"
    __class__ = _TextIOBase
    @classmethod
    def __subclasshook__(cls, subclass):
        'Abstract classes can override this to customize issubclass().\n\nThis is invoked early on by abc.ABCMeta.__subclasscheck__().\nIt should return True, False or NotImplemented.  If it returns\nNotImplemented, the normal algorithm is used.  Otherwise, it\noverrides the normal algorithm (and the outcome is cached).\n'
        return False
    
    def detach(self):
        'Separate the underlying buffer from the TextIOBase and return it.\n\nAfter the underlying buffer has been detached, the TextIO is in an\nunusable state.\n'
        pass
    
    @property
    def encoding(self):
        'Encoding of the text stream.\n\nSubclasses should override.\n'
        pass
    
    @property
    def errors(self):
        'The error setting of the decoder or encoder.\n\nSubclasses should override.\n'
        pass
    
    @property
    def newlines(self):
        'Line endings translated so far.\n\nOnly line endings translated during reading are considered.\n\nSubclasses should override.\n'
        pass
    
    def read(self):
        'Read at most n characters from stream.\n\nRead from underlying buffer until we have n characters or we hit EOF.\nIf n is negative or omitted, read until EOF.\n'
        pass
    
    def readline(self):
        'Read until newline or EOF.\n\nReturns an empty string if EOF is hit immediately.\n'
        pass
    
    def write(self):
        'Write string to stream.\nReturns the number of characters written (which is always equal to\nthe length of the string).\n'
        pass
    

__doc__ = "The io module provides the Python interfaces to stream handling. The\nbuiltin open function is defined in this module.\n\nAt the top of the I/O hierarchy is the abstract base class IOBase. It\ndefines the basic interface to a stream. Note, however, that there is no\nseparation between reading and writing to streams; implementations are\nallowed to raise an IOError if they do not support a given operation.\n\nExtending IOBase is RawIOBase which deals simply with the reading and\nwriting of raw bytes to a stream. FileIO subclasses RawIOBase to provide\nan interface to OS files.\n\nBufferedIOBase deals with buffering on a raw byte stream (RawIOBase). Its\nsubclasses, BufferedWriter, BufferedReader, and BufferedRWPair buffer\nstreams that are readable, writable, and both respectively.\nBufferedRandom provides a buffered interface to random access\nstreams. BytesIO is a simple stream of in-memory bytes.\n\nAnother IOBase subclass, TextIOBase, deals with the encoding and decoding\nof streams into text. TextIOWrapper, which extends it, is a buffered text\ninterface to a buffered raw stream (`BufferedIOBase`). Finally, StringIO\nis an in-memory stream for text.\n\nArgument names are not part of the specification, and only the arguments\nof open() are intended to be used as keyword arguments.\n\ndata:\n\nDEFAULT_BUFFER_SIZE\n\n   An int containing the default buffer size used by the module's buffered\n   I/O classes. open() uses the file's blksize (as obtained by os.stat) if\n   possible.\n"
__name__ = '_io'
__package__ = None
def open():
    'Open file and return a stream.  Raise IOError upon failure.\n\nfile is either a text or byte string giving the name (and the path\nif the file isn\'t in the current working directory) of the file to\nbe opened or an integer file descriptor of the file to be\nwrapped. (If a file descriptor is given, it is closed when the\nreturned I/O object is closed, unless closefd is set to False.)\n\nmode is an optional string that specifies the mode in which the file\nis opened. It defaults to \'r\' which means open for reading in text\nmode.  Other common values are \'w\' for writing (truncating the file if\nit already exists), and \'a\' for appending (which on some Unix systems,\nmeans that all writes append to the end of the file regardless of the\ncurrent seek position). In text mode, if encoding is not specified the\nencoding used is platform dependent. (For reading and writing raw\nbytes use binary mode and leave encoding unspecified.) The available\nmodes are:\n\n========= ===============================================================\nCharacter Meaning\n--------- ---------------------------------------------------------------\n\'r\'       open for reading (default)\n\'w\'       open for writing, truncating the file first\n\'a\'       open for writing, appending to the end of the file if it exists\n\'b\'       binary mode\n\'t\'       text mode (default)\n\'+\'       open a disk file for updating (reading and writing)\n\'U\'       universal newline mode (for backwards compatibility; unneeded\n          for new code)\n========= ===============================================================\n\nThe default mode is \'rt\' (open for reading text). For binary random\naccess, the mode \'w+b\' opens and truncates the file to 0 bytes, while\n\'r+b\' opens the file without truncation.\n\nPython distinguishes between files opened in binary and text modes,\neven when the underlying operating system doesn\'t. Files opened in\nbinary mode (appending \'b\' to the mode argument) return contents as\nbytes objects without any decoding. In text mode (the default, or when\n\'t\' is appended to the mode argument), the contents of the file are\nreturned as strings, the bytes having been first decoded using a\nplatform-dependent encoding or using the specified encoding if given.\n\nbuffering is an optional integer used to set the buffering policy.\nPass 0 to switch buffering off (only allowed in binary mode), 1 to select\nline buffering (only usable in text mode), and an integer > 1 to indicate\nthe size of a fixed-size chunk buffer.  When no buffering argument is\ngiven, the default buffering policy works as follows:\n\n* Binary files are buffered in fixed-size chunks; the size of the buffer\n  is chosen using a heuristic trying to determine the underlying device\'s\n  "block size" and falling back on `io.DEFAULT_BUFFER_SIZE`.\n  On many systems, the buffer will typically be 4096 or 8192 bytes long.\n\n* "Interactive" text files (files for which isatty() returns True)\n  use line buffering.  Other text files use the policy described above\n  for binary files.\n\nencoding is the name of the encoding used to decode or encode the\nfile. This should only be used in text mode. The default encoding is\nplatform dependent, but any encoding supported by Python can be\npassed.  See the codecs module for the list of supported encodings.\n\nerrors is an optional string that specifies how encoding errors are to\nbe handled---this argument should not be used in binary mode. Pass\n\'strict\' to raise a ValueError exception if there is an encoding error\n(the default of None has the same effect), or pass \'ignore\' to ignore\nerrors. (Note that ignoring encoding errors can lead to data loss.)\nSee the documentation for codecs.register for a list of the permitted\nencoding error strings.\n\nnewline controls how universal newlines works (it only applies to text\nmode). It can be None, \'\', \'\\n\', \'\\r\', and \'\\r\\n\'.  It works as\nfollows:\n\n* On input, if newline is None, universal newlines mode is\n  enabled. Lines in the input can end in \'\\n\', \'\\r\', or \'\\r\\n\', and\n  these are translated into \'\\n\' before being returned to the\n  caller. If it is \'\', universal newline mode is enabled, but line\n  endings are returned to the caller untranslated. If it has any of\n  the other legal values, input lines are only terminated by the given\n  string, and the line ending is returned to the caller untranslated.\n\n* On output, if newline is None, any \'\\n\' characters written are\n  translated to the system default line separator, os.linesep. If\n  newline is \'\', no translation takes place. If newline is any of the\n  other legal values, any \'\\n\' characters written are translated to\n  the given string.\n\nIf closefd is False, the underlying file descriptor will be kept open\nwhen the file is closed. This does not work when a file name is given\nand must be True in that case.\n\nopen() returns a file object whose type depends on the mode, and\nthrough which the standard file operations such as reading and writing\nare performed. When open() is used to open a file in a text mode (\'w\',\n\'r\', \'wt\', \'rt\', etc.), it returns a TextIOWrapper. When used to open\na file in a binary mode, the returned class varies: in read binary\nmode, it returns a BufferedReader; in write binary and append binary\nmodes, it returns a BufferedWriter, and in read/write mode, it returns\na BufferedRandom.\n\nIt is also possible to use a string or bytearray as a file for both\nreading and writing. For strings StringIO can be used like a file\nopened in a text mode, and for bytes a BytesIO can be used like a file\nopened in a binary mode.\n'
    pass

