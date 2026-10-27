import {spawnSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';
// GitHub's protected release workflow is the only production authority.
// Cloudflare documents WORKERS_CI=1 for its competing automatic build path.
if(process.env.WORKERS_CI==='1')throw Error('Automatic Workers Builds are disabled. Use the protected GitHub release workflow.');
const portal=fileURLToPath(new URL('../../apps/portal/source/',import.meta.url));
const result=spawnSync('npm',['--prefix',portal,'run','build'],{stdio:'inherit'});
if(result.status!==0)process.exitCode=result.status||1;
