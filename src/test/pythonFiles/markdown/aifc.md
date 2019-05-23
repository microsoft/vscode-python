Stuff to parse AIFF-C and AIFF files.

Unless explicitly stated otherwise, the description below is true
both for AIFF-C files and AIFF files.

An AIFF-C file has the following structure.

```html
  +-----------------+
  | FORM            |
  +-----------------+
  |  size           |
  +----+------------+
  |    | AIFC       |
  |    +------------+
  |    |  chunks    |
  |    |    .       |
  |    |    .       |
  |    |    .       |
  +----+------------+
```

An AIFF file has the string "AIFF" instead of "AIFC".

A chunk consists of an identifier (4 bytes) followed by a size (4 bytes,
big endian order), followed by the data. The size field does not include
the size of the 8 byte header.

The following chunk types are recognized.

```html
  FVER
       version number of AIFF-C defining document  (AIFF-C only).
  MARK
       # of markers  (2 bytes)
      list of markers:
           marker ID  (2 bytes, must be   0)
           position  (4 bytes)
           marker name  ("pstring")
  COMM
       # of channels  (2 bytes)
       # of sound frames  (4 bytes)
       size of the samples  (2 bytes)
       sampling frequency  (10 bytes, IEEE 80-bit extended
          floating point)
      in AIFF-C files only:
       compression type  (4 bytes)
       human-readable version of compression type  ("pstring")
  SSND
       offset  (4 bytes, not used by this program)
       blocksize  (4 bytes, not used by this program)
       sound data
```

A pstring consists of 1 byte length, a string of characters, and 0 or 1
byte pad to make the total length even.

Usage.

Reading AIFF files:

```html
  f = aifc.open(file, 'r')
```

where file is either the name of a file or an open file pointer.
The open file pointer must have methods read(), seek(), and close().
In some types of audio files, if the setpos() method is not used,
the seek() method is not necessary.

This returns an instance of a class with the following public methods:

```html
  getnchannels()  -- returns number of audio channels (1 for
             mono, 2 for stereo)
  getsampwidth()  -- returns sample width in bytes
  getframerate()  -- returns sampling frequency
  getnframes()    -- returns number of audio frames
  getcomptype()   -- returns compression type ('NONE' for AIFF files)
  getcompname()   -- returns human-readable version of
             compression type ('not compressed' for AIFF files)
  getparams() -- returns a tuple consisting of all of the
             above in the above order
  getmarkers()    -- get the list of marks in the audio file or None
             if there are no marks
  getmark(id) -- get mark with the specified id (raises an error
             if the mark does not exist)
  readframes(n)   -- returns at most n frames of audio
  rewind()    -- rewind to the beginning of the audio stream
  setpos(pos) -- seek to the specified position
  tell()      -- return the current position
  close()     -- close the instance (make it unusable)
```

The position returned by tell(), the position given to setpos() and
the position of marks are all compatible and have nothing to do with
the actual position in the file.
The close() method is called automatically when the class instance
is destroyed.

Writing AIFF files:

```html
  f = aifc.open(file, 'w')
```

where file is either the name of a file or an open file pointer.
The open file pointer must have methods write(), tell(), seek(), and
close().

This returns an instance of a class with the following public methods:

```html
  aiff()      -- create an AIFF file (AIFF-C default)
  aifc()      -- create an AIFF-C file
  setnchannels(n) -- set the number of channels
  setsampwidth(n) -- set the sample width
  setframerate(n) -- set the frame rate
  setnframes(n)   -- set the number of frames
  setcomptype(type, name)
          -- set the compression type and the
             human-readable compression type
  setparams(tuple)
          -- set all parameters at once
  setmark(id, pos, name)
          -- add specified mark to the list of marks
  tell()      -- return current position in output file (useful
             in combination with setmark())
  writeframesraw(data)
          -- write audio frames without pathing up the
             file header
  writeframes(data)
          -- write audio frames and patch up the file header
  close()     -- patch up the file header and close the
             output file
```

You should set the parameters before the first writeframesraw or
writeframes. The total number of frames does not need to be set,
but when it is set to the correct value, the header does not have to
be patched up.
It is best to first set all parameters, perhaps possibly the
compression type, and then write audio frames using writeframesraw.
When all frames have been written, either call writeframes('') or
close() to patch up the sizes in the header.
Marks can be added anytime. If there are any marks, you must call
close() after all frames have been written.
The close() method is called automatically when the class instance
is destroyed.

When a file is opened with the extension '.aiff', an AIFF file is
written, otherwise an AIFF-C file is written. This default can be
changed by calling aiff() or aifc() before the first writeframes or
writeframesraw.
