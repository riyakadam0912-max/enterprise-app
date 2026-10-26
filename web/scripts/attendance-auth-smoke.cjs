const path = require('node:path');
const assert = require('node:assert/strict');
const {build} = require('../../api/node_modules/esbuild');
const {chromium} = require('../../node_modules/playwright');

(async()=>{
  const bundle=await build({stdin:{resolveDir:path.resolve(__dirname,'..'),loader:'tsx',contents:`
    import React from 'react';
    import {createRoot} from 'react-dom/client';
    import axios from 'axios';
    import {axiosClient} from './src/api/axiosClient';
    import {apiClient} from './src/api/apiClient';
    import {assignShift,updateAttendance} from './src/api/attendanceApi';
    import {setAuthSession,getAuthSessionSnapshot,clearAuthSession,setActiveOrganization} from './src/stores/auth-store';
    import {useMyAttendanceSnapshot,useTodayAttendance} from './src/hooks/useAttendance';
    import {useAttendanceToday} from './src/hooks/useEss';
    window.requests=[]; window.phase='healthy';
    const account={user:{id:7,name:'Admin',email:'admin@example.test'},role:'SUPER_ADMIN',roles:['SUPER_ADMIN'],isSuperAdmin:true,organizationId:20,employeeId:99};
    setAuthSession(account);
    axiosClient.defaults.adapter=async config=>{
      window.requests.push({url:config.url,method:config.method,data:typeof config.data==='string'?JSON.parse(config.data):config.data,headers:config.headers.toJSON()});
      if(['refresh','unavailable'].includes(window.phase)&&config.url!=='/auth/refresh'&&!config._retry) throw new axios.AxiosError('Expired','ERR_BAD_REQUEST',config,{}, {status:401,statusText:'Unauthorized',headers:{},config,data:{success:false,message:'Session expired'}});
      if(window.phase==='unavailable'&&config.url==='/auth/refresh') throw new axios.AxiosError('Unavailable','ERR_BAD_RESPONSE',config,{}, {status:503,statusText:'Unavailable',headers:{},config,data:{success:false,message:'Unavailable'}});
      let data=[];
      if(config.url==='/auth/refresh') {await new Promise(resolve=>setTimeout(resolve,25)); data=account;}
      else if(config.url==='/attendance/my') data={date:'2026-10-26',status:'PRESENT',breaks:[],capabilities:{canCheckIn:false,canCheckOut:false,canBreak:false}};
      else if(config.url==='/attendance/today') data={date:'2026-10-26',rows:[],summary:{}};
      else if(config.url==='/auth/me') data=account;
      return {status:200,statusText:'OK',config,headers:{},data:{success:true,data}};
    };
    window.runRefresh=async()=>{window.phase='refresh';await Promise.all([apiClient('/attendance/shifts'),apiClient('/attendance/holidays')]);window.phase='healthy';};
    window.runUnavailable=async()=>{window.phase='unavailable';try{await apiClient('/attendance/shifts')}catch(error){return error.status}finally{window.phase='healthy'}};
    window.runMutations=async()=>{await updateAttendance(5,{expectedVersion:3,status:'PRESENT'});await assignShift(99,12);};
    window.switchOrg=()=>setActiveOrganization(30);
    window.clearSession=()=>clearAuthSession();
    window.getSession=()=>getAuthSessionSnapshot();
    window.probeCanceled=()=>apiClient('/attendance/shifts').then(()=>false,error=>axios.isCancel(error));
    function Fixture(){const a=useMyAttendanceSnapshot(), b=useAttendanceToday(), c=useTodayAttendance();return <><p id="status">{String(a.loading||b.loading||c.loading)}</p><button onClick={()=>{a.refetch();b.refetch();c.refetch()}}>Refetch</button></>}
    createRoot(document.getElementById('root')).render(<Fixture/>);
  `},bundle:true,write:false,platform:'browser',jsx:'automatic',define:{'process.env':JSON.stringify({NODE_ENV:'test',NEXT_PUBLIC_API_URL:'/api/v1'})}});
  const browser=await chromium.launch({headless:true,...(process.env.CHROME_PATH?{executablePath:process.env.CHROME_PATH}:{})});
  try{
    const page=await browser.newPage();const errors=[];page.on('pageerror',error=>errors.push(error.message));
    await page.route('http://attendance-auth.test/**',route=>route.fulfill({contentType:'text/html',body:'<main id="root"></main>'}));
    await page.goto('http://attendance-auth.test/');await page.addScriptTag({content:bundle.outputFiles[0].text});
    await page.waitForFunction(()=>document.querySelector('#status')?.textContent==='false');
    await page.evaluate(()=>window.runRefresh());
    assert.equal(await page.evaluate(()=>window.requests.filter(r=>r.url==='/auth/refresh').length),1);
    assert.equal(await page.evaluate(()=>window.getSession().user.id),7);
    assert.equal(await page.evaluate(()=>window.runUnavailable()),503);
    assert.equal(await page.evaluate(()=>window.getSession().user.id),7);
    await page.evaluate(()=>window.runMutations());
    const mutations=await page.evaluate(()=>window.requests.filter(r=>r.method==='patch'||r.method==='post'&&r.url.includes('/shifts/assign')));
    assert.equal(mutations[0].url,'/attendance/5');assert.equal(mutations[0].data.expectedVersion,3);
    assert.equal(mutations[1].url,'/attendance/shifts/assign');assert.deepEqual(mutations[1].data,{employeeId:99,shiftId:12});
    assert.equal(mutations[1].headers['X-Organization-Id'],'20');
    await page.evaluate(()=>window.switchOrg());
    await page.waitForFunction(()=>window.getSession().organizationId===30);
    assert.equal(await page.evaluate(()=>window.getSession().employeeOrganizationId),20);
    const before=await page.evaluate(()=>window.requests.filter(r=>r.url==='/attendance/my').length);
    await page.getByRole('button',{name:'Refetch'}).click();
    assert.equal(await page.evaluate(()=>window.requests.filter(r=>r.url==='/attendance/my').length),before);
    await page.evaluate(()=>window.clearSession());
    await page.waitForFunction(()=>window.getSession().user===null);
    await page.waitForFunction(()=>document.querySelector('#status')?.textContent==='false');
    const count=await page.evaluate(()=>window.requests.length);
    await page.evaluate(()=>window.dispatchEvent(new Event('focus')));
    await page.getByRole('button',{name:'Refetch'}).click();
    assert.equal(await page.evaluate(()=>window.probeCanceled()),true);
    assert.equal(await page.evaluate(()=>window.requests.length),count);
    assert.deepEqual(errors,[]);
    console.log('Attendance auth smoke passed: single refresh and retry, edit/version and assignment contracts, profile organization isolation, no attendance requests after logout.');
  }finally{await browser.close();}
})().catch(error=>{console.error(error);process.exitCode=1});
