// Every on-screen string lives here, so the font warm-up can load the glyphs
// for all of them before the first frame is captured (see FontWarmup).
export const COPY = {
  hook: {
    user: '上面那个按钮……不对，左边那个，点了没反应',
    ai: '抱歉，你指的是哪个按钮？',
    placeholder: '给 AI 发消息…',
    punch: '说不清。',
    lead: '你跟 AI 描述一个界面 bug……',
  },
  title: {
    l1a: '别',
    l1b: '讲给 AI 听',
    l1c: '，',
    l2: '指给它看。',
    sub: 'macOS · Windows · 免费开源',
  },
  demo: {
    url: 'localhost:3000/login',
    brand: 'Acme',
    welcome: '欢迎回来',
    welcomeSub: '登录你的 Acme 账号',
    email: '邮箱',
    emailValue: 'kit@acme.dev',
    password: '密码',
    button: '登录',
    forgot: '忘记密码？',
    rec: '录制中',
    working: '整理中…',
    done: '已复制 · 3 个关键帧',
    captions: [
      {from: 160, ts: '0:01', text: '这个登录按钮'},
      {from: 255, ts: '0:02', text: '这个登录按钮，点了没反应'},
      {from: 380, ts: '0:04', text: '而且错误提示也没出来'},
    ],
    chips: [
      {k: '说', v: '带时间的中文转写'},
      {k: '点', v: '点击位置与元素'},
      {k: '画', v: '按住 ⇧ 画红色标注'},
    ],
    compileTitle: '压成 AI 一眼能读懂的一份记录',
    tree: [
      'pointo-1794650000000.pointo/',
      '├─ contact-sheet.png   总览图',
      '├─ frames/             关键帧',
      '├─ summary.md          转写 + 操作',
      '├─ pointo.json         清单',
      '├─ recording.mp4',
      '└─ audio.wav',
    ],
    summary: [
      '## 1 · 0:02',
      '点击「登录」按钮',
      '“这个登录按钮，点了没反应”',
      '## 2 · 0:04  标注：圈出按钮',
      '## 3 · 0:05  标注：箭头指向空白处',
      '“而且错误提示也没出来”',
    ],
  },
  deliver: {
    project: 'my-app',
    folders: ['my-app', '.pointo', 'captures', 'pointo-1794650000000'],
    latest: 'latest →',
    toast: '已发送到 my-app',
    termTitle: '~/my-app',
    prompt: '看一下 .pointo/latest，修好它',
    lines: [
      {t: '⏺ 读取 contact-sheet.png · summary.md', c: 'dim'},
      {t: '  #1 0:02 点击「登录」没有反应', c: 'txt'},
      {t: '  #3 0:05 箭头：缺少错误提示', c: 'txt'},
      {t: '⏺ 修改 src/LoginForm.tsx', c: 'dim'},
      {t: '  + 绑定 onSubmit，失败时显示错误信息', c: 'add'},
      {t: '✓ 已修复，刷新页面试试', c: 'ok'},
    ],
    toolsHead: '能读本地文件的 AI 编程工具，都能直接用',
    tools: ['Claude Code', 'Codex', 'Cursor', 'Gemini CLI', 'Qwen Code'],
  },
  local: {
    head: '本地中文语音转写',
    sub: 'Qwen3-ASR 0.6B · 在你的电脑上运行',
    heard: '这个登录按钮，点了没反应',
    facts: ['录音不上传', '无需 API Key', '普通话 · 粤语 · 中英混说'],
  },
  end: {
    name: 'Pointo',
    tagA: '指给 AI 看，而不是',
    tagB: '讲给它听',
    chips: ['免费开源 · MIT', 'macOS', 'Windows 预览版'],
    url: 'github.com/xiechimon/pointo',
    keys: '⌥⇧S 开始 · 按住 ⇧ 画 · 再按 ⌥⇧S 结束',
  },
};

const collect = (v: unknown): string =>
  typeof v === 'string' ? v : typeof v === 'object' && v ? Object.values(v).map(collect).join('') : '';

export const ALL_TEXT = Array.from(new Set(collect(COPY) + '0123456789:·…“”「」，。？')).join('');
