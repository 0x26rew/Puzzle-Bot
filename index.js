// 引用 line bot SDK
let linebot = require('linebot');

// 初始化 line bot 需要的資訊，在 Heroku 上的設定的 Config Vars，可參考 Step2
let bot = linebot({
  channelId: process.env.LINE_CHANNEL_ID,
  channelSecret: process.env.LINE_CHANNEL_SECRET,
  channelAccessToken: process.env.LINE_CHANNEL_ACCESS_TOKEN
});

let StateMachine = require('javascript-state-machine');

let MyMachine = new StateMachine({
  init: 'a',
  transitions: [
    { name: 'ab', from: 'a', to: 'b'},
    { name: 'bc', from: 'b', to: 'c'},
    { name: 'ca', from: 'c', to: 'a'}
  ],
  methods: {
    hello: function() {console.log(`Hello`)}    
  }
});

// 當有人傳送訊息給 Bot 時
bot.on('message', function (event) {
  // 回覆訊息給使用者 (一問一答所以是回覆不是推送)
  if (MyMachine.is(a)) {
    event.reply(`from a to b`);
    MyMachine.ab();
  } else if (MyMachine.is(b)) {
    event.reply(`from b to c`);
    MyMachine.bc();
  } else if (MyMachine.is(c)) {
    event.reply(`from c to a`);
    MyMachine.ca();
  }
  event.reply(`你說了 ${event.message.text}`);
  console.log(`UserID is ${event.source.userId}`);
  console.log(`state is ${MyMachine.state}`)
  if (event.source.groupId != undefined)
    console.log(`GroupID is ${event.source.groupId}`);
});

// Bot 所監聽的 webhook 路徑與 port，heroku 會動態存取 port 所以不能用固定的 port，沒有的話用預設的 port 5000
bot.listen('/', process.env.PORT || 5000, function () {
  console.log('全國首家LINE線上機器人上線啦！！');
});