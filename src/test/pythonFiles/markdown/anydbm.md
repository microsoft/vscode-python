Generic interface to all dbm clones.

Instead of

```html
        import dbm
        d = dbm.open(file, 'w', 0666)
```

use

```html
        import anydbm
        d = anydbm.open(file, 'w')
```

The returned object is a dbhash, gdbm, dbm or dumbdbm object,
dependent on the type of database being opened (determined by whichdb
module) in the case of an existing dbm. If the dbm does not exist and
the create or new flag ('c' or 'n') was specified, the dbm type will
be determined by the availability of the modules (tested in the above
order).

It has the following interface (key and data are strings):

```html
        d[key] = data   # store data at key (may override data at
                        # existing key)
        data = d[key]   # retrieve data at key (raise KeyError if no
                        # such key)
        del d[key]      # delete data stored at key (raises KeyError
                        # if no such key)
        flag = key in d   # true if the key exists
        list = d.keys() # return a list of all existing keys (slow!)
```

Future versions may change the order in which implementations are
tested for existence, and add interfaces to other dbm-like
implementations.
