const { chromium } = require("playwright");
const nodemailer = require("nodemailer");

const URL = "https://reserve.tokyodisneyresort.jp/hotel/list/?showWay=&roomsNum=1&adultNum=2&childNum=2&stayingDays=1&useDate=20270117&cpListStr=&childAgeBedInform=01U_3%7C07U_3%7C&searchHotelCD=DHM&searchHotelDiv=&hotelName=&searchHotelName=&searchLayer=&searchRoomName=&hotelSearchDetail=true&detailOpenFlg=0&checkPointStr=&hotelChangeFlg=false&removeSessionFlg=true&returnFlg=false&hotelShowFlg=&displayType=data-hotel&reservationStatus=1";
const TARGET_LABEL = "ポルト・パラディーゾ・サイド";

function normalize(s) { return s.replace(/\s+/g, " ").trim(); }

async function notify(message) {
  const user = process.env.MAIL_USERNAME;
  const pass = process.env.MAIL_PASSWORD;
  const to = process.env.MAIL_TO;
  if (!user || !pass || !to) throw new Error("Gmail secrets are not configured.");
  const transporter = nodemailer.createTransport({
    host: "smtp.gmail.com",
    port: 465,
    secure: true,
    auth: { user, pass }
  });
  await transporter.sendMail({
    from: user,
    to,
    subject: "ミラコスタ空室検知",
    text: message
  });
}

async function main() {
  const browser = await chromium.launch({
    headless: true,
    args: ["--disable-blink-features=AutomationControlled", "--no-sandbox"]
  });
  const context = await browser.newContext({
    locale: "ja-JP",
    timezoneId: "Asia/Tokyo",
    viewport: { width: 1440, height: 1200 },
    userAgent: "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/154.0.0.0 Safari/537.36"
  });
  const page = await context.newPage();
  await page.addInitScript(() => {
    Object.defineProperty(navigator, "webdriver", { get: () => false });
  });

  try {
    await page.goto(URL, { waitUntil: "commit", timeout: 120000 });
    await page.waitForLoadState("domcontentloaded", { timeout: 120000 }).catch(() => {});
    await page.waitForTimeout(10000);

    const bodyText = normalize(await page.locator("body").innerText().catch(() => ""));
    if (!bodyText.includes("ホテルミラコスタ")) {
      throw new Error("MiraCosta result was not found. Page title: " + await page.title());
    }
    if (!bodyText.includes(TARGET_LABEL)) throw new Error("Porto Paradiso Side section was not found.");

    const sectionText = await page.evaluate((label) => {
      const all = [...document.querySelectorAll("body *")];
      const hit = all.find(el => (el.textContent || "").includes(label));
      if (!hit) return "";
      let node = hit;
      for (let i = 0; i < 5 && node.parentElement; i++) {
        const t = node.parentElement.innerText || "";
        if (t.length > 500 && t.length < 20000) node = node.parentElement;
      }
      return node.innerText || "";
    }, TARGET_LABEL);

    const text = normalize(sectionText || bodyText);
    const positivePatterns = [/空室あり/, /空室/, /予約する/, /選択する/, /残室/];
    const negativePatterns = [/満室/, /受付終了/, /販売終了/, /受付不可/];
    const positives = positivePatterns.filter(re => re.test(text));
    const negatives = negativePatterns.filter(re => re.test(text));
    const available = positives.length > 0 && negatives.length === 0;

    console.log(JSON.stringify({
      checkedAt: new Date().toISOString(),
      targetDate: "2027-01-17",
      guests: "大人2名・子供2名（1歳・7歳）",
      side: TARGET_LABEL,
      available,
      positiveSignals: positives.map(String),
      negativeSignals: negatives.map(String),
      excerpt: text.slice(0, 3000)
    }, null, 2));

    if (available) {
      await notify("東京ディズニーシー・ホテルミラコスタ\nポルト・パラディーゾ・サイドに空室候補を検知しました。\n日付: 2027/1/17\n人数: 大人2名・子供2名（1歳・7歳）\n\n予約は自動実行していません。公式サイトで確認してください。");
    }
  } finally {
    await browser.close();
  }
}
main().catch(err => { console.error(err.stack || err); process.exit(1); });
