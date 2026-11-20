# Pointo 宣传片

36 秒横屏宣传片（1920×1080，60fps），用于 Bilibili / TikTok / 抖音。无人声，纯音乐卡点。

- 画面：[Remotion](https://github.com/remotion-dev/remotion)（用 React 写视频）
- 配乐：`scripts/music.py` 用 numpy 合成的原创 120 BPM 电子乐，无第三方素材，可放心发布
- 字体：Noto Sans SC（`@fontsource/noto-sans-sc`）、JetBrains Mono

## 视觉规范

参考 Linear、Apple、Cursor、Vercel 官网的克制风格（`src/ui.tsx`）：

- 近黑 `#08090B` 为主，「整理」一屏换暖白纸色做对比；全片只有一个强调色：Pointo 的红色笔迹 `#F23B34`
- 标题用 500 字重、收紧字距、白 + 灰双色两行；左上角等宽小字章节标签
- 文字用遮罩逐行上滑并去模糊；产品界面是主角：高保真窗口、细边框、多层柔和阴影、3D 透视落定
- 轻微胶片颗粒（`public/grain.png`）

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
| 0–1 | 用文字跟 AI 描述 bug，AI 没听懂，红笔圈出「说不清」 | `scenes/Hook.tsx` |
| 2–3 | 「别讲给 AI 听，指给它看。」→ 图标从模糊中浮现 | `scenes/Title.tsx` |
| 4–10 | ⌥⇧S 开始 → 边说边点「保存更改」→ 按住 ⇧ 圈出按钮、框出右上角 → ⌥⇧S 结束 → 压成目录 | `scenes/Demo.tsx`、`scenes/Desktop.tsx` |
| 11–12 | 投递到项目，AI 读取并修复；支持的工具名按八分音符依次点亮 | `scenes/Deliver.tsx` |
| 13–14 | 本地中文转写：声波变文字；三条卖点卡点出现 | `scenes/Local.tsx` |
| 15–17 | Logo、标语、下载按钮、GitHub 地址 | `scenes/End.tsx` |

所有画面文字都在 `src/copy.ts`，改文案只改这一个文件。

Remotion 对个人和 3 人以内的公司免费，更大的公司商用需要购买许可证（见 remotion.dev/license）。
