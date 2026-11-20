# Pointo 宣传片

36 秒横屏宣传片（1920×1080，60fps），用于 Bilibili / TikTok / 抖音。无人声，纯音乐卡点。

- 画面：[Remotion](https://github.com/remotion-dev/remotion)（用 React 写视频）
- 配乐：`scripts/music.py` 用 numpy 合成的原创 120 BPM 电子乐，无第三方素材，可放心发布
- 字体：Noto Sans SC（`@fontsource/noto-sans-sc`）、JetBrains Mono

## 视觉规范

参考 Linear、Apple、Cursor、Vercel 官网的克制风格，加上发布片常用的镜头语言（`src/ui.tsx`）：

- 近黑 `#08090B` 加轻微胶片颗粒，蓝 / 红两道柔光；全片的视觉母题是 Pointo 的红色笔迹 `#F23B34`
- 标题 500–600 字重、收紧字距、白 + 灰双色；文字遮罩逐行上滑并去模糊
- 真 3D（CSS `preserve-3d`）：开场穿过含糊说法的字云（景深模糊）、悬浮屏幕带地面倒影、关键帧切片从屏幕剥离后堆叠、文件爆炸视图、环形声波
- 快动作加运动模糊（`@remotion/motion-blur`：红笔横扫、工具名）

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
| 0–1 | 镜头穿过一片含糊的说法（“左边那个”“这里”…），AI 不知道你说的是哪里 | `scenes/Hook.tsx` |
| 2–3 | 红笔横扫成圈，「指给它看。」；镜头穿过圆圈，图标带扫光亮相 | `scenes/Title.tsx` |
| 4–10 | 悬浮屏幕：⌥⇧S → 边说边点 → 按住 ⇧ 标注；每个关键帧剥离成切片堆到后方，镜头环绕；⌥⇧S → 切片排成总览图，文件爆炸展开 | `scenes/Demo.tsx`、`scenes/Desktop.tsx` |
| 11–12 | 投递到项目，AI 读取并修复；工具名整屏大字按八分音符切换 | `scenes/Deliver.tsx` |
| 13–14 | 3D 环形声波变成文字；三条卖点逐拍砸出 | `scenes/Local.tsx` |
| 15–17 | Logo、标语、下载按钮、GitHub 地址 | `scenes/End.tsx` |

所有画面文字都在 `src/copy.ts`，改文案只改这一个文件。

Remotion 对个人和 3 人以内的公司免费，更大的公司商用需要购买许可证（见 remotion.dev/license）。
