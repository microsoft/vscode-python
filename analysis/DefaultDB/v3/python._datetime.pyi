import builtins
import datetime

MAXYEAR = 9999
MINYEAR = 1
__doc__ = 'Fast implementation of the datetime type.'
__name__ = '_datetime'
__package__ = ''
date = datetime.date
datetime = datetime.datetime
datetime_CAPI = builtins.PyCapsule()
time = datetime.time
timedelta = datetime.timedelta
timezone = datetime.timezone
tzinfo = datetime.tzinfo
