__doc__ = None
__name__ = '_codecs'
__package__ = None
def ascii_decode():
    pass

def ascii_encode():
    pass

def charbuffer_encode():
    pass

def charmap_build():
    pass

def charmap_decode():
    pass

def charmap_encode():
    pass

def decode(obj, encoding, errors):
    "decode(obj, [encoding[,errors]]) -> object\n\nDecodes obj using the codec registered for encoding. encoding defaults\nto the default encoding. errors may be given to set a different error\nhandling scheme. Default is 'strict' meaning that encoding errors raise\na ValueError. Other possible values are 'ignore' and 'replace'\nas well as any other name registered with codecs.register_error that is\nable to handle ValueErrors."
    pass

def encode(obj, encoding, errors):
    "encode(obj, [encoding[,errors]]) -> object\n\nEncodes obj using the codec registered for encoding. encoding defaults\nto the default encoding. errors may be given to set a different error\nhandling scheme. Default is 'strict' meaning that encoding errors raise\na ValueError. Other possible values are 'ignore', 'replace' and\n'xmlcharrefreplace' as well as any other name registered with\ncodecs.register_error that can handle ValueErrors."
    pass

def escape_decode():
    pass

def escape_encode():
    pass

def latin_1_decode():
    pass

def latin_1_encode():
    pass

def lookup(encoding):
    'lookup(encoding) -> CodecInfo\n\nLooks up a codec tuple in the Python codec registry and returns\na CodecInfo object.'
    pass

def lookup_error(errors):
    'lookup_error(errors) -> handler\n\nReturn the error handler for the specified error handling name\nor raise a LookupError, if no handler exists under this name.'
    pass

def mbcs_decode():
    pass

def mbcs_encode():
    pass

def raw_unicode_escape_decode():
    pass

def raw_unicode_escape_encode():
    pass

def readbuffer_encode():
    pass

def register(search_function):
    'register(search_function)\n\nRegister a codec search function. Search functions are expected to take\none argument, the encoding name in all lower case letters, and return\na tuple of functions (encoder, decoder, stream_reader, stream_writer)\n(or a CodecInfo object).'
    pass

def register_error(errors, handler):
    'register_error(errors, handler)\n\nRegister the specified error handler under the name\nerrors. handler must be a callable object, that\nwill be called with an exception instance containing\ninformation about the location of the encoding/decoding\nerror and must return a (replacement, new position) tuple.'
    pass

def unicode_escape_decode():
    pass

def unicode_escape_encode():
    pass

def unicode_internal_decode():
    pass

def unicode_internal_encode():
    pass

def utf_16_be_decode():
    pass

def utf_16_be_encode():
    pass

def utf_16_decode():
    pass

def utf_16_encode():
    pass

def utf_16_ex_decode():
    pass

def utf_16_le_decode():
    pass

def utf_16_le_encode():
    pass

def utf_32_be_decode():
    pass

def utf_32_be_encode():
    pass

def utf_32_decode():
    pass

def utf_32_encode():
    pass

def utf_32_ex_decode():
    pass

def utf_32_le_decode():
    pass

def utf_32_le_encode():
    pass

def utf_7_decode():
    pass

def utf_7_encode():
    pass

def utf_8_decode():
    pass

def utf_8_encode():
    pass

