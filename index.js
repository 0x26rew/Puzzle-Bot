/*  Use 'javasript-state-machine' to implement the finate state machine 
    
    <States>
    initial:  state before the game start.
    gaming :  the user received a riddle from bot and tries to figure it out
              without a hint.
    hinted :  the user is hinted while the current puzzle is unsolved.
    end-of-game: the user wins/loses the game, the robot will puzzleMsg if 
              he/she want to play again.
    ---------------------------------------------------------------------------
    <Transitions>
    wrong: user send a text message in state 'gaming' or 'hinted' but the
           text is imcompatable with the answer of current puzzle.
    right: user send a text message in state 'gaming' or 'hinted' and the 
           text is compatible with the answer.
    change: user send a postback to change another puzzle.
    hint:  user puzzleMsg for a hint of this puzzle for the first time.
    restart: restart the game and the user get his/her first question.
    end:   user wins or loses the game.
    exit:  user leaves the game.
    goto:  go to the target state directly.
 */
const StateMachine = require('javascript-state-machine');

//const visualize = require('javascript-state-machine/lib/visualize');

//console.log(visualize);

let fsm = new StateMachine({
  init: 'initial',
  transitions: [
    { name: 'wrong',     from: 'gaming',  to: 'gaming' },
    { name: 'wrong',     from: 'hinted',  to: 'hinted' },
    { name: 'right',     from: ['gaming', 'hinted'],  to: 'gaming' },
    { name: 'change',    from: ['gaming', 'hinted'],  to: 'gaming' },
    { name: 'hint',      from: 'gaming', to: 'hinted' },
    { name: 'restart',   from: ['initial', 'gaming', 'hinted', 'end-of-game'],
                         to: 'gaming' },
    { name: 'end',       from: ['gaming', 'hinted'],  to: 'end-of-game' },
    { name: 'exit',      from: ['gaming', 'hinted', 'end-of-game'], 
                         to: 'initial' },
    { name: 'goto',      from: '*', to: function(s) { return s } }
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

//console.log(visualize(fsm, { name: 'bot', orientation: 'horizontal' }));
/*****************************************************************************/
/* Required files */
const fs = require('fs');

let questions = JSON.parse(fs.readFileSync("Questions/questions.json"));

let puzzleMsg = JSON.parse(fs.readFileSync("FlexMsgs/PuzzleMsg.json"));

let startMsg = JSON.parse(fs.readFileSync("FlexMsgs/StartMsg.json"));

let passMsg = JSON.parse(fs.readFileSync("FlexMsgs/PassMsg.json"));

let failMsg = JSON.parse(fs.readFileSync("FlexMsgs/FailMsg.json"));
/*****************************************************************************/
let questionNumber; /* The place of a question in array 'questions.contents' */
let userNum;        /* The place of a question in array 'userLog.users'      */

let maxWrong = 10;  /* User can not made more than 10 wrong guesses or he/she 
                       lose the game */
let maxRight = 10;  /* User must answer 10 puzzles correctly to win the game */
let maxHint = 6;    /* User can be hinted for 6 times in a game */
let maxChange = 5;  /* User can change his/her puzzle at most 5 times in 
                       one game */

let userWrong;      /* <= maxWrong */
let userRight;      /* <= maxRight */
let hintUsed;       /* <= maxHint */
let changeUsed;     /* <= maxChange */

let history = [];   /* The question that the user has seen */
/*****************************************************************************/
function wrongGuess(event) {
  if (++userWrong == maxWrong) {
    /* User reach the limit of wrong guess and fails the game */
    failMsg.contents.body.contents[0].text = 
      '謎底: ' + questions.contents[questionNumber].answer;
    failMsg.contents.body.contents[1].text = 
      '解答: ' + questions.contents[questionNumber].reason;
    event.reply(['真是太遜了', failMsg]);
    history = [];
    fsm.end();  /* into the 'end-of-game' state */
  } else {
    /* User still has chance to guess */
    event.reply(['恭喜你答錯了', 
      '你還剩下' + (maxWrong - userWrong).toString() + '次機會']);
    fsm.wrong();
  }
}
/*****************************************************************************/
function rightGuess(event) {
  if (++userRight == maxRight) {
    /* User wins the game and goes into the 'end-of-game' state */
    event.reply(['你真了不起', passMsg]);
    history = [];
    fsm.end();
  }
  else {
    /* User made a right guess and is going to proceed to next question */
    event.reply(['嘿嘿賓果答對了', nextQuestion(userRight)]);
    fsm.right();
  }
}
/*****************************************************************************/
function checkAnswer(event) {
  /* Using will current state is 'gaming' or 'hinted' and bot receives a text
     message */
  if (event.message.text === questions.contents[questionNumber].answer) {
    rightGuess(event);
  } else {
    wrongGuess(event);
  }
}
/*****************************************************************************/
function nextQuestion(stage) {
  /* Return a new puzzle message */
  let flag;
  /* Randomly select a question and check if the question is in the user's 
     history */
  do {
    flag = 0;
    questionNumber =  Math.floor(Math.random()*(questions.contents.length));  
    for (let i = 0; i < history.length; i++) {
      if (history[i] == questionNumber)  {
        flag = 1;
        break;
      }
    }
  } while (flag == 1);

  history.push(questionNumber);

  puzzleMsg.contents.header.contents[0].text = 
    '第' + (stage + 1).toString() + '題';
  puzzleMsg.contents.body.contents[0].text = 
    questions.contents[questionNumber].question;
  return puzzleMsg;
}
/*****************************************************************************/
function giveHint(event) {
  /* Give the user a hint of puzzle only if the state is 'gaming' and he/she 
     still has chance to get a hint */
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
  /* Give the user a new puzzle if he/she still has chance to change
     questions */
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
  /* Reset the following element before restart and ask a new question */
  hintUsed = 0;
  changeUsed = 0;
  userWrong = 0;
  userRight = 0;
  history = [];
  nextQuestion(0);
  event.reply(puzzleMsg);
  fsm.restart();
}
/*****************************************************************************/
function leaveorAgain(event) {
  /* On the 'end-of-game' stage, user can make a choice to play again or leave 
     the game */
  if (event.postback.data === '繼續玩') {
    restartGame(event);
  } else if (event.postback.data === '結束遊戲') {
    fsm.exit();
    event.reply(startMsg);
  }
}
/*****************************************************************************/
function gameInit(event) {
  /* Initialize the game if user press the '開始猜謎' button */
  if (event.postback.data === '開始猜謎') {
    restartGame(event);
  }
}
/*****************************************************************************/
function giveAssist(event) {
  /* Give the user a correspnding assistence */
  if (event.postback.data === '我要提示') {
    giveHint(event);
  } else if (event.postback.data === '我要放棄') {
    fsm.exit();
    event.reply(startMsg);
  } else if (event.postback.data === '換個題目') {
    changeQuestion(event);
  }
}
/*****************************************************************************/
async function getUser(event, userLog) {
  /* While receive a message or postback from a user, check if the userId is in 
     userLog or not. If the user is new, initializing the state and other 
     attributes, or load back the attribute of the user otherwise. */
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
      questionNumber = (history.length == 0) ? -1 : history.slice(-1);
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
  /* Save the attrbutes and state of user in users.json */
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
}
/*****************************************************************************/
let linebot = require('linebot');

let bot = linebot({
  channelId: process.env.LINE_CHANNEL_ID,
  channelSecret: process.env.LINE_CHANNEL_SECRET,
  channelAccessToken: process.env.LINE_CHANNEL_ACCESS_TOKEN
});
/*****************************************************************************/
bot.on('message', async function (event) {
  /* Handle message events */
  try {
    if (event.message.text == undefined) {
      event.reply('傳這什麼東西');
    } else {
      let userLog = JSON.parse(fs.readFileSync("Users/users.json"));
      await getUser(event, userLog);

      console.log('user ' + event.source.userId);
      console.log('message is '+ event.message.text);

      if (questionNumber >= 0)
        console.log('answer is ' + questions.contents[questionNumber].answer);

      if (fsm.is('initial')) {
        event.reply(startMsg);
      } else if (fsm.is('end-of-game')) {
        event.reply('本次遊戲已經結束');
      } else {
        checkAnswer(event);
      }

      await saveUserLog(event, userLog);
      fs.writeFileSync('Users/users.json', JSON.stringify(userLog, null, ' '),
                        'utf8');
      
      console.log('state is ' + fsm.state);
    }
  } catch (e) {
    console.log(e);
  }
});
/*****************************************************************************/
bot.on('postback', async function (event) {
  /* Handle postback event */
  try {
    let userLog= JSON.parse(fs.readFileSync("Users/users.json"));
    await getUser(event, userLog);
    
    if (fsm.is('initial')) {
      gameInit(event);
    } else if (fsm.is('end-of-game')) {
      leaveorAgain(event);
    } else {
      giveAssist(event);
    }
    await saveUserLog(event, userLog);
    fs.writeFileSync('Users/users.json', 
      JSON.stringify(userLog, null, ' '), 'utf8');
    console.log('user ' + event.source.userId);
    console.log('postback is ' + event.postback.data);
    console.log('state is ' + fsm.state);
  } catch (e) {
    console.log(e);
  }

});
/*****************************************************************************/
bot.listen('/', process.env.PORT || 5000, function () {
  console.log('Listening');
});