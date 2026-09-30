import { chromium } from 'playwright';
import fs from 'node:fs/promises';

const origin='http://127.0.0.1:8766';
const browser=await chromium.launch({headless:true});
await fs.mkdir('test-screenshots',{recursive:true});
const ensure=(ok,msg)=>{if(!ok)throw new Error(msg)};
try{
 const desktop=await browser.newContext({viewport:{width:1440,height:900},deviceScaleFactor:1});
 await desktop.addInitScript(()=>localStorage.setItem('ferrn-cookie-consent-v2','declined'));
 const p=await desktop.newPage();
 await p.goto(origin+'/',{waitUntil:'domcontentloaded'});
 await p.locator('.hero-editorial > .hero-inner .hero-copy-block h1').waitFor();
 await p.evaluate(()=>document.fonts?.ready);
 const layout=await p.evaluate(()=>{
  const title=document.querySelector('.hero-editorial > .hero-inner h1'),buttons=document.querySelector('.hero-editorial > .hero-inner .hero-actions');
  const a=title.getBoundingClientRect(),b=buttons.getBoundingClientRect();
  return {viewport:innerWidth,titleCenter:a.x+a.width/2,buttonsCenter:b.x+b.width/2,textAlign:getComputedStyle(title).textAlign};
 });
 ensure(layout.textAlign==='center','Home headline must be centered');
 ensure(Math.abs(layout.titleCenter-layout.viewport/2)<40,'Home heading is not centered');
 ensure(Math.abs(layout.buttonsCenter-layout.viewport/2)<40,'Home CTA group is not centered');
 ensure(await p.locator('.nav-links a[href="/careers/"]').count()===0,'Careers should not be in the main header');
 ensure(await p.locator('footer a[href="/careers/"]').count()===1,'Careers must remain accessible in the footer');
 ensure(await p.locator('.nav-links a[href="/procurement/"]').count()===0,'Procurement should be footer-only');
 ensure(await p.locator('footer a[href="/procurement/"]').count()===1,'Procurement missing from footer');
 const footerOrder=await p.locator('.footer-v2>div').first().locator('a').allTextContents();
 ensure(footerOrder.slice(0,5).join('|')==='Our Work|Services|About|Testimonials|Insights','Primary footer links are not in the requested order');
 ensure(await p.locator('.hero-topline').count()===0,'Old Working globally line remains');
 await p.screenshot({path:'test-screenshots/home-desktop.png'});
 // Verify high contrast on the two pages reported unreadable in light mode.
 await p.goto(origin+'/procurement/',{waitUntil:'domcontentloaded'});
 await p.evaluate(()=>{localStorage.setItem('ferrn-theme','light');document.documentElement.dataset.theme='light';});
 await p.locator('.procurement-item strong').first().waitFor();
 const vendor=await p.locator('.procurement-item').first().evaluate(el=>({background:getComputedStyle(el).backgroundColor,text:getComputedStyle(el.querySelector('strong')).color}));
 ensure(vendor.background==='rgb(255, 255, 255)'&&vendor.text==='rgb(21, 21, 21)','Light-mode vendor cards are unreadable: '+JSON.stringify(vendor));
 await p.screenshot({path:'test-screenshots/procurement-light.png'});
 await p.goto(origin+'/policies/',{waitUntil:'domcontentloaded'});
 await p.evaluate(()=>document.documentElement.dataset.theme='light');
 const policy=await p.locator('.credential-card').first().evaluate(el=>({background:getComputedStyle(el).backgroundColor,text:getComputedStyle(el.querySelector('h3')).color}));
 ensure(policy.background==='rgb(255, 255, 255)'&&policy.text==='rgb(21, 21, 21)','Light-mode policy cards are unreadable: '+JSON.stringify(policy));
 await p.screenshot({path:'test-screenshots/policies-light.png'});

 for(const [url,selector] of [['/services/','.service-list'],['/about/','.career-steps'],['/contact/','#contactForm'],['/careers/','.career-list'],['/policies/','.credential-grid']]){
  await p.goto(origin+url,{waitUntil:'domcontentloaded'});
  ensure(await p.locator(selector).count()>0,'Missing '+url+' section '+selector);
 }
 const mobile=await browser.newContext({viewport:{width:390,height:844},isMobile:true,deviceScaleFactor:1});
 await mobile.addInitScript(()=>localStorage.setItem('ferrn-cookie-consent-v2','declined'));
 const m=await mobile.newPage();
 await m.goto(origin+'/',{waitUntil:'domcontentloaded'});
 await m.locator('.hero-editorial h1').waitFor();
 const mobileLayout=await m.evaluate(()=>{
  const h=document.querySelector('.hero-editorial > .hero-inner h1'),r=h.getBoundingClientRect();
  return {viewport:innerWidth,center:r.x+r.width/2,textAlign:getComputedStyle(h).textAlign};
 });
 ensure(mobileLayout.textAlign==='center','Mobile hero text is not centered');
 ensure(Math.abs(mobileLayout.center-mobileLayout.viewport/2)<25,'Mobile hero is horizontally offset');
 await m.screenshot({path:'test-screenshots/home-mobile.png'});
 await m.goto(origin+'/testimonials/',{waitUntil:'domcontentloaded'});
 await m.locator('.testimonial-arrow-v2').first().waitFor({state:'attached',timeout:15000});
 const display=await m.locator('.testimonial-arrow-v2').first().evaluate(e=>getComputedStyle(e).display);
 ensure(display==='none','Mobile testimonial arrows are still visible');
 await m.locator('.testimonial-slider-v2').scrollIntoViewIfNeeded();
 await m.waitForTimeout(350);
 const centered=await m.evaluate(()=>{
   const slider=document.querySelector('.testimonial-viewport-v2');
   const card=slider?.querySelector('.testimonial-track-v2 .testimonial-card-v2:nth-child(2)');
   if(!slider||!card)return null;
   const view=slider.getBoundingClientRect(),item=card.getBoundingClientRect();
   return {difference:Math.abs((view.left+view.width/2)-(item.left+item.width/2)),viewportWidth:view.width,cardWidth:item.width};
 });
 ensure(centered&&centered.difference<25&&centered.cardWidth>centered.viewportWidth*.9,'Mobile testimonial active card is not centered or full width: '+JSON.stringify(centered));

 await m.screenshot({path:'test-screenshots/testimonials-mobile.png'});
 const cookie=await browser.newContext({viewport:{width:1280,height:800},deviceScaleFactor:1});
 const c=await cookie.newPage();
 await c.goto(origin+'/',{waitUntil:'domcontentloaded'});
 await c.locator('[data-cookie-banner]').waitFor({state:'visible'});
 await c.locator('[data-cookie-close]').click();
 ensure(!(await c.locator('[data-cookie-banner]').isVisible()),'Cookie close button did not dismiss the notice');
 await c.locator('[data-cookie-settings]').click();
 ensure(await c.locator('[data-cookie-banner]').isVisible(),'Cookie preferences did not reopen the notice');
 await c.locator('[data-cookie-choice="accepted"]').click();
 ensure(await c.evaluate(()=>localStorage.getItem('ferrn-cookie-consent-v2'))==='accepted','Analytics choice was not saved');

 // Logged-in dashboard, admin testimonials and per-user permissions.
 const adminCtx=await browser.newContext({viewport:{width:1440,height:900}});
 const ad=await adminCtx.newPage();
 await ad.goto(origin+'/admin/',{waitUntil:'domcontentloaded'});
 await ad.locator('input[name="email"]').fill('qa-super@example.invalid');
 await ad.locator('input[name="password"]').fill('QA-super-passphrase-2026');
 await ad.getByRole('button',{name:'Sign in'}).click();
 await ad.locator('.traffic-graph').waitFor({timeout:10000});
 ensure(await ad.locator('[data-graph-range]').count()===3,'Dashboard graph period controls are missing');
 ensure(await ad.locator('.side a[href="/admin/?tab=proposals"]').count()===1,'Proposal manager menu missing');
 await ad.screenshot({path:'test-screenshots/admin-dashboard.png'});
 await ad.goto(origin+'/admin/?tab=testimonials',{waitUntil:'domcontentloaded'});
 await ad.locator('input[name="name"]').first().waitFor();
 ensure(await ad.getByRole('button',{name:'Hide on site'}).count()>0,'Admin testimonial visibility controls are missing');
 await ad.screenshot({path:'test-screenshots/admin-testimonials.png'});
 await ad.goto(origin+'/admin/?tab=settings',{waitUntil:'domcontentloaded'});
 ensure(await ad.locator('input[name="company_profile_pdf"]').count()===1,'Replaceable company-profile upload control missing');
 ensure(await ad.locator('input[name="api_key"]').count()===1,'Encrypted chatbot API-key control missing');
 await ad.goto(origin+'/admin/heatmap.php',{waitUntil:'domcontentloaded'});
 await ad.locator('[data-heatmap-page]').waitFor();
 ensure(await ad.locator('#toggleHeatmap').count()===1,'Full-screen heatmap toggle missing');
 await ad.screenshot({path:'test-screenshots/admin-heatmap.png'});
 await ad.goto(origin+'/admin/users.php',{waitUntil:'domcontentloaded'});
 ensure(await ad.locator('input[name="permissions[analytics]"]').count()>0,'Admin user permissions missing');
 const limitedCtx=await browser.newContext({viewport:{width:1280,height:800}});
 const limited=await limitedCtx.newPage();
 await limited.goto(origin+'/admin/',{waitUntil:'domcontentloaded'});
 await limited.locator('input[name="email"]').fill('qa-limited@example.invalid');
 await limited.locator('input[name="password"]').fill('QA-limited-passphrase-2026');
 await limited.getByRole('button',{name:'Sign in'}).click();
 await limited.locator('.traffic-graph').waitFor({timeout:10000});
 ensure(await limited.locator('.side a[href="/admin/?tab=settings"]').count()===0,'Restricted settings still visible to limited admin');
 const forbidden=await limited.goto(origin+'/admin/?tab=settings',{waitUntil:'domcontentloaded'});
 ensure(forbidden.status()===403,'Limited admin can still access denied settings');
 const forbiddenUsers=await limited.goto(origin+'/admin/users.php',{waitUntil:'domcontentloaded'});
 ensure(forbiddenUsers.status()===403,'Limited admin can access super administrator user management');
 await limited.goto(origin+'/admin/?tab=leads',{waitUntil:'domcontentloaded'});
 const csrf=await limited.locator('input[name="csrf"]').first().inputValue().catch(()=>null);
 if(csrf){
   const bypass=await limited.request.post(origin+'/admin/?tab=dashboard',{form:{csrf,action:'save_project',title:'Injected project',live:'https://example.invalid/'}});
   ensure(bypass.status()===403,'Limited admin bypassed project permissions via dashboard POST');
 }

 console.log('UI checks passed: centered desktop/mobile home, separate routes, nav/footer, mobile testimonials and cookie controls');
}finally{await browser.close();}
