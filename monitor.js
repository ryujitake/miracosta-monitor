const { chromium } = require("playwright");
const nodemailer = require("nodemailer");

const URL = "https://reserve.tokyodisneyresort.jp/hotel/list/?showWay=&roomsNum=1&adultNum=2&childNum=2&stayingDays=1&useDate=20270117&cpListStr=&childAgeBedInform=01U_3%7C07U_3%7C&searchHotelCD=DHM&searchHotelDiv=&hotelName=&searchHotelName=&searchLayer=&searchRoomName=&hotelSearchDetail=true&detailOpenFlg=0&checkPointStr=&hotelChangeFlg=false&removeSessionFlg=true&returnFlg=false&hotelShowFlg=&displayType=data-hotel&reservationStatus=1";
const TARGET_LABEL = "ポルト・パラディーゾ・サイド";
function normalize(s){return s.replace(/\s+/g," ").trim();}
async function notify(message){
  const {MAIL_USERNAME:user,MAIL_PASSWORD:pass,MAIL_TO:to}=process.env;
  if(!user||!pass||!to) throw new Error("Gmail secrets are not configured.");
  const transporter=nodemailer.createTransport({host:"smtp.gmail.com",port:465,secure:true,auth:{user,pass}});
  await transporter.sendMail({from:user,to,subject:"ミラコスタ空室検知",text:message});
}
async function main(){
  const browser=await chromium.launch({headless:true,args:["--no-sandbox","--disable-blink-features=AutomationControlled"]});
  const context=await browser.newContext({locale:"ja-JP",timezoneId:"Asia/Tokyo",viewport:{width:1440,height:1200},userAgent:"Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/153.0.0.0 Safari/537.36"});
  const page=await context.newPage();
  await page.addInitScript(()=>Object.defineProperty(navigator,"webdriver",{get:()=>false}));
  try{
    try{await page.goto(URL,{waitUntil:"domcontentloaded",timeout:60000});}catch(e){console.log("Direct navigation timed out; continuing.");}
    await page.waitForTimeout(15000);
    let body=normalize(await page.locator("body").innerText().catch(()=>""));
    if(!body.includes("ホテルミラコスタ")||!body.includes(TARGET_LABEL)){
      console.log("First load did not contain target; retrying.");
      await page.reload({waitUntil:"domcontentloaded",timeout:60000}).catch(()=>{});
      await page.waitForTimeout(15000);
      body=normalize(await page.locator("body").innerText().catch(()=>""));
    }
    if(!body.includes("ホテルミラコスタ")) throw new Error("MiraCosta result was not found.");
    if(!body.includes(TARGET_LABEL)) throw new Error("Porto Paradiso Side section was not found.");
    const text=normalize(await page.evaluate(label=>{
      const els=[...document.querySelectorAll("body *")];
      const hit=els.find(e=>(e.textContent||"").includes(label));
      if(!hit)return "";
      let n=hit;
      for(let i=0;i<6&&n.parentElement;i++){const t=n.parentElement.innerText||"";if(t.length>500&&t.length<20000)n=n.parentElement;}
      return n.innerText||"";
    },TARGET_LABEL));
    const pos=[/空室あり/,/空室/,/予約する/,/選択する/,/残室/].filter(r=>r.test(text));
    const neg=[/満室/,/受付終了/,/販売終了/,/受付不可/].filter(r=>r.test(text));
    const available=pos.length>0&&neg.length===0;
    console.log(JSON.stringify({checkedAt:new Date().toISOString(),targetDate:"2027-01-17",guests:"大人2名・子供2名（1歳・7歳）",side:TARGET_LABEL,available,positiveSignals:pos.map(String),negativeSignals:neg.map(String),excerpt:text.slice(0,3000)},null,2));
    if(available) await notify("東京ディズニーシー・ホテルミラコスタ\nポルト・パラディーゾ・サイドに空室候補を検知しました。\n日付: 2027/1/17\n人数: 大人2名・子供2名（1歳・7歳）\n\n予約は自動実行していません。公式サイトで確認してください。");
  }finally{await browser.close();}
}
main().catch(e=>{console.error(e.stack||e);process.exit(1);});