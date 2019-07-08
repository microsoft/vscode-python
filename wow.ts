import * as cp from 'child_process';

console.log(cp.execSync('python -c "import sys;print(sys.executable)"').toString());
