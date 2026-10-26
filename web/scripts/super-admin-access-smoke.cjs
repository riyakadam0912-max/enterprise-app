const path = require('node:path');
const assert = require('node:assert/strict');
const { build } = require('../../api/node_modules/esbuild');
const { chromium } = require('../../node_modules/playwright');

(async () => {
  const bundle = await build({ stdin: { contents: `
    import React, {useState} from 'react';
    import {createRoot} from 'react-dom/client';
    import {setAuthSession, useAuthSession} from './src/stores/auth-store';
    import {axiosClient} from './src/api/axiosClient';
    import {useMyAttendanceSnapshot} from './src/hooks/useAttendance';
    import {useAttendanceToday} from './src/hooks/useEss';
    import ExpensesPage from './src/components/finance/ExpensesPage';
    import BusinessUnits from './app/dashboard/business-units/page';
    import {TaskDetailPanel} from './src/components/tasks/TaskDetailPanel';
    window.requests=[];
    let expense={id:5,expenseDate:'2026-10-26',category:'Travel',description:'Office travel',amount:100,currency:'USD',status:'PENDING_HR',employee:null,submittedByUser:{id:99,name:'Employee',email:'employee@example.test'},createdAt:'2026-10-26',updatedAt:'2026-10-26'};
    axiosClient.defaults.adapter=async config=>{
      window.requests.push({url:config.url,method:config.method,headers:config.headers.toJSON(),data:typeof config.data==='string'?JSON.parse(config.data):config.data});
      let data=[];
      if(config.url==='/attendance/my') data={date:'2026-10-26',status:'PRESENT',breaks:[],capabilities:{canCheckIn:false,canCheckOut:false,canBreak:false}};
      else if(config.url==='/expenses') data=[expense];
      else if(config.url==='/expenses/5'&&config.method==='patch') {expense={...expense,...JSON.parse(config.data)};data=expense;}
      else if(config.url.endsWith('/hr-approve')) {expense={...expense,status:'APPROVED'};data=expense;}
      else if(config.url==='/organizations/20/business-units') data=[{id:2,name:'Finance',code:'FIN',status:'ACTIVE',parentId:null}];
      return {config,status:200,statusText:'OK',headers:{},data:{success:true,data}};
    };
    const account={user:{id:7,name:'Super admin',email:'admin@example.test'},role:'SUPER_ADMIN',roles:['SUPER_ADMIN'],isSuperAdmin:true,organizationId:20,employeeId:null};
    setAuthSession(account);
    function Personal(){const a=useMyAttendanceSnapshot(),b=useAttendanceToday();return <><p>personal loading:{String(a.loading||b.loading)}</p><button onClick={()=>{a.refetch();b.refetch()}}>Refetch personal</button></>}
    function Fixture(){const [mode,setMode]=useState('personal'); const auth=useAuthSession();return <>
      <nav>{['personal','expenses','units','task'].map(value=><button key={value} onClick={()=>setMode(value)}>{value}</button>)}</nav>
      <button onClick={()=>setAuthSession({...account,employeeId:99})}>Link employee</button>
      <button onClick={()=>setAuthSession({...account,role:'EMPLOYEE',roles:['EMPLOYEE'],isSuperAdmin:false,isPlatformAdmin:false,employeeId:99})}>Employee role</button>
      {mode==='personal'&&<Personal/>}{mode==='expenses'&&<ExpensesPage/>}{mode==='units'&&<BusinessUnits/>}
      {mode==='task'&&<TaskDetailPanel open task={{id:1,taskName:'Test submission',status:'SUBMITTED'}} role={auth.role} currentUserId={7} onClose={()=>{}} onStartTask={()=>{}} onSubmitTask={()=>{}} onReviewTask={()=>{window.reviewed=true}}/>}
    </>}
    createRoot(document.getElementById('root')).render(<Fixture/>);
  `,resolveDir:path.resolve(__dirname,'..'),loader:'tsx'}, bundle:true,write:false,platform:'browser',jsx:'automatic',define:{'process.env':JSON.stringify({NODE_ENV:'test',NEXT_PUBLIC_API_URL:'/api/v1'})}});
  const browser=await chromium.launch({headless:true,...(process.env.CHROME_PATH?{executablePath:process.env.CHROME_PATH}:{})});
  try {
    const page=await browser.newPage();
    const errors=[];page.on('pageerror',error=>errors.push(error.message));
    await page.route('http://access.test/**',route=>route.fulfill({contentType:'text/html',body:'<main id="root"></main>'}));
    await page.goto('http://access.test/');
    await page.addScriptTag({content:bundle.outputFiles[0].text});
    await page.getByText('personal loading:false',{exact:true}).waitFor();
    await page.getByRole('button',{name:'Refetch personal'}).click();
    await page.evaluate(()=>window.dispatchEvent(new Event('focus')));
    assert.equal(await page.evaluate(()=>window.requests.filter(r=>r.url==='/attendance/my').length),0);
    await page.getByRole('button',{name:'Link employee'}).click();
    await page.waitForFunction(()=>window.requests.filter(r=>r.url==='/attendance/my').length===2);
    await page.getByRole('button',{name:'expenses',exact:true}).click();
    await page.getByRole('button',{name:'Submit expense',exact:true}).waitFor();
    await page.getByText('Office travel',{exact:true}).first().click();
    await page.getByRole('button',{name:'Edit expense',exact:true}).click();
    await page.getByLabel('Description',{exact:true}).fill('Updated office travel',{timeout:5000}).catch(async error=>{console.error('Browser errors:',errors);console.error((await page.locator('body').innerText()).slice(-2500));throw error;});
    await page.getByRole('button',{name:'Save changes',exact:true}).click();
    await page.waitForFunction(()=>window.requests.some(r=>r.url==='/expenses/5'&&r.method==='patch'));
    const edit=await page.evaluate(()=>window.requests.find(r=>r.url==='/expenses/5'&&r.method==='patch'));
    assert.equal(edit.data.currency,'USD');assert.equal(edit.headers['X-Organization-Id'],'20');
    await page.getByRole('button',{name:'Approve expense',exact:true}).click();
    await page.waitForFunction(()=>window.requests.some(r=>r.url==='/expenses/5/hr-approve'));
    await page.getByRole('button',{name:'units',exact:true}).click();
    await page.getByRole('button',{name:'Create Business Unit',exact:true}).waitFor();
    await page.getByRole('button',{name:'task',exact:true}).click();
    await page.getByRole('button',{name:'Review submission',exact:true}).click();
    await page.getByRole('button',{name:'Approve',exact:true}).click();
    assert.equal(await page.evaluate(()=>window.reviewed),true);
    await page.getByRole('button',{name:'Employee role',exact:true}).click();
    assert.equal(await page.getByRole('button',{name:'Approve',exact:true}).count(),0);
    await page.getByRole('button',{name:'units',exact:true}).click();
    assert.equal(await page.getByRole('button',{name:'Create Business Unit',exact:true}).count(),0);
    assert.deepEqual(errors,[]);
    console.log('Super-admin smoke passed: personal attendance eligibility, expense edit/approval, currency and tenant preservation, BU management, task review, ordinary-role denial.');
  } finally {await browser.close()}
})().catch(error=>{console.error(error);process.exitCode=1});
