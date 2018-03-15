import builtins

DEFLATED = 8
DEF_BUF_SIZE = 16384
DEF_MEM_LEVEL = 8
MAX_WBITS = 15
ZLIB_RUNTIME_VERSION = '1.2.11'
ZLIB_VERSION = '1.2.11'
Z_BEST_COMPRESSION = 9
Z_BEST_SPEED = 1
Z_DEFAULT_COMPRESSION = -1
Z_DEFAULT_STRATEGY = 0
Z_FILTERED = 1
Z_FINISH = 4
Z_FULL_FLUSH = 3
Z_HUFFMAN_ONLY = 2
Z_NO_FLUSH = 0
Z_SYNC_FLUSH = 2
__doc__ = "The functions in this module allow compression and decompression using the\nzlib library, which is based on GNU zip.\n\nadler32(string[, start]) -- Compute an Adler-32 checksum.\ncompress(data[, level]) -- Compress data, with compression level 0-9 or -1.\ncompressobj([level[, ...]]) -- Return a compressor object.\ncrc32(string[, start]) -- Compute a CRC-32 checksum.\ndecompress(string,[wbits],[bufsize]) -- Decompresses a compressed string.\ndecompressobj([wbits[, zdict]]]) -- Return a decompressor object.\n\n'wbits' is window buffer size and container format.\nCompressor objects support compress() and flush() methods; decompressor\nobjects support decompress() and flush()."
__name__ = 'zlib'
__package__ = ''
__version__ = '1.0'
def adler32(data, value):
    'Compute an Adler-32 checksum of data.\n\n  value\n    Starting value of the checksum.\n\nThe returned checksum is an integer.'
    pass

def compress(data, level):
    'Returns a bytes object containing compressed data.\n\n  data\n    Binary data to be compressed.\n  level\n    Compression level, in 0-9 or -1.'
    pass

def compressobj(level, method, wbits, memLevel, strategy, zdict):
    'Return a compressor object.\n\n  level\n    The compression level (an integer in the range 0-9 or -1; default is\n    currently equivalent to 6).  Higher compression levels are slower,\n    but produce smaller results.\n  method\n    The compression algorithm.  If given, this must be DEFLATED.\n  wbits\n    +9 to +15: The base-two logarithm of the window size.  Include a zlib\n        container.\n    -9 to -15: Generate a raw stream.\n    +25 to +31: Include a gzip container.\n  memLevel\n    Controls the amount of memory used for internal compression state.\n    Valid values range from 1 to 9.  Higher values result in higher memory\n    usage, faster compression, and smaller output.\n  strategy\n    Used to tune the compression algorithm.  Possible values are\n    Z_DEFAULT_STRATEGY, Z_FILTERED, and Z_HUFFMAN_ONLY.\n  zdict\n    The predefined compression dictionary - a sequence of bytes\n    containing subsequences that are likely to occur in the input data.'
    pass

def crc32(data, value):
    'Compute a CRC-32 checksum of data.\n\n  value\n    Starting value of the checksum.\n\nThe returned checksum is an integer.'
    pass

def decompress(data, wbits, bufsize):
    'Returns a bytes object containing the uncompressed data.\n\n  data\n    Compressed data.\n  wbits\n    The window buffer size and container format.\n  bufsize\n    The initial output buffer size.'
    pass

def decompressobj(wbits, zdict):
    'Return a decompressor object.\n\n  wbits\n    The window buffer size and container format.\n  zdict\n    The predefined compression dictionary.  This must be the same\n    dictionary as used by the compressor that produced the input data.'
    pass

class error(builtins.Exception):
    __class__ = error
    __dict__ = builtins.dict()
    @classmethod
    def __init_subclass__(cls):
        'This method is called when a class is subclassed.\n\nThe default implementation does nothing. It may be\noverridden to extend subclasses.\n'
        return None
    
    __module__ = 'zlib'
    @classmethod
    def __subclasshook__(cls, subclass):
        'Abstract classes can override this to customize issubclass().\n\nThis is invoked early on by abc.ABCMeta.__subclasscheck__().\nIt should return True, False or NotImplemented.  If it returns\nNotImplemented, the normal algorithm is used.  Otherwise, it\noverrides the normal algorithm (and the outcome is cached).\n'
        return False
    
    @property
    def __weakref__(self):
        'list of weak references to the object (if defined)'
        pass
    

