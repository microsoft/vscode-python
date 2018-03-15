import __builtin__

StringI = __builtin__.type
StringO = __builtin__.type
InputType = StringI()
OutputType = StringO()
def StringIO(s):
    'StringIO([s]) -- Return a StringIO-like stream for reading or writing'
    pass

__doc__ = 'A simple fast partial StringIO replacement.\n\nThis module provides a simple useful replacement for\nthe StringIO module that is written in C.  It does not provide the\nfull generality of StringIO, but it provides enough for most\napplications and is especially useful in conjunction with the\npickle module.\n\nUsage:\n\n  from cStringIO import StringIO\n\n  an_output_stream=StringIO()\n  an_output_stream.write(some_stuff)\n  ...\n  value=an_output_stream.getvalue()\n\n  an_input_stream=StringIO(a_string)\n  spam=an_input_stream.readline()\n  spam=an_input_stream.read(5)\n  an_input_stream.seek(0)           # OK, start over\n  spam=an_input_stream.read()       # and read it all\n  \nIf someone else wants to provide a more complete implementation,\ngo for it. :-)  \n\ncStringIO.c,v 1.29 1999/06/15 14:10:27 jim Exp\n'
__name__ = 'cStringIO'
__package__ = None
cStringIO_CAPI = __builtin__.PyCapsule()
