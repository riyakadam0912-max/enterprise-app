/* eslint-disable @typescript-eslint/no-require-imports -- Standalone CommonJS smoke runner. */
/* global require, __dirname, process, console, window */
const path = require('node:path');
const assert = require('node:assert/strict');
const { build } = require('../../api/node_modules/esbuild');
const { chromium } = require('../../node_modules/playwright');

(async () => {
  const bundle = await build({
    stdin: { resolveDir: path.resolve(__dirname, '..'), loader: 'tsx', contents: `
      import React from 'react';
      import {createRoot} from 'react-dom/client';
      import axios from 'axios';
      import AttendancePage from './app/dashboard/attendance/page';
      import {axiosClient} from './src/api/axiosClient';
      import {setAuthSession} from './src/stores/auth-store';
      window.requests=[]; window.phase='healthy';
      setAuthSession({user:{id:7,name:'Admin',email:'admin@example.test'},role:'SUPER_ADMIN',roles:['SUPER_ADMIN'],isSuperAdmin:true,organizationId:20,employeeId:null,employeeOrganizationId:null});
      axiosClient.defaults.adapter=async config=>{
        const url=config.url.split('?')[0];
        window.requests.push({url,method:config.method,data:typeof config.data==='string'?JSON.parse(config.data):config.data});
        if(url==='/attendance/work-hours'||(window.phase==='refresh-failure'&&url==='/attendance/shifts'))
          throw new axios.AxiosError('Forbidden','ERR_BAD_REQUEST',config,{}, {status:403,statusText:'Forbidden',headers:{},config,data:{success:false,message:'Forbidden'}});
        if(window.phase==='assignment-failure'&&url==='/attendance/shifts/assign')
          throw new axios.AxiosError('Conflict','ERR_BAD_REQUEST',config,{}, {status:409,statusText:'Conflict',headers:{},config,data:{success:false,message:'Shift is no longer active'}});
        let data=[];
        if(url==='/employees') data=[{id:99,name:'Flexible employee',organizationId:20}];
        else if(url==='/attendance/shifts') data=[{id:12,name:'Fixed day',type:'FIXED',organizationId:20,organizationName:'Parent',requiredHours:8,minPresentHours:5,gracePeriodMinutes:15,workingDays:[1,2,3,4,5],startTime:'09:00',endTime:'18:00'}];
        else if(url==='/attendance') data={data:[],total:0,page:1,limit:10};
        else if(url==='/attendance/today') data={date:'2026-10-26',rows:[],summary:{}};
        else if(url==='/attendance/work-hours/team') data=null;
        else if(url==='/attendance/monthly-report') data={rows:[],year:2026,month:10,summary:{}};
        return {status:200,statusText:'OK',config,headers:{},data:{success:true,data}};
      };
      createRoot(document.getElementById('root')).render(<AttendancePage/>);
    ` },
    bundle: true, write: false, platform: 'browser', jsx: 'automatic',
    define: {'process.env': JSON.stringify({NODE_ENV:'test',NEXT_PUBLIC_API_URL:'/api/v1'})},
    plugins: [{name:'test-environment',setup(build){
      build.onResolve({filter:/^next\/navigation$|^@\/providers\/AuthProvider$/},args=>({path:args.path,namespace:'fixture'}));
      build.onLoad({filter:/.*/,namespace:'fixture'},args=>({contents:args.path==='next/navigation'
        ? 'const params=new URLSearchParams(); export const useSearchParams=()=>params; export const useRouter=()=>({push(){},replace(){}}); export const usePathname=()=>"/dashboard/attendance";'
        : 'export const useAuth=()=>({loading:false,authenticated:true});',loader:'js'}));
    }}],
  });
  const browser=await chromium.launch({headless:true,executablePath:process.env.CHROME_PATH});
  try {
    const page=await browser.newPage(); const errors=[];
    page.on('pageerror',error=>errors.push(error.message));
    await page.route('http://attendance-assignment.test/**',route=>route.fulfill({contentType:'text/html',body:'<main id="root"></main>'}));
    await page.goto('http://attendance-assignment.test/');
    await page.addScriptTag({content:bundle.outputFiles[0].text});
    await page.getByLabel('Select employee',{exact:true}).selectOption('99');
    await page.getByLabel('Select shift',{exact:true}).selectOption('12');
    await page.getByRole('button',{name:'Assign',exact:true}).click();
    await page.getByText('Shift assigned successfully.',{exact:true}).waitFor();
    assert.equal(await page.evaluate(()=>window.requests.filter(r=>r.url==='/attendance/work-hours').length),0);
    assert.ok(await page.evaluate(()=>window.requests.filter(r=>r.url==='/employees').length)>=2);
    const assignment=await page.evaluate(()=>window.requests.find(r=>r.url==='/attendance/shifts/assign'));
    assert.deepEqual(assignment.data,{employeeId:99,shiftId:12});
    await page.evaluate(()=>window.phase='refresh-failure');
    await page.getByRole('button',{name:'Assign',exact:true}).click();
    await page.getByText(/Changes were saved, but some attendance data/).waitFor();
    await page.getByText('Shift assigned successfully.',{exact:true}).waitFor();
    await page.evaluate(()=>window.phase='assignment-failure');
    await page.getByRole('button',{name:'Assign',exact:true}).click();
    await page.getByText('Shift is no longer active',{exact:true}).waitFor();
    assert.equal(await page.getByText('Shift assigned successfully.',{exact:true}).count(),0);
    assert.deepEqual(errors,[]);
    console.log('Attendance assignment UI passed: unlinked admin, employee refresh, saved assignment with failed refresh, real assignment failure.');
  } finally {await browser.close();}
})().catch(error=>{console.error(error);process.exitCode=1;});
