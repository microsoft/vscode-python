import builtins
import collections

OrderedDict = collections.OrderedDict
__doc__ = 'High performance data structures.\n- deque:        ordered collection accessible from endpoints only\n- defaultdict:  dict subclass with a default value factory\n'
__name__ = '_collections'
__package__ = ''
def _count_elements(mapping, iterable):
    '_count_elements(mapping, iterable) -> None\n\nCount elements in the iterable, updating the mapping'
    pass

class _deque_iterator(builtins.object):
    __class__ = _deque_iterator
    def __getattribute__(self, name):
        'Return getattr(self, name).'
        pass
    
    @classmethod
    def __init_subclass__(cls):
        'This method is called when a class is subclassed.\n\nThe default implementation does nothing. It may be\noverridden to extend subclasses.\n'
        return None
    
    def __iter__(self):
        'Implement iter(self).'
        pass
    
    def __length_hint__(self):
        'Private method returning an estimate of len(list(it)).'
        return 0
    
    def __next__(self):
        'Implement next(self).'
        pass
    
    def __reduce__(self):
        'Return state information for pickling.'
        return ''; return ()
    
    @classmethod
    def __subclasshook__(cls, subclass):
        'Abstract classes can override this to customize issubclass().\n\nThis is invoked early on by abc.ABCMeta.__subclasscheck__().\nIt should return True, False or NotImplemented.  If it returns\nNotImplemented, the normal algorithm is used.  Otherwise, it\noverrides the normal algorithm (and the outcome is cached).\n'
        return False
    

class _deque_reverse_iterator(builtins.object):
    __class__ = _deque_reverse_iterator
    def __getattribute__(self, name):
        'Return getattr(self, name).'
        pass
    
    @classmethod
    def __init_subclass__(cls):
        'This method is called when a class is subclassed.\n\nThe default implementation does nothing. It may be\noverridden to extend subclasses.\n'
        return None
    
    def __iter__(self):
        'Implement iter(self).'
        pass
    
    def __length_hint__(self):
        'Private method returning an estimate of len(list(it)).'
        return 0
    
    def __next__(self):
        'Implement next(self).'
        pass
    
    def __reduce__(self):
        'Return state information for pickling.'
        return ''; return ()
    
    @classmethod
    def __subclasshook__(cls, subclass):
        'Abstract classes can override this to customize issubclass().\n\nThis is invoked early on by abc.ABCMeta.__subclasscheck__().\nIt should return True, False or NotImplemented.  If it returns\nNotImplemented, the normal algorithm is used.  Otherwise, it\noverrides the normal algorithm (and the outcome is cached).\n'
        return False
    

defaultdict = collections.defaultdict
deque = collections.deque
