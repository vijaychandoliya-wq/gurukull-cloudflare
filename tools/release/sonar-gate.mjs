// Run on the trusted developer machine, never an untrusted public PR runner.
// Nothing exposes the local SonarQube server to the Internet.
import {readFileSync,existsSync} from 'node:fs';
import {spawnSync} from 'node:child_process';
const run=(command,args,options={})=>{const r=spawnSync(command,args,{encoding:'utf8',...options});if(r.status!==0)throw Error(command+' failed');return r.stdout.trim();};
const sha=run('git',['rev-parse','HEAD']);
if(run('git',['status','--porcelain']))throw Error('Commit the complete reviewed source before scanning');
const remote=run('git',['remote','get-url','origin']);const match=remote.match(/github\.com[:/]([^/]+\/[^/]+?)(?:\.git)?$/);if(!match)throw Error('Expected GitHub origin');
const repo=match[1];const url=process.env.SONAR_HOST_URL||'http://localhost:9000';
const tokenPath=process.env.SONAR_TOKEN_FILE||'/Volumes/Cricial 500/education-platforms/cloudflare/.private/devops-2026-10-26/sonar-token';
const token=process.env.SONAR_TOKEN||(existsSync(tokenPath)?readFileSync(tokenPath,'utf8').trim():'');if(!token)throw Error('Local SonarQube analysis token required; do not commit it');
run('gh',['api','--method','POST',`repos/${repo}/statuses/${sha}`,'-f','context=SonarQube','-f','state=pending','-f','description=Local SonarQube analysis and quality gate running']);
const r=spawnSync('sonar-scanner',[`-Dsonar.host.url=${url}`,`-Dsonar.scm.revision=${sha}`,'-Dsonar.qualitygate.wait=true','-Dsonar.qualitygate.timeout=600'],{env:{...process.env,SONAR_TOKEN:token},stdio:'inherit'});
run('gh',['api','--method','POST',`repos/${repo}/statuses/${sha}`,'-f','context=SonarQube','-f',`state=${r.status===0?'success':'failure'}`,'-f',`description=${r.status===0?'Local SonarQube quality gate passed':'Local SonarQube analysis or quality gate failed'}`]);
if(r.status!==0)process.exitCode=1;
