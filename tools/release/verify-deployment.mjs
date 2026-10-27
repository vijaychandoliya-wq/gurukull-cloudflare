const origin=process.argv[2],sha=process.argv[3];
if(!origin||!sha||!/^https:\/\//.test(origin))throw Error('HTTPS origin and expected source SHA required');
const res=await fetch(new URL('/health',origin),{signal:AbortSignal.timeout(15000)});const body=await res.json();
if(!res.ok||body.status!=='healthy'||body.sourceSha!==sha)throw Error('Deployed release does not match the promoted commit');
console.log(JSON.stringify({event:'deployment_verified',sourceSha:body.sourceSha,release:body.release}));
