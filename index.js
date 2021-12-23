// 引用 line bot SDK
var linebot = require('linebot');
var StateMachine = require('javascript-state-machine');
// 初始化 line bot 需要的資訊，在 Heroku 上的設定的 Config Vars，可參考 Step2
var bot = linebot({
  channelId: process.env.LINE_CHANNEL_ID,
  channelSecret: process.env.LINE_CHANNEL_SECRET,
  channelAccessToken: process.env.LINE_CHANNEL_ACCESS_TOKEN
});
const line = require('@line/bot-sdk');
const client = new line.Client({
  channelSecret: process.env.LINE_CHANNEL_SECRET,
  channelAccessToken: process.env.LINE_CHANNEL_ACCESS_TOKEN
});

var fsm = new StateMachine({
  init: 'floor1',
  transitions: [
    { name: 'upStair',     from: 'floor1',  to: 'floor2' },
    { name: 'upStair',     from: 'floor2',  to: 'floor3' },
    { name: 'upStair',     from: 'floor3',  to: 'floor4' },
    { name: 'upStair',     from: 'floor4',  to: 'floor5' },
    { name: 'downStair',   from: 'floor5',  to: 'floor4' },
    { name: 'downStair',   from: 'floor4',  to: 'floor3' },
    { name: 'downStair',   from: 'floor3',  to: 'floor2' },
    { name: 'downStair',   from: 'floor2',  to: 'floor1' },
  ],
  methods: {
    onUpStair:     function() { console.log('up');},
    onDownStair:   function() { console.log('down') }
  }
});

var destId;
// 當有人傳送訊息給 Bot 時
bot.on('message', function (event) {
  // 回覆訊息給使用者 (一問一答所以是回覆不是推送)
  //event.reply(`你說了 ${event.message.text}`);
  //console.log('down');
  if (event.source.groupId != undefined) {
    destId = event.source.groupId;
  } else {
    destId = event.source.userId;
  }

  if (event.message.text === '上樓') {
    if (fsm.can('upStair')) {
      fsm.upStair();
      console.log('up');
      event.reply(`上樓囉`);
      showfloor(fsm, destId);
    } else {
      event.reply(`上你媽啦`);
    }
  } else if (event.message.text === '下樓') {
    if (fsm.can('downStair')) {
      fsm.downStair();
      console.log('down');
      event.reply(`下樓囉`);
      showfloor(fsm, destId);
    } else {
      event.reply(`下你媽啦`);
    }
  } else if (event.message.text === '我在哪裡') {
    showfloor(fsm, destId);
  } else {
    //event.reply(`公三小`);
  }

  

});

// Bot 所監聽的 webhook 路徑與 port，heroku 會動態存取 port 所以不能用固定的 port，沒有的話用預設的 port 5000
bot.listen('/', process.env.PORT || 5000, function () {
  console.log('全國首家LINE線上機器人上線啦！！');
});

function showfloor(machine, sentId) {
  switch (machine.state) {
    case 'floor1':
      client.pushMessage(destId, {type: 'text', text: '你在1樓'});
      break;
    case 'floor2':
      client.pushMessage(destId, {type: 'text', text: '你在2樓'});
      break;
    case 'floor3':
      client.pushMessage(destId, {type: 'text', text: '你在3樓'});
      break;
    case 'floor4':
      client.pushMessage(destId, {type: 'text', text: '你在4樓'});
      break;
    case 'floor5':
      client.pushMessage(destId, {type: 'text', text: '你在5樓'});
      break;
    default:
  }
}