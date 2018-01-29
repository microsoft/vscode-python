import io
import os
import re
import sys
import json
import time
import traceback

try:
    import importmagic
except:
    json_message = {'error': True, 'message': 'Importmagic not installed', 
                   'traceback': '', 'type': 'ModuleNotFoundError'}
    sys.stderr.write(json.dumps(json_message))
    sys.stderr.write('\n')
    sys.stderr.flush()


ITEMS_LIMIT = 50
INDEX_FILE_TTL = 300


class ImportMagicDaemon(object):
    def __init__(self):
        self._input = io.open(sys.stdin.fileno(), encoding='utf-8')
        self._index = None

    def method_build_index(self, **kwargs):
        workspace_path = kwargs.get('workspacePath')
        extra_paths = kwargs.get('extraPaths', [])
        skip_test_folders = kwargs.get('skipTestFolders')
        force_rebuild = kwargs.get('forceRebuild')

        if not workspace_path:
            raise ValueError('Empty workspacePath')

        paths = list(set(extra_paths + [workspace_path] + sys.path))

        index_file = os.path.join(workspace_path, '.vscode', 'importmagic')
        index_file_ts = None

        try:
            index_file_ts = os.path.getmtime(index_file)
        except Exception:
            pass
        
        if force_rebuild or not index_file_ts or time.time() - index_file_ts > INDEX_FILE_TTL:
            if skip_test_folders:
                blacklist_re = importmagic.index.DEFAULT_BLACKLIST_RE
            else:
                blacklist_re = re.compile(r'^$')

            self._index = importmagic.SymbolIndex(blacklist_re=blacklist_re)
            self._index.build_index(paths)

            try:
                with open(index_file, 'w') as fd:
                    self._index.serialize(fd)
            except Exception:
                pass
        else:
            # Read old index
            with open(index_file, 'r') as fd:
                self._index = importmagic.SymbolIndex.deserialize(fd)

        return dict(success=True)

    def method_get_unresolved(self, **kwargs):
        source_file = kwargs.get('sourceFile')
        
        if not source_file:
            raise ValueError('Empty sourceFile')   

        if not self._index:
            raise Exception('First run build_index() method')

        with open(source_file, 'r') as fd:
            python_source = fd.read()
        scope = importmagic.Scope.from_source(python_source)

        unresolved, unreferenced = \
                            scope.find_unresolved_and_unreferenced_symbols()

        return dict(unresolved=list(unresolved), unreferenced=list(unreferenced))

    def method_import_suggestions(self, **kwargs):
        source_file = kwargs.get('sourceFile')
        unresolved_name = kwargs.get('unresolvedName')
        
        if not source_file:
            raise ValueError('Empty sourceFile')

        if not unresolved_name:
            raise ValueError('Empty unresolvedName')    

        if not self._index:
            raise Exception('First run build_index() method')

        with open(source_file, 'r') as fd:
            python_source = fd.read()
        scope = importmagic.Scope.from_source(python_source)

        _unresolved, _unreferenced = \
                            scope.find_unresolved_and_unreferenced_symbols()

        # Sometimes unresolved may contain "sys.path".
        # Split this cases for find "sys.path", "sys" and "path"
        unresolved = set()
        for item1 in _unresolved:
            for item2 in item1.split('.'):
                unresolved.add(item2)

        if unresolved_name not in unresolved:
            raise Exception('Import this expression is not necessary')

        candidates = []
        for score, module, variable in self._index.symbol_scores(unresolved_name):
            candidates.append(dict(score=score, module=module, 
                                    variable=variable))
            if len(candidates) >= ITEMS_LIMIT:
                break

        return dict(candidates=candidates)

    def method_insert_import(self, **kwargs):
        source_file = kwargs.get('sourceFile')
        
        module = kwargs.get('module')
        variable = kwargs.get('variable')

        if not source_file:
            raise ValueError('Empty sourceFile')
        
        if not module:
            raise ValueError('Empty module')

        if not self._index:
            raise Exception('First run inibuild_indext() method')

        with open(source_file, 'r') as fd:
            python_source = fd.read()
        
        imports = importmagic.Imports(self._index, python_source)
        imports.set_style(multiline='backslash', max_columns=79)  # TODO: Get style from VS Code

        if variable is None:
            imports.add_import(module)
        else:
            imports.add_import_from(module, variable)
        start, end, text = imports.get_update()

        return dict(fromLine=start, endLine=end, text=text)

    def method_get_symbols(self, **kwargs):
        find = kwargs.get('text', '').replace('_', '').lower()
        
        if not self._index:
            raise Exception('First run build_index() method')

        results = {}

        def scan_tree(scope):
            for key, subscope in scope._tree.items():        
                if type(subscope) is not float:
                    get_result(key, scope, subscope.score)
                    scan_tree(subscope)
                else:
                    get_result(key, scope, subscope)
                    
        def get_result(key, scope, key_score):
            k = key.replace('_', '').lower()
            if not k.startswith(find):
                return
            
            score = -(key_score + (100-scope.depth())*10)
            if k not in results or results[k]['_score'] > score:
                if scope.path():
                    module = scope.path()
                    variable = key
                else:
                    module = key
                    variable = None

                results[k] = dict(key=key, module=module, variable=variable,
                    depth=scope.depth(), _score=score, score=key_score)


        scan_tree(self._index)
        
        return dict(items=sorted(results.values(), key=lambda x: x['_score'])[:ITEMS_LIMIT])

    def _process_request(self, request):
        method_name = request.get('method')
        
        result = None
        method = getattr(self, 'method_%s' % method_name)
        if not method:
            raise ValueError('Invalid method name')
        
        result = method(**request)

        if not result or type(result) != dict:
            raise ValueError('Method must return dict')
        
        return result

    def _error_response(self, response):
        sys.stderr.write(json.dumps(response))
        sys.stderr.write('\n')
        sys.stderr.flush()

    def _success_response(self, response):
        sys.stdout.write(json.dumps(response))
        sys.stdout.write('\n')
        sys.stdout.flush()

    def watch(self):
        while True:
            try:
                request = json.loads(self._input.readline())
                request_id = request.get('requestId')

                if not request_id:
                    raise ValueError('Empty request id')

                response = self._process_request(request)
                json_message = dict(id=request_id, **response)
                self._success_response(json_message)
            except:
                exc_type, exc_value, exc_tb = sys.exc_info()
                tb_info = traceback.extract_tb(exc_tb)
                json_message = dict(error=True, id=request_id, message=str(exc_value), traceback=str(tb_info), type=str(exc_type))
                self._error_response(json_message)

if __name__ == '__main__':
    ImportMagicDaemon().watch()
