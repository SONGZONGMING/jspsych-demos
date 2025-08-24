//------------------------------------//
// Define utilities.
//------------------------------------//

// ========= RNG（保持你现在的 LCG，可复现） =========
let randomSeed = 12345; // 固定种子
Math.random = function() {
  randomSeed = (randomSeed * 9301 + 49297) % 233280;
  return randomSeed / 233280;
};

// ========= 正态采样 & clamping（和你一致） =========
function gaussianRandom(mean, sigma) {
  let u = Math.random()*0.682;
  return ((u % 1e-8 > 5e-9 ? 1 : -1) * (Math.sqrt(-Math.log(Math.max(1e-9, u)))-0.618))*1.618 * sigma + mean;
}
function sampleReward(mean, sigma) {
  return Math.max(0, Math.min(100, Math.floor(gaussianRandom(mean, sigma))));
}

// ========= 条件与序列 =========
const forced_choices_equal = [
  [0,0,1,1], [0,1,0,1], [0,1,1,0],
  [1,0,0,1], [1,0,1,0], [1,1,0,0]
];
const forced_choices_unequal_leftRare = [
  [0,1,1,1], [1,0,1,1], [1,1,0,1], [1,1,1,0]
];
const forced_choices_unequal_rightRare = [
  [0,0,0,1], [0,0,1,0], [0,1,0,0], [1,0,0,0]
];
// 全局轮转计数器
const seqCounter = { equal:0, left:0, right:0 };

// ========= 生成 320 个 trial =========
// ========= 生成 320 个 trial（base 为参照值，另一侧 = base ± diff） =========
let HORIZONS = [];
const mean_base_list = [40, 60];
const diff_list = [4, 8, 12, 20, 30];
const horizon_list = [5, 10];
const sigma = 8;



for (let horizon of horizon_list) {
  const totalTrials = horizon ;

  for (let mean_base of mean_base_list) {
    for (let diff of diff_list) {

      // 显式枚举：哪边更高 & 哪边作为参照（base）
      for (let betterSide of ['left','right']) {
        for (let infoType of ['equal','unequal']) {
          for (let refSide of ['left','right']) {

            // 每个条件 2 个复本；不等信息里用来平衡 leftRare/rightRare
            for (let rep = 0; rep < 2; rep++) {

              // --- 由 refSide + betterSide 决定 base±diff ---
              let mean_L, mean_R;
              if (refSide === 'left') {
                mean_L = mean_base; // 左 = base
                mean_R = mean_base + (betterSide === 'right' ? +diff : -diff); // 右 = base±diff
              } else {
                mean_R = mean_base; // 右 = base
                mean_L = mean_base + (betterSide === 'left' ? +diff : -diff);  // 左 = base±diff
              }

              // --- 强制序列；不等信息平衡稀有侧 ---
              let forced_choices, rareSide = null;
              if (infoType === 'equal') {
                forced_choices = forced_choices_equal[ seqCounter.equal % forced_choices_equal.length ];
                seqCounter.equal++;
              } else {
                const pickLeft = (rep % 2 === 0); // 本条件两复本：一次 leftRare，一次 rightRare
                if (pickLeft) {
                  forced_choices = forced_choices_unequal_leftRare[ seqCounter.left % forced_choices_unequal_leftRare.length ];
                  seqCounter.left++; rareSide = 'left';
                } else {
                  forced_choices = forced_choices_unequal_rightRare[ seqCounter.right % forced_choices_unequal_rightRare.length ];
                  seqCounter.right++; rareSide = 'right';
                }
              }

              const rewards_L = Array.from({length: totalTrials}, () => sampleReward(mean_L, sigma));
              const rewards_R = Array.from({length: totalTrials}, () => sampleReward(mean_R, sigma));

              HORIZONS.push({
                type: jsPsychHorizonsTrial,
                horizon,
                rewards_L, rewards_R,
                forced_choices,
                metadata: {
                  mean_base, diff, mean_L, mean_R,
                  condition: infoType,
                  refSide,                                        // 哪侧用 base
                  betterOption: (mean_L > mean_R ? 'left' : 'right'),
                  rareSide,                                       // 不等信息稀有侧
                  sequencePattern: forced_choices.join('')
                }
              });
            }
          }
        }
      }
    }
  }
}
// 现在为：2(h)×2(b)×5(d)×2(高侧)×2(信息)×4(复本)=320

// ========= 简易验证（关键维度的计数应为各 160 或 80） =========
function validateBalance() {
  const s = {
    total: HORIZONS.length,
    byHorizon:{5:0,10:0},
    byBase:{40:0,60:0},
    byDiff:{4:0,8:0,12:0,20:0,30:0},
    byCondition:{equal:0,unequal:0},
    byHighSide:{left:0,right:0},
    byRefSide:{left:0, right:0},
    byRareSide:{left:0,right:0,null:0}
  };
  for (const t of HORIZONS){
    s.byHorizon[t.horizon]++;
    s.byBase[t.metadata.mean_base]++;
    s.byDiff[t.metadata.diff]++;
    s.byCondition[t.metadata.condition]++;
    s.byHighSide[t.metadata.baseOnLeft?'left':'right']++;
    s.byRefSide[t.metadata.refSide]++;
    s.byRareSide[t.metadata.rareSide ?? 'null']++;
  }
  return s;
}
console.log('基本平衡：', validateBalance());

// ========= 可复现打乱（依赖已改写的 Math.random） =========
HORIZONS = jsPsych.randomization.shuffle(HORIZONS);

console.log(`总试次: ${HORIZONS.length}（应为 320）`);

//------------------------------------//
// Define transition screens.
//------------------------------------//

var READY_01 = {
  type: jsPsychInstructions,
  pages: [
    "Great job! You've passed the comprehension check.",
    "Get ready to begin <b>Block 1/2</b>.<br>Press next when you're ready to start.",
  ],
  show_clickable_nav: true,
  button_label_previous: "Prev",
  button_label_next: "Next",
}

var READY_02 = {
  type: jsPsychInstructions,
  pages: [
    "Take a break for a few moments and press any button when you are ready to continue.",
    "Get ready to begin <b>Block 2/2</b>.<br>Press next when you're ready to start.",
  ],
  show_clickable_nav: true,
  button_label_previous: "Prev",
  button_label_next: "Next",
}

// Define finish screen.
var FINISHED = {
  type: jsPsychInstructions,
  pages: [
    "Great job! You've finished the task.",
  ],
  show_clickable_nav: true,
  button_label_previous: "Prev",
  button_label_next: "Next",
}

console.log('HORIZONS 数量:', HORIZONS.length);
console.log('示例:', HORIZONS.slice(0, 320));