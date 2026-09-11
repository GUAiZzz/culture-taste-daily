import {buildSite} from './lib/build.mjs';import {approvedIssues,finalizeProduction} from './lib/production.mjs';
const repoRoot=process.cwd(),config=await approvedIssues(repoRoot),distDir=repoRoot+'/dist';
const report=await buildSite({repoRoot,outDir:distDir,baseUrl:'https://guaizzz.github.io/culture-taste-daily/',productionDates:config.issues.map(x=>x.date)});
console.log(await finalizeProduction({repoRoot,distDir,report,config}));
