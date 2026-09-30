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
 console.log('UI checks passed: centered desktop/mobile home, separate routes, nav/footer, mobile testimonials and cookie controls');
}finally{await browser.close();}
