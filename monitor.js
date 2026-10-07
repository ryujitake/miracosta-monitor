const nodemailer = require("nodemailer");

const URL = "https://reserve.tokyodisneyresort.jp/hotel/list/?showWay=&roomsNum=1&adultNum=2&childNum=2&stayingDays=1&useDate=20270117&cpListStr=&childAgeBedInform=01U_3%7C07U_3%7C&searchHotelCD=DHM&searchHotelDiv=&hotelName=&searchHotelName=&searchLayer=&searchRoomName=&hotelSearchDetail=true&detailOpenFlg=0&checkPointStr=&hotelChangeFlg=false&removeSessionFlg=true&returnFlg=false&hotelShowFlg=&displayType=data-hotel&reservationStatus=1";

async function notify(message){
  const {MAIL_USERNAME:user, MAIL_PASSWORD:pass, MAIL_TO:to}=process.env;
  if(!user||!pass||!to) throw new Error("Gmail secrets are not configured.");
  const transporter=nodemailer.createTransport({host:"smtp.gmail.com",port:465,secure:true,auth:{user,pass}});
  await transporter.sendMail({from:user,to,subject:"ミラコスタ空室検知",text:message});
}

async function main(){
  const key=process.env.TINYFISH_API_KEY;
  if(!key) throw new Error("TINYFISH_API_KEY secret is not configured.");

  const goal=[
    "Tokyo Disney Resort hotel reservation availability check.",
    "Check exactly the stay date 2027-01-17 for 1 night.",
    "Guests: 2 adults and 2 children: one child age 1 and one child age 7.",
    "Hotel: Tokyo DisneySea Hotel MiraCosta.",
    "Only inspect the Porto Paradiso Side (ポルト・パラディーゾ・サイド).",
    "Do NOT book, reserve, click a purchase/booking confirmation, or change any reservation.",
    "Return ONLY JSON with these fields: available (boolean), status (string), evidence (string), checked_at (string).",
    "available=true only if a room in Porto Paradiso Side is clearly bookable/available for these exact search conditions.",
    "If full, unavailable, sold out, or unclear, set available=false."
  ].join(" ");

  const response=await fetch("https://agent.tinyfish.ai/v1/automation/run",{
    method:"POST",
    headers:{"X-API-Key":key,"Content-Type":"application/json"},
    body:JSON.stringify({
      url:URL,
      goal,
      browser_profile:"stealth",
      proxy_config:{enabled:true,country_code:"JP"}
    }),
    signal:AbortSignal.timeout(420000)
  });

  const raw=await response.text();
  if(!response.ok) throw new Error(`TinyFish HTTP ${response.status}: ${raw.slice(0,1000)}`);
  let data;
  try{data=JSON.parse(raw);}catch{throw new Error("TinyFish returned non-JSON: "+raw.slice(0,1000));}

  console.log(JSON.stringify(data,null,2));
  if(data.status!=="COMPLETED") throw new Error("TinyFish run did not complete: "+(data.error||data.status));

  let result=data.result;
  if(typeof result==="string"){try{result=JSON.parse(result);}catch{}}
  const available=result?.available===true;
  if(available){
    await notify(
      "東京ディズニーシー・ホテルミラコスタに空室候補を検知しました。\n"+
      "日付: 2027/1/17\n"+
      "人数: 大人2名・子供2名（1歳・7歳）\n"+
      "対象: ポルト・パラディーゾ・サイド\n\n"+
      "予約は自動実行していません。公式サイトで確認してください。\n\n"+
      "TinyFish evidence: "+(result.evidence||"")
    );
  }
}

main().catch(e=>{console.error(e.stack||e);process.exit(1);});
