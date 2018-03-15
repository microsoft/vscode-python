import __builtin__

MAXYEAR = 9999
MINYEAR = 1
__doc__ = 'Fast implementation of the datetime type.'
__name__ = 'datetime'
__package__ = None
class date(__builtin__.object):
    'date(year, month, day) --> date object'
    def __add__(self, y):
        'x.__add__(y) <==> x+y'
        return date()
    
    __class__ = date
    def __eq__(self, y):
        'x.__eq__(y) <==> x==y'
        return False
    
    def __format__(self, format_spec):
        'Formats self with strftime.'
        return ''
    
    def __ge__(self, y):
        'x.__ge__(y) <==> x>=y'
        return False
    
    def __getattribute__(self):
        "x.__getattribute__('name') <==> x.name"
        pass
    
    def __gt__(self, y):
        'x.__gt__(y) <==> x>y'
        return False
    
    def __hash__(self):
        'x.__hash__() <==> hash(x)'
        return 0
    
    def __le__(self, y):
        'x.__le__(y) <==> x<=y'
        return False
    
    def __lt__(self, y):
        'x.__lt__(y) <==> x<y'
        return False
    
    def __ne__(self, y):
        'x.__ne__(y) <==> x!=y'
        return False
    
    def __radd__(self, y):
        'x.__radd__(y) <==> y+x'
        return date()
    
    def __reduce__(self):
        '__reduce__() -> (cls, state)'
        return ''; return ()
    
    def __repr__(self):
        'x.__repr__() <==> repr(x)'
        return ''
    
    def __rsub__(self, y):
        'x.__rsub__(y) <==> y-x'
        return date()
    
    def __str__(self):
        'x.__str__() <==> str(x)'
        return ''
    
    def __sub__(self, y):
        'x.__sub__(y) <==> x-y'
        return date()
    
    @classmethod
    def __subclasshook__(cls, subclass):
        'Abstract classes can override this to customize issubclass().\n\nThis is invoked early on by abc.ABCMeta.__subclasscheck__().\nIt should return True, False or NotImplemented.  If it returns\nNotImplemented, the normal algorithm is used.  Otherwise, it\noverrides the normal algorithm (and the outcome is cached).\n'
        return False
    
    def ctime(self):
        'Return ctime() style string.'
        pass
    
    @property
    def day(self):
        pass
    
    @classmethod
    def fromordinal(cls):
        'int -> date corresponding to a proleptic Gregorian ordinal.'
        pass
    
    @classmethod
    def fromtimestamp(cls):
        'timestamp -> local date from a POSIX timestamp (like time.time()).'
        pass
    
    def isocalendar(self):
        'Return a 3-tuple containing ISO year, week number, and weekday.'
        pass
    
    def isoformat(self):
        'Return string in ISO 8601 format, YYYY-MM-DD.'
        pass
    
    def isoweekday(self):
        'Return the day of the week represented by the date.\nMonday == 1 ... Sunday == 7'
        pass
    
    max = date()
    min = date()
    @property
    def month(self):
        pass
    
    def replace(self):
        'Return date with new specified fields.'
        pass
    
    resolution = timedelta()
    def strftime(self):
        'format -> strftime() style string.'
        pass
    
    def timetuple(self):
        'Return time tuple, compatible with time.localtime().'
        pass
    
    @classmethod
    def today(cls):
        'Current date or datetime:  same as self.__class__.fromtimestamp(time.time()).'
        pass
    
    def toordinal(self):
        'Return proleptic Gregorian ordinal.  January 1 of year 1 is day 1.'
        pass
    
    def weekday(self):
        'Return the day of the week represented by the date.\nMonday == 0 ... Sunday == 6'
        pass
    
    @property
    def year(self):
        pass
    

class datetime(date):
    'datetime(year, month, day[, hour[, minute[, second[, microsecond[,tzinfo]]]]])\n\nThe year, month and day arguments are required. tzinfo may be None, or an\ninstance of a tzinfo subclass. The remaining arguments may be ints or longs.\n'
    def __add__(self, y):
        'x.__add__(y) <==> x+y'
        return datetime()
    
    __class__ = datetime
    def __eq__(self, y):
        'x.__eq__(y) <==> x==y'
        return False
    
    def __ge__(self, y):
        'x.__ge__(y) <==> x>=y'
        return False
    
    def __getattribute__(self):
        "x.__getattribute__('name') <==> x.name"
        pass
    
    def __gt__(self, y):
        'x.__gt__(y) <==> x>y'
        return False
    
    def __hash__(self):
        'x.__hash__() <==> hash(x)'
        return 0
    
    def __le__(self, y):
        'x.__le__(y) <==> x<=y'
        return False
    
    def __lt__(self, y):
        'x.__lt__(y) <==> x<y'
        return False
    
    def __ne__(self, y):
        'x.__ne__(y) <==> x!=y'
        return False
    
    def __radd__(self, y):
        'x.__radd__(y) <==> y+x'
        return datetime()
    
    def __reduce__(self):
        '__reduce__() -> (cls, state)'
        return ''; return ()
    
    def __repr__(self):
        'x.__repr__() <==> repr(x)'
        return ''
    
    def __rsub__(self, y):
        'x.__rsub__(y) <==> y-x'
        return datetime()
    
    def __str__(self):
        'x.__str__() <==> str(x)'
        return ''
    
    def __sub__(self, y):
        'x.__sub__(y) <==> x-y'
        return datetime()
    
    @classmethod
    def __subclasshook__(cls, subclass):
        'Abstract classes can override this to customize issubclass().\n\nThis is invoked early on by abc.ABCMeta.__subclasscheck__().\nIt should return True, False or NotImplemented.  If it returns\nNotImplemented, the normal algorithm is used.  Otherwise, it\noverrides the normal algorithm (and the outcome is cached).\n'
        return False
    
    def astimezone(self):
        'tz -> convert to local time in new timezone tz\n'
        pass
    
    @classmethod
    def combine(cls):
        'date, time -> datetime with same date and time fields'
        pass
    
    def ctime(self):
        'Return ctime() style string.'
        pass
    
    def date(self):
        'Return date object with same year, month and day.'
        pass
    
    def dst(self):
        'Return self.tzinfo.dst(self).'
        pass
    
    @classmethod
    def fromordinal(cls):
        'int -> date corresponding to a proleptic Gregorian ordinal.'
        pass
    
    @classmethod
    def fromtimestamp(cls):
        "timestamp[, tz] -> tz's local time from POSIX timestamp."
        pass
    
    @property
    def hour(self):
        pass
    
    def isoformat(self):
        "[sep] -> string in ISO 8601 format, YYYY-MM-DDTHH:MM:SS[.mmmmmm][+HH:MM].\n\nsep is used to separate the year from the time, and defaults to 'T'."
        pass
    
    max = datetime()
    @property
    def microsecond(self):
        pass
    
    min = datetime()
    @property
    def minute(self):
        pass
    
    @classmethod
    def now(cls):
        "[tz] -> new datetime with tz's local day and time."
        pass
    
    def replace(self):
        'Return datetime with new specified fields.'
        pass
    
    resolution = timedelta()
    @property
    def second(self):
        pass
    
    @classmethod
    def strptime(cls):
        'string, format -> new datetime parsed from a string (like time.strptime()).'
        pass
    
    def time(self):
        'Return time object with same time but with tzinfo=None.'
        pass
    
    def timetuple(self):
        'Return time tuple, compatible with time.localtime().'
        pass
    
    def timetz(self):
        'Return time object with same time and tzinfo.'
        pass
    
    @classmethod
    def today(cls):
        'Current date or datetime:  same as self.__class__.fromtimestamp(time.time()).'
        pass
    
    @property
    def tzinfo(self):
        pass
    
    def tzname(self):
        'Return self.tzinfo.tzname(self).'
        pass
    
    @classmethod
    def utcfromtimestamp(cls):
        'timestamp -> UTC datetime from a POSIX timestamp (like time.time()).'
        pass
    
    @classmethod
    def utcnow(cls):
        'Return a new datetime representing UTC day and time.'
        pass
    
    def utcoffset(self):
        'Return self.tzinfo.utcoffset(self).'
        pass
    
    def utctimetuple(self):
        'Return UTC time tuple, compatible with time.localtime().'
        pass
    

datetime_CAPI = __builtin__.PyCapsule()
class time(__builtin__.object):
    'time([hour[, minute[, second[, microsecond[, tzinfo]]]]]) --> a time object\n\nAll arguments are optional. tzinfo may be None, or an instance of\na tzinfo subclass. The remaining arguments may be ints or longs.\n'
    __class__ = time
    def __eq__(self, y):
        'x.__eq__(y) <==> x==y'
        return False
    
    def __format__(self, format_spec):
        'Formats self with strftime.'
        return ''
    
    def __ge__(self, y):
        'x.__ge__(y) <==> x>=y'
        return False
    
    def __getattribute__(self):
        "x.__getattribute__('name') <==> x.name"
        pass
    
    def __gt__(self, y):
        'x.__gt__(y) <==> x>y'
        return False
    
    def __hash__(self):
        'x.__hash__() <==> hash(x)'
        return 0
    
    def __le__(self, y):
        'x.__le__(y) <==> x<=y'
        return False
    
    def __lt__(self, y):
        'x.__lt__(y) <==> x<y'
        return False
    
    def __ne__(self, y):
        'x.__ne__(y) <==> x!=y'
        return False
    
    def __nonzero__(self):
        'x.__nonzero__() <==> x != 0'
        pass
    
    def __reduce__(self):
        '__reduce__() -> (cls, state)'
        return ''; return ()
    
    def __repr__(self):
        'x.__repr__() <==> repr(x)'
        return ''
    
    def __str__(self):
        'x.__str__() <==> str(x)'
        return ''
    
    @classmethod
    def __subclasshook__(cls, subclass):
        'Abstract classes can override this to customize issubclass().\n\nThis is invoked early on by abc.ABCMeta.__subclasscheck__().\nIt should return True, False or NotImplemented.  If it returns\nNotImplemented, the normal algorithm is used.  Otherwise, it\noverrides the normal algorithm (and the outcome is cached).\n'
        return False
    
    def dst(self):
        'Return self.tzinfo.dst(self).'
        pass
    
    @property
    def hour(self):
        pass
    
    def isoformat(self):
        'Return string in ISO 8601 format, HH:MM:SS[.mmmmmm][+HH:MM].'
        pass
    
    max = time()
    @property
    def microsecond(self):
        pass
    
    min = time()
    @property
    def minute(self):
        pass
    
    def replace(self):
        'Return time with new specified fields.'
        pass
    
    resolution = timedelta()
    @property
    def second(self):
        pass
    
    def strftime(self):
        'format -> strftime() style string.'
        pass
    
    @property
    def tzinfo(self):
        pass
    
    def tzname(self):
        'Return self.tzinfo.tzname(self).'
        pass
    
    def utcoffset(self):
        'Return self.tzinfo.utcoffset(self).'
        pass
    

class timedelta(__builtin__.object):
    'Difference between two datetime values.'
    def __abs__(self):
        'x.__abs__() <==> abs(x)'
        return timedelta()
    
    def __add__(self, y):
        'x.__add__(y) <==> x+y'
        return timedelta()
    
    __class__ = timedelta
    def __div__(self, y):
        'x.__div__(y) <==> x/y'
        pass
    
    def __eq__(self, y):
        'x.__eq__(y) <==> x==y'
        return False
    
    def __floordiv__(self, y):
        'x.__floordiv__(y) <==> x//y'
        return 0
    
    def __ge__(self, y):
        'x.__ge__(y) <==> x>=y'
        return False
    
    def __getattribute__(self):
        "x.__getattribute__('name') <==> x.name"
        pass
    
    def __gt__(self, y):
        'x.__gt__(y) <==> x>y'
        return False
    
    def __hash__(self):
        'x.__hash__() <==> hash(x)'
        return 0
    
    def __le__(self, y):
        'x.__le__(y) <==> x<=y'
        return False
    
    def __lt__(self, y):
        'x.__lt__(y) <==> x<y'
        return False
    
    def __mul__(self, y):
        'x.__mul__(y) <==> x*y'
        return timedelta()
    
    def __ne__(self, y):
        'x.__ne__(y) <==> x!=y'
        return False
    
    def __neg__(self):
        'x.__neg__() <==> -x'
        return timedelta()
    
    def __nonzero__(self):
        'x.__nonzero__() <==> x != 0'
        pass
    
    def __pos__(self):
        'x.__pos__() <==> +x'
        return timedelta()
    
    def __radd__(self, y):
        'x.__radd__(y) <==> y+x'
        return timedelta()
    
    def __rdiv__(self, y):
        'x.__rdiv__(y) <==> y/x'
        pass
    
    def __reduce__(self):
        '__reduce__() -> (cls, state)'
        return ''; return ()
    
    def __repr__(self):
        'x.__repr__() <==> repr(x)'
        return ''
    
    def __rfloordiv__(self, y):
        'x.__rfloordiv__(y) <==> y//x'
        return timedelta()
    
    def __rmul__(self, y):
        'x.__rmul__(y) <==> y*x'
        return timedelta()
    
    def __rsub__(self, y):
        'x.__rsub__(y) <==> y-x'
        return timedelta()
    
    def __str__(self):
        'x.__str__() <==> str(x)'
        return ''
    
    def __sub__(self, y):
        'x.__sub__(y) <==> x-y'
        return timedelta()
    
    @classmethod
    def __subclasshook__(cls, subclass):
        'Abstract classes can override this to customize issubclass().\n\nThis is invoked early on by abc.ABCMeta.__subclasscheck__().\nIt should return True, False or NotImplemented.  If it returns\nNotImplemented, the normal algorithm is used.  Otherwise, it\noverrides the normal algorithm (and the outcome is cached).\n'
        return False
    
    @property
    def days(self):
        'Number of days.'
        pass
    
    max = timedelta()
    @property
    def microseconds(self):
        'Number of microseconds (>= 0 and less than 1 second).'
        pass
    
    min = timedelta()
    resolution = timedelta()
    @property
    def seconds(self):
        'Number of seconds (>= 0 and less than 1 day).'
        pass
    
    def total_seconds(self):
        'Total seconds in the duration.'
        pass
    

class tzinfo(__builtin__.object):
    'Abstract base class for time zone info objects.'
    __class__ = tzinfo
    def __getattribute__(self):
        "x.__getattribute__('name') <==> x.name"
        pass
    
    def __reduce__(self):
        '-> (cls, state)'
        return ''; return ()
    
    @classmethod
    def __subclasshook__(cls, subclass):
        'Abstract classes can override this to customize issubclass().\n\nThis is invoked early on by abc.ABCMeta.__subclasscheck__().\nIt should return True, False or NotImplemented.  If it returns\nNotImplemented, the normal algorithm is used.  Otherwise, it\noverrides the normal algorithm (and the outcome is cached).\n'
        return False
    
    def dst(self):
        'datetime -> DST offset in minutes east of UTC.'
        pass
    
    def fromutc(self):
        'datetime in UTC -> datetime in local time.'
        pass
    
    def tzname(self):
        'datetime -> string name of time zone.'
        pass
    
    def utcoffset(self):
        'datetime -> minutes east of UTC (negative for west of UTC).'
        pass
    

