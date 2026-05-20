// Bilingual strings + tutorial library data.
const I18N = {
  zh: {
    appName: "小画板",
    tagline: "陪你一起画画的小伙伴",
    listening: "听听画板的话…",
    thinking: "让我看看你画的是什么呢…",
    drawSomething: "在黑板上画点什么吧～",
    dontKnow: "我不会画",
    showTutorial: "教我画",
    library: "教程库",
    gallery: "作品集",
    save: "保存作品",
    clear: "清空画板",
    confirmClear: "真的要擦掉这幅画吗？",
    undo: "撤销",
    redo: "重做",
    eraser: "橡皮擦",
    brushSize: "笔刷粗细",
    colors: "粉笔颜色",
    next: "下一步",
    prev: "上一步",
    replay: "再演示一次",
    close: "关闭",
    idlePrompt: "需要我教你画点什么吗？",
    yes: "好呀",
    no: "我自己画",
    empty: "画板上还什么都没有呢，先画点什么吧～",
    saved: "作品已保存到作品集啦！",
    galleryEmpty: "作品集还是空的，画完记得保存哦～",
    delete: "删除",
    step: "第 {n} 步",
    of: "共 {n} 步",
    voiceOn: "声音开",
    voiceOff: "声音关",
    chooseTutorial: "想画什么呢？",
    aiUnavailable: "嗯…让我再想想",
  },
  en: {
    appName: "Drawing Buddy",
    tagline: "Your little drawing companion",
    listening: "Listening to the board…",
    thinking: "Let me see what you drew…",
    drawSomething: "Draw something on the board~",
    dontKnow: "I don't know how",
    showTutorial: "Teach me",
    library: "Tutorials",
    gallery: "Gallery",
    save: "Save",
    clear: "Clear",
    confirmClear: "Really erase this drawing?",
    undo: "Undo",
    redo: "Redo",
    eraser: "Eraser",
    brushSize: "Brush size",
    colors: "Chalk colors",
    next: "Next",
    prev: "Back",
    replay: "Replay",
    close: "Close",
    idlePrompt: "Want me to show you how to draw something?",
    yes: "Yes please",
    no: "I'll keep drawing",
    empty: "The board is empty — draw something first~",
    saved: "Saved to your gallery!",
    galleryEmpty: "Gallery is empty — save your drawings here~",
    delete: "Delete",
    step: "Step {n}",
    of: "of {n}",
    voiceOn: "Voice on",
    voiceOff: "Voice off",
    chooseTutorial: "What shall we draw?",
    aiUnavailable: "Hmm… let me think a bit",
  },
};

// Gentle, warm reactions used after AI recognition.
// {thing} substituted with localized noun.
const REACTIONS = {
  zh: [
    "哇～是{thing}！画得好可爱呀～",
    "看到啦，是一只{thing}对不对？真棒！",
    "好喜欢这个{thing}，颜色也好看～",
    "嘿嘿，是{thing}吧？我猜对了吗？",
    "好可爱的{thing}呀～你真厉害！",
    "{thing}画得真有感觉呢，继续加油～",
  ],
  en: [
    "Oh! Is that a {thing}? So cute!",
    "I see it — a lovely {thing}! Well done!",
    "Aww, what a sweet {thing}!",
    "Is that a {thing}? You got it!",
    "Such a charming {thing} — keep going~",
    "That {thing} is wonderful, you're amazing!",
  ],
};

// Tutorial library — each step is a list of SVG path strings to animate sequentially.
// Drawn on a 400x300 viewBox. Keep paths simple, kid-style.
const TUTORIALS = [
  {
    id: "fish",
    name: { zh: "小鱼", en: "Fish" },
    icon: "🐟",
    steps: [
      {
        hint: { zh: "先画一个椭圆做身体", en: "Draw an oval body" },
        paths: ["M 110 150 Q 110 90 200 90 Q 290 90 290 150 Q 290 210 200 210 Q 110 210 110 150 Z"],
      },
      {
        hint: { zh: "右边加个三角尾巴", en: "Add a triangle tail on the right" },
        paths: ["M 285 150 L 340 110 L 340 190 Z"],
      },
      {
        hint: { zh: "画一只大眼睛和嘴巴", en: "Add a big eye and mouth" },
        paths: [
          "M 150 130 m -10 0 a 10 10 0 1 0 20 0 a 10 10 0 1 0 -20 0",
          "M 125 165 Q 135 175 120 180",
        ],
      },
      {
        hint: { zh: "加几道波浪鳞片和水泡", en: "Add scales and bubbles" },
        paths: [
          "M 200 110 Q 215 130 200 150 Q 215 170 200 190",
          "M 230 110 Q 245 130 230 150 Q 245 170 230 190",
          "M 90 80 m -8 0 a 8 8 0 1 0 16 0 a 8 8 0 1 0 -16 0",
          "M 70 60 m -5 0 a 5 5 0 1 0 10 0 a 5 5 0 1 0 -10 0",
        ],
      },
    ],
  },
  {
    id: "bird",
    name: { zh: "小鸟", en: "Bird" },
    icon: "🐦",
    steps: [
      {
        hint: { zh: "画一个圆圆的头", en: "Draw a round head" },
        paths: ["M 200 110 m -45 0 a 45 45 0 1 0 90 0 a 45 45 0 1 0 -90 0"],
      },
      {
        hint: { zh: "下面画一个大大的身体", en: "Draw a bigger body below" },
        paths: ["M 200 200 m -65 -10 a 65 75 0 1 0 130 0 a 65 75 0 1 0 -130 0"],
      },
      {
        hint: { zh: "加上小翅膀和尖尖嘴巴", en: "Add a wing and pointy beak" },
        paths: [
          "M 175 200 Q 200 250 235 220",
          "M 245 105 L 275 110 L 245 120 Z",
        ],
      },
      {
        hint: { zh: "画眼睛和两只小脚", en: "Add eyes and little feet" },
        paths: [
          "M 220 100 m -5 0 a 5 5 0 1 0 10 0 a 5 5 0 1 0 -10 0",
          "M 185 260 L 180 280 M 185 260 L 195 280",
          "M 215 260 L 210 280 M 215 260 L 225 280",
        ],
      },
    ],
  },
  {
    id: "cat",
    name: { zh: "小猫", en: "Cat" },
    icon: "🐱",
    steps: [
      {
        hint: { zh: "画一个圆圆的脸", en: "Draw a round face" },
        paths: ["M 200 160 m -75 0 a 75 70 0 1 0 150 0 a 75 70 0 1 0 -150 0"],
      },
      {
        hint: { zh: "上面加两只尖耳朵", en: "Add two pointy ears" },
        paths: [
          "M 140 100 L 130 50 L 175 90 Z",
          "M 260 100 L 270 50 L 225 90 Z",
        ],
      },
      {
        hint: { zh: "画眼睛、鼻子和嘴巴", en: "Add eyes, nose and mouth" },
        paths: [
          "M 170 150 m -7 0 a 7 7 0 1 0 14 0 a 7 7 0 1 0 -14 0",
          "M 230 150 m -7 0 a 7 7 0 1 0 14 0 a 7 7 0 1 0 -14 0",
          "M 200 180 L 195 188 L 205 188 Z",
          "M 200 188 Q 190 200 180 195 M 200 188 Q 210 200 220 195",
        ],
      },
      {
        hint: { zh: "别忘了胡须哦", en: "Don't forget the whiskers" },
        paths: [
          "M 130 175 L 165 180",
          "M 130 190 L 165 188",
          "M 270 175 L 235 180",
          "M 270 190 L 235 188",
        ],
      },
    ],
  },
  {
    id: "sun",
    name: { zh: "太阳", en: "Sun" },
    icon: "☀️",
    steps: [
      {
        hint: { zh: "画一个圆圆的太阳", en: "Draw a round sun" },
        paths: ["M 200 150 m -55 0 a 55 55 0 1 0 110 0 a 55 55 0 1 0 -110 0"],
      },
      {
        hint: { zh: "四周画上光芒", en: "Add rays all around" },
        paths: [
          "M 200 70 L 200 40",
          "M 200 230 L 200 260",
          "M 120 150 L 90 150",
          "M 280 150 L 310 150",
          "M 145 95 L 125 75",
          "M 255 95 L 275 75",
          "M 145 205 L 125 225",
          "M 255 205 L 275 225",
        ],
      },
      {
        hint: { zh: "画一张笑脸", en: "Add a happy face" },
        paths: [
          "M 180 135 m -5 0 a 5 5 0 1 0 10 0 a 5 5 0 1 0 -10 0",
          "M 220 135 m -5 0 a 5 5 0 1 0 10 0 a 5 5 0 1 0 -10 0",
          "M 175 165 Q 200 185 225 165",
        ],
      },
    ],
  },
  {
    id: "house",
    name: { zh: "小房子", en: "House" },
    icon: "🏠",
    steps: [
      {
        hint: { zh: "先画一个正方形的墙", en: "Draw a square wall" },
        paths: ["M 130 160 L 270 160 L 270 250 L 130 250 Z"],
      },
      {
        hint: { zh: "上面盖个三角形屋顶", en: "Put a triangle roof on top" },
        paths: ["M 120 165 L 200 90 L 280 165 Z"],
      },
      {
        hint: { zh: "中间画门，左右加窗户", en: "Add a door and windows" },
        paths: [
          "M 185 250 L 185 200 L 215 200 L 215 250",
          "M 145 180 L 170 180 L 170 200 L 145 200 Z",
          "M 230 180 L 255 180 L 255 200 L 230 200 Z",
        ],
      },
      {
        hint: { zh: "屋顶冒点烟囱小烟", en: "A chimney with smoke" },
        paths: [
          "M 235 120 L 235 95 L 250 95 L 250 135",
          "M 240 80 Q 250 70 245 60 Q 240 50 250 40",
        ],
      },
    ],
  },
  {
    id: "flower",
    name: { zh: "小花", en: "Flower" },
    icon: "🌸",
    steps: [
      {
        hint: { zh: "中间画一个小圆", en: "Draw a small circle in the middle" },
        paths: ["M 200 140 m -18 0 a 18 18 0 1 0 36 0 a 18 18 0 1 0 -36 0"],
      },
      {
        hint: { zh: "围着画五片花瓣", en: "Draw five petals around it" },
        paths: [
          "M 200 100 m 0 -30 a 22 22 0 1 0 0.1 0 Z",
          "M 250 130 m 25 -15 a 22 22 0 1 0 0.1 0 Z",
          "M 235 180 m 15 25 a 22 22 0 1 0 0.1 0 Z",
          "M 165 180 m -15 25 a 22 22 0 1 0 0.1 0 Z",
          "M 150 130 m -25 -15 a 22 22 0 1 0 0.1 0 Z",
        ],
      },
      {
        hint: { zh: "画一根弯弯的茎", en: "Draw a curvy stem" },
        paths: ["M 200 175 Q 210 220 195 270"],
      },
      {
        hint: { zh: "两边加两片叶子", en: "Add two leaves" },
        paths: [
          "M 200 215 Q 165 200 145 215 Q 180 230 200 220",
          "M 200 245 Q 240 235 260 250 Q 225 265 200 250",
        ],
      },
    ],
  },
  {
    id: "tree",
    name: { zh: "大树", en: "Tree" },
    icon: "🌳",
    steps: [
      {
        hint: { zh: "画一个棕色树干", en: "Draw a brown trunk" },
        paths: ["M 185 200 L 185 270 L 215 270 L 215 200 Z"],
      },
      {
        hint: { zh: "上面画一团蓬松的树冠", en: "A fluffy treetop above" },
        paths: ["M 200 200 Q 130 200 130 150 Q 100 130 130 100 Q 140 60 200 70 Q 260 60 270 100 Q 300 130 270 150 Q 270 200 200 200 Z"],
      },
      {
        hint: { zh: "加几个圆圆的小苹果", en: "Add a few round apples" },
        paths: [
          "M 160 120 m -8 0 a 8 8 0 1 0 16 0 a 8 8 0 1 0 -16 0",
          "M 230 150 m -8 0 a 8 8 0 1 0 16 0 a 8 8 0 1 0 -16 0",
          "M 200 100 m -8 0 a 8 8 0 1 0 16 0 a 8 8 0 1 0 -16 0",
        ],
      },
      {
        hint: { zh: "草地上画点小草", en: "A few blades of grass" },
        paths: [
          "M 130 275 L 135 265",
          "M 145 275 L 150 265",
          "M 250 275 L 255 265",
          "M 265 275 L 270 265",
        ],
      },
    ],
  },
  {
    id: "apple",
    name: { zh: "苹果", en: "Apple" },
    icon: "🍎",
    steps: [
      {
        hint: { zh: "画一个圆圆的苹果", en: "Draw a round apple" },
        paths: ["M 200 175 m -65 0 a 65 70 0 1 0 130 0 a 65 70 0 1 0 -130 0"],
      },
      {
        hint: { zh: "上面凹一个小坑", en: "Make a dent on top" },
        paths: ["M 175 110 Q 200 130 225 110"],
      },
      {
        hint: { zh: "中间长出小柄", en: "Add a stem in the middle" },
        paths: ["M 200 120 L 200 90"],
      },
      {
        hint: { zh: "旁边加一片叶子", en: "And a leaf beside it" },
        paths: ["M 200 95 Q 230 80 240 100 Q 220 110 200 100"],
      },
    ],
  },
  {
    id: "rabbit",
    name: { zh: "兔子", en: "Rabbit" },
    icon: "🐰",
    steps: [
      {
        hint: { zh: "画一个圆脸", en: "Draw a round face" },
        paths: ["M 200 180 m -55 0 a 55 55 0 1 0 110 0 a 55 55 0 1 0 -110 0"],
      },
      {
        hint: { zh: "头顶画两个长耳朵", en: "Two long ears on top" },
        paths: [
          "M 175 130 Q 165 70 180 50 Q 195 70 190 130",
          "M 225 130 Q 215 70 220 50 Q 235 70 225 130",
        ],
      },
      {
        hint: { zh: "画眼睛和三瓣嘴", en: "Eyes and a Y-shaped mouth" },
        paths: [
          "M 180 170 m -5 0 a 5 5 0 1 0 10 0 a 5 5 0 1 0 -10 0",
          "M 220 170 m -5 0 a 5 5 0 1 0 10 0 a 5 5 0 1 0 -10 0",
          "M 200 190 L 200 200 M 200 200 Q 190 210 185 205 M 200 200 Q 210 210 215 205",
        ],
      },
    ],
  },
  {
    id: "boat",
    name: { zh: "小船", en: "Boat" },
    icon: "⛵",
    steps: [
      {
        hint: { zh: "画一个梯形船身", en: "A trapezoid hull" },
        paths: ["M 110 220 L 290 220 L 260 270 L 140 270 Z"],
      },
      {
        hint: { zh: "中间立一根桅杆", en: "A mast in the middle" },
        paths: ["M 200 220 L 200 90"],
      },
      {
        hint: { zh: "挂上三角形帆", en: "Hang a triangle sail" },
        paths: ["M 200 100 L 200 210 L 270 210 Z"],
      },
      {
        hint: { zh: "下面画几道海浪", en: "A few waves below" },
        paths: [
          "M 80 285 Q 110 275 140 285 Q 170 295 200 285 Q 230 275 260 285 Q 290 295 320 285",
        ],
      },
    ],
  },
];

window.I18N = I18N;
window.REACTIONS = REACTIONS;
window.TUTORIALS = TUTORIALS;
