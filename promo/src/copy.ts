// Every on-screen string lives here, so the font warm-up can load the glyphs
// for all of them before the first frame is captured (see FontWarmup).
export const COPY = {
  chapters: ['问题', 'Pointo', '录制', '整理', '投递', '本地转写'],
  hook: {
    phrases: ['左边那个', '上面那个按钮', '这里', '不对，是下面那个', '那个灰色的', '就是那块', '旁边那个图标', '点了没反应', '你懂我意思吧', '第二个……还是第三个', '右上角那里', '这个地方', '那一行', '刚才那个'],
    lead: '你跟 AI 说……',
    line: 'AI 不知道你说的「这里」是哪里。',
  },
  title: {
    pre: '别讲给 AI 听，',
    main: '指给它看。',
    sub: 'macOS · Windows · 开源免费',
  },
  demo: {
    app: 'Acme 控制台',
    url: 'localhost:3000/settings',
    nav: ['概览', '项目', '成员', '账单', '设置'],
    title: '账户设置',
    subtitle: '管理你的个人资料和通知偏好',
    rows: [
      {k: '名称', v: 'Kit Chen'},
      {k: '邮箱', v: 'kit@acme.dev'},
      {k: '时区', v: '(UTC+08:00) 上海'},
      {k: '邮件通知', v: ''},
    ],
    cancel: '取消',
    save: '保存更改',
    rec: '录制中',
    working: '整理中',
    done: '已复制 · 3 个关键帧',
    hudStart: '开始录制',
    hudStop: '结束录制',
    captions: [
      {from: 160, ts: '0:01', text: '这个保存按钮'},
      {from: 255, ts: '0:02', text: '这个保存按钮，点了没反应'},
      {from: 384, ts: '0:04', text: '也没有提示，应该在右上角弹出来'},
    ],
    points: [
      {k: '说', v: '语音转成带时间的文字'},
      {k: '点', v: '记录点击位置与界面元素'},
      {k: '画', v: '按住 ⇧ 画红色标注'},
    ],
    slices: ['0:02  点击「保存更改」', '0:04  圈出按钮', '0:05  框出右上角'],
    quote: '“这个保存按钮，点了没反应”',
    files: [
      {name: 'contact-sheet.png', note: '总览图'},
      {name: 'summary.md', note: '转写 + 操作'},
      {name: 'pointo.json', note: '清单'},
      {name: 'frames/', note: '关键帧'},
    ],
    compileA: '一段录屏，',
    compileB: '压成 AI 一眼能读懂的记录。',
    tree: [
      'pointo-1794650000000.pointo/',
      '├─ contact-sheet.png',
      '├─ frames/',
      '├─ summary.md',
      '├─ pointo.json',
      '├─ recording.mp4',
      '└─ audio.wav',
    ],
    summary: [
      '## 1 · 0:02  点击「保存更改」',
      '“这个保存按钮，点了没反应”',
      '## 2 · 0:04  标注：圈出按钮',
      '## 3 · 0:05  标注：右上角',
      '“也没有提示，应该在右上角弹出来”',
    ],
  },
  deliver: {
    headA: '自动送进',
    headB: '你正在开发的项目。',
    folders: ['my-app', '.pointo', 'captures', 'pointo-1794650000000'],
    latest: 'latest',
    toast: '已发送到 my-app',
    termTitle: 'my-app — zsh',
    prompt: '看一下 .pointo/latest，修好它',
    lines: [
      {t: '读取 contact-sheet.png、summary.md', c: 'dim'},
      {t: '#1  点击「保存更改」没有反应', c: 'txt'},
      {t: '#3  右上角缺少保存成功提示', c: 'txt'},
      {t: '修改 src/settings/Form.tsx', c: 'dim'},
      {t: '+ 绑定 onSubmit，保存后显示提示', c: 'add'},
      {t: '已修复', c: 'ok'},
    ],
    toolsHead: '适用于任何能读本地文件的 AI 编程工具',
    tools: ['Claude Code', 'Codex', 'Cursor', 'Gemini CLI', 'Qwen Code'],
  },
  local: {
    headA: '语音在本机转写。',
    headB: '录音不上传，也不需要 API Key。',
    spec: 'QWEN3-ASR 0.6B · ON-DEVICE',
    heard: '这个保存按钮，点了没反应',
    facts: [
      {k: '01', v: '普通话、粤语、中英混说'},
      {k: '02', v: '录音不离开你的电脑'},
      {k: '03', v: '免账号，免费'},
    ],
  },
  end: {
    name: 'Pointo',
    tagA: '指给 AI 看，',
    tagB: '而不是讲给它听。',
    mac: '下载 macOS 版',
    win: 'Windows 预览版',
    url: 'github.com/xiechimon/pointo',
    keys: '⌥⇧S 开始 · 按住 ⇧ 画 · 再按 ⌥⇧S 结束',
  },
};

const collect = (v: unknown): string =>
  typeof v === 'string' ? v : typeof v === 'object' && v ? Object.values(v).map(collect).join('') : '';

export const ALL_TEXT = Array.from(new Set(collect(COPY) + '0123456789:·…“”「」，。？')).join('');
