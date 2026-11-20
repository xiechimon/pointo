# Pointo 宣传片

36 秒横屏宣传片（1920×1080，60fps），用于 Bilibili / TikTok / 抖音。无人声，纯音乐卡点。

- 画面：[Remotion](https://github.com/remotion-dev/remotion)（用 React 写视频）
- 配乐：`scripts/music.py` 用 numpy 合成的原创 120 BPM 电子乐，无第三方素材，可放心发布
- 字体：Noto Sans SC（`@fontsource/noto-sans-sc`）、JetBrains Mono

## 生成

```bash
npm install
./scripts/render.sh      # 生成配乐 → 渲染 → 响度标准化到 -14 LUFS → out/
npm run studio           # 在浏览器里逐帧预览、调动画
```

产物在 `out/`：`pointo-promo-1080p60.mp4`、封面 `cover-title.png` / `cover-end.png`。

## 结构

整片对齐配乐的小节网格：1 拍 = 30 帧，1 小节 = 120 帧（`src/timing.ts`）。

| 小节 | 镜头 | 文件 |
|---|---|---|
| 0–1 | 用文字跟 AI 描述 bug，AI 听不懂 →「说不清。」 | `scenes/Hook.tsx` |
| 2–3 | 冲击音：「别讲给 AI 听，指给它看。」→ 图标落地 | `scenes/Title.tsx` |
| 4–10 | ⌥⇧S 开始 → 边说边点 → 按住 ⇧ 画圈 → ⌥⇧S 结束 → 压成目录 | `scenes/Demo.tsx`、`scenes/Desktop.tsx` |
| 11–12 | 投递到项目，AI 读取并修复；支持的工具名卡点闪过 | `scenes/Deliver.tsx` |
| 13–14 | 本地中文转写；录音不上传 / 无需 API Key / 普通话·粤语·中英混说 | `scenes/Local.tsx` |
| 15–17 | 冲击音 → Logo、标语、GitHub 地址 | `scenes/End.tsx` |

所有画面文字都在 `src/copy.ts`，改文案只改这一个文件。

Remotion 对个人和 3 人以内的公司免费，更大的公司商用需要购买许可证（见 remotion.dev/license）。
