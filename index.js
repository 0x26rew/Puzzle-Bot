let linebot = require('linebot');

let StateMachine = require('javascript-state-machine');

const line = require('@line/bot-sdk');

let bot = linebot({
  channelId: process.env.LINE_CHANNEL_ID,
  channelSecret: process.env.LINE_CHANNEL_SECRET,
  channelAccessToken: process.env.LINE_CHANNEL_ACCESS_TOKEN
});

const client = new line.Client({
  channelSecret: process.env.LINE_CHANNEL_SECRET,
  channelAccessToken: process.env.LINE_CHANNEL_ACCESS_TOKEN
});

/*****************************************************************************/
let fsm = new StateMachine({
  init: 'initial',
  transitions: [
    { name: 'wrong',     from: 'gaming',  to: 'gaming' },
    { name: 'wrong',     from: 'hinted',  to: 'hinted' },
    { name: 'right',     from: ['gaming', 'hinted'],  to: 'gaming' },
    { name: 'change',    from: ['gaming', 'hinted'],  to: 'gaming' },
    { name: 'hint',      from: 'gaming', to: 'hinted' },
    { name: 'restart',   from: ['initial', 'gaming', 'hinted', 'end-of-game'],  to: 'gaming' },
    { name: 'end',       from: ['gaming', 'hinted'],  to: 'end-of-game' },
    { name: 'exit',      from: ['gaming', 'hinted', 'end-of-game'], to: 'initial' },
    { name: 'goto', from: '*', to: function(s) { return s } }
  ],
  methods: {
    onWrong:     function() { console.log('wrong');},
    onRight:     function() { console.log('right') },
    onChange:    function() { console.log('change') },
    onHint:      function() { console.log('hint') },
    onRestart:   function() { console.log('restart') },
    onEnd:       function() { console.log('end game') },
    onExit:      function() { console.log('exit game') },
    onGoto:      function() { console.log('go to') }
  }
});
/*****************************************************************************/
function wrongGuess(event) {
  if (++userWrong == maxWrong) {
    fail.contents.body.contents[0].text = '答案: ' + questions.contents[questionNumber].answer;
    fail.contents.body.contents[1].text = '解釋: ' + questions.contents[questionNumber].reason;
    event.reply(fail);
    history = [];
    fsm.end();
  } else {
    event.reply(['恭喜你答錯了', '你還剩下' + (maxWrong - userWrong).toString() + '次機會']);
    fsm.wrong();
  }
}
/*****************************************************************************/
function rightGuess(event) {
  if (++userRight == maxRight) {
    event.reply(pass);
    history = [];
    fsm.end();
  }
  else {
    event.reply(['嘿嘿賓果答對了', nextQuestion(userRight)]);
    fsm.right();
  }
}
/*****************************************************************************/
function checkAnswer(event) {
  if (event.message.text === questions.contents[questionNumber].answer) {
    rightGuess(event);
  } else {
    wrongGuess(event);
  }
}
/*****************************************************************************/
function nextQuestion(stage) {
  let flag;
  do {
    flag = 0;
    questionNumber =  Math.floor(Math.random()*(questions.contents.length));
    history.push(questionNumber);
    for (let i = 0; i < history.length - 1; i++) {
      if (history[i] == questionNumber)  {
        history.pop();
        flag = 1;
        break;
      }
    }
  } while (flag == 1);
  ask.contents.header.contents[0].text = '第' + (stage + 1).toString() + '題';
  ask.contents.body.contents[0].text = questions.contents[questionNumber].question;
  return ask;
}
/*****************************************************************************/
function giveHint(event) {
  if (fsm.is('hinted')) {
    event.reply('這題已經用過提示了!');
  } else if (hintUsed  == maxHint) {
    event.reply(maxHint.toString() + '次提示機會都用完了喔!');
  } else {
    hintUsed++;
    let msg = (hintUsed == maxHint) ? '之後不能再使用提示囉' : 
              '還剩下' + (maxHint - hintUsed).toString() + '次提示機會';
    event.reply(['提示: ' + questions.contents[questionNumber].hint , msg]);
    fsm.hint();
  }
}
/*****************************************************************************/
function changeQuestion(event) {
  if (changeUsed == maxChange) {
    event.reply('換題目的機會用完了喔!');
  }
  else {
    changeUsed++;
    fsm.change();
    let msg = (changeUsed == maxChange) ? '之後不能再換題目囉' : 
              '換一題,你還可以再換' + (maxChange - changeUsed).toString() + '次題目';
    event.reply([msg, nextQuestion(userRight)]);
  }
}
/*****************************************************************************/
function restartGame(event) {
  hintUsed = 0;
  changeUsed = 0;
  userWrong = 0;
  userRight = 0;
  history = [];
  nextQuestion(0);
  event.reply(ask);
  fsm.restart();
}
/*****************************************************************************/
function checkOnEnd(event) {
  if (event.postback.data === '繼續玩') {
    restartGame(event);
  } else if (event.postback.data === '結束遊戲') {
    fsm.exit();
    event.reply(start);
  }
}
/*****************************************************************************/
function gameInit(event) {
  if (event.postback.data === '開始猜謎') {
    restartGame(event);
  }
}
/*****************************************************************************/
function giveAssist(event) {
  if (event.postback.data === '我要提示') {
    giveHint(event);
  } else if (event.postback.data === '我要放棄') {
    fsm.exit();
    event.reply(start);
  } else if (event.postback.data === '換個題目') {
    changeQuestion(event);
  }
}
/*****************************************************************************/
async function getUser(event, userLog) {
  let destId = (event.source.groupId === undefined) ? 
                event.source.userId : event.source.groupId;
  for (let i = 0; i < userLog.users.length; i++) {
    if (userLog.users[i].id === destId) {
      userRight = Number(userLog.users[i].userRight);
      userWrong = Number(userLog.users[i].userWrong);
      hintUsed  = Number(userLog.users[i].hintUsed);
      changeUsed = Number(userLog.users[i].changeUsed);
      fsm.goto(userLog.users[i].userState);
      history = userLog.users[i].userHistory;
      userNum = i;
      return;
    }
  }
  console.log('new user: ' + destId);
  userRight = 0;
  userWrong = 0;
  hintUsed = 0;
  changeUsed = 0;
  fsm.goto('initial');
  history = [];
  userNum =  -1;
}
/*****************************************************************************/
async function saveUserLog(event, userLog) {
  let destId = (event.source.groupId === undefined) ? 
                event.source.userId : event.source.groupId;
  if (userNum == -1) {
    userLog.users.push({
      id: destId,
      userRight: userRight.toString(),
      userWrong: userWrong.toString(),
      hintUsed: hintUsed.toString(),
      changeUsed: changeUsed.toString(),
      userState: fsm.state,
      userHistory: history
    })
  } else {
    userLog.users[userNum].userRight = userRight;
    userLog.users[userNum].userWrong = userWrong;
    userLog.users[userNum].hintUsed = hintUsed;
    userLog.users[userNum].changeUsed = changeUsed;
    userLog.users[userNum].userState = fsm.state;
    userLog.users[userNum].userHistory = history;
  }
  fs.writeFileSync('users.json', JSON.stringify(userLog, null, ' '), 'utf8');;
}
/*****************************************************************************/
async function onMessage(event) {
  let userLog = JSON.parse(fs.readFileSync("users.json"));
  await getUser(event, userLog);
  if (fsm.is('initial')) {
    event.reply(start);
  } else if (fsm.is('end-of-game')) {
    event.reply('本次遊戲已經結束');
  } else {
    checkAnswer(event);
  }
  await saveUserLog(event, userLog);
  console.log('user ' + event.source.userId);
  console.log('message is '+ event.message.text);
  console.log('answer is ' + questions.contents[questionNumber].answer);
  console.log('state is ' + fsm.state);
}
/*****************************************************************************/
async function onPostback(event) {
  let userLog= JSON.parse(fs.readFileSync("users.json"));
  await getUser(event, userLog);
  
  if (fsm.is('initial')) {
    gameInit(event);
  } else if (fsm.is('end-of-game')) {
    checkOnEnd(event);
  } else {
    giveAssist(event);
  }
  await saveUserLog(event, userLog);
  console.log('user ' + event.source.userId);
  console.log('postback is ' + event.postback.data);
  console.log('answer is ' + questions.contents[questionNumber].answer);
  console.log('state is ' + fsm.state);
}
/*****************************************************************************/
//const editJsonFile = require("edit-json-file");
const fs = require('fs');

let askFile = "ask.json";
let ask = JSON.parse(fs.readFileSync(askFile));

let questionFile = "questions.json";
let questions = JSON.parse(fs.readFileSync(questionFile));

let startFile = "start.json";
let start = JSON.parse(fs.readFileSync(startFile));

let passFile = "pass.json";
let pass = JSON.parse(fs.readFileSync(passFile));

let failFile = "fail.json";
let fail = JSON.parse(fs.readFileSync(failFile));
/*****************************************************************************/
let questionNumber = Math.floor(Math.random()*(questions.contents.length));

let userNum;

let maxHint = 6;
let maxRight = 10;
let maxWrong = 10;
let maxChange = 5;

let hintUsed = 0;
let changeUsed = 0;
let userRight = 0;
let userWrong = 0;

let history = [];
/*****************************************************************************/
bot.on('message', function (event) {
  onMessage(event);
});
/*****************************************************************************/
bot.on('postback', function (event) {
  onPostback(event);
});
/*****************************************************************************/
bot.listen('/', process.env.PORT || 5000, function () {
  console.log('Listening');
});