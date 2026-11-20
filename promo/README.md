# Pointo 宣传片

36 秒横屏宣传片（1920×1080，60fps），用于 Bilibili / TikTok / 抖音。无人声，按配乐节拍剪辑。

用到的开源项目：

- [Remotion](https://github.com/remotion-dev/remotion)：用 React 写画面；`@remotion/motion-blur` 做快动作的运动模糊
- [huashu-motion](https://github.com/alchaincyf/huashu-motion)（MIT）：配乐和音效。`scripts/score.py` 写出 ABC 乐谱（Funk / Disco，120 BPM，D 多利亚）和 48 个音效点，`om sound` 按画面标记演奏、混音到 -14 LUFS；`om qa` 检查成片（单帧闪烁、静止时长、每秒运动量）
- 方法参考：[video-shotcraft](https://github.com/Vincentwei1021/video-shotcraft) 的审美准则、huashu-motion 的 punch-up / colour 文档
- 字体：Noto Sans SC（`@fontsource/noto-sans-sc`）、Anton、Caveat、Inter（OFL，见 `public/fonts/`）、JetBrains Mono

## 生成

```bash
npm install
npx om samples build     # 可选：一次性下载真实乐器采样（CC0/CC-BY）；不装则用合成音色
./scripts/samples.sh     # 同上，适用于访问不了 api.github.com 的网络（用 git 列文件）
./scripts/render.sh      # 作曲 → 渲染 → 响度标准化 → out/
npx om qa out/pointo-promo-1080p60.mp4
npm run studio           # 在浏览器里逐帧预览
```

产物在 `out/`：`pointo-promo-1080p60.mp4`、封面 `cover-title.png` / `cover-end.png`。

## 视觉规范

`src/ui.tsx`：纸白 `#EEEEEC` 和墨黑 `#0D0D0F` 两个中性色，加两个各有含义的颜色：朱红 `#FF3B2F` 代表人的红笔标注，丁香紫 `#C4B5FF` 代表 AI 那一侧。底色按节拍整屏切换（开场词组、工具名、三条卖点）。标题用思源黑体 900、Anton 窄体大字，手写批注用 Caveat。要读的字幕不小于 56px。

## 结构

整片对齐配乐的小节网格：1 拍 = 30 帧，1 小节 = 120 帧（`src/timing.ts`）。

| 小节 | 镜头 | 文件 |
|---|---|---|
| 0–1 | 含糊的说法逐拍砸出、越切越快，堆成一墙；AI 在紫底上问「你到底指的是哪个？」 | `scenes/Hook.tsx` |
| 2–3 | 红底冲击：「指给它看。」，黑笔圈出「它看」；POINTO 字标亮相 | `scenes/Title.tsx` |
| 4–10 | 悬浮屏幕：⌥⇧S → 边说边点 → 按住 ⇧ 标注；每个关键帧剥离成切片堆到后方，镜头环绕；⌥⇧S → 切片排成总览图，文件爆炸展开 | `scenes/Demo.tsx`、`scenes/Desktop.tsx` |
| 11–12 | 紫底：投递到项目，AI 读取并修复；工具名按八分音符整屏换色 | `scenes/Deliver.tsx` |
| 13–14 | 黑底停顿：3D 环形声波变成文字；三条卖点逐拍换色砸出 | `scenes/Local.tsx` |
| 15–17 | 高潮：全片元素从四面飞来围住字标（“发布会合影”）、标语、下载按钮 | `scenes/End.tsx` |

所有画面文字都在 `src/copy.ts`，改文案只改这一个文件。

Remotion 对个人和 3 人以内的公司免费，更大的公司商用需要购买许可证（见 remotion.dev/license）。
