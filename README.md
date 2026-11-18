# game-sites · 游戏合集

网页小游戏，用 GitHub Pages 发布，点开就能玩，手机、平板、电脑都可以。

在线入口：https://damizhoufang.github.io/game-sites/

| 游戏 | 在线试玩 | 简介 | 操作 |
| --- | --- | --- | --- |
| 小羊闯年关 | [xiaoyang/](https://damizhoufang.github.io/game-sites/xiaoyang/) | 春节主题横版闯关，三关：腊月集市、除夕之夜、决战年兽 | ← → 移动，空格跳跃，Shift 或 J 奔跑 / 扔鞭炮，P 暂停，M 静音；手机有触屏手柄，也支持游戏手柄 |
| 热力追逐 | [heat-chase/](https://damizhoufang.github.io/game-sites/heat-chase/) | 第一人称三轨道跑酷：涂鸦企鹅被警卫和小狗追着狂奔；PC 版与手机版，手机可添加到主屏幕离线玩 | 电脑：← → 或 A D 换道，↑ / W / 空格跳，↓ / S 翻滚，Shift / E 滑板，V 视角，P 暂停；手机：左右上下滑动，双击放滑板 |
| 团子叠叠乐 | [dango-stack/](https://damizhoufang.github.io/game-sites/dango-stack/) | 手机上玩的卡通方块消除，七种方块是七只会眨眼、睡觉、冒冷汗的团子；可添加到主屏幕离线玩 | 手机：左右滑移动，轻点旋转，下滑加速，快速下划直接落地，上滑暂存；电脑：← → 移动，↑ / X 旋转，↓ 加速，空格落地，C 暂存，P 暂停 |

## 目录

```
index.html      游戏合集首页
xiaoyang/       小羊闯年关（单个 HTML 文件，不依赖外部资源）
dango-stack/    团子叠叠乐（单个 index.html，另有添加到主屏幕用的 manifest、图标与离线缓存 sw.js；详见其 README）
heat-chase/     热力追逐（index.html 选择版本，pc/、mobile/ 为单文件成品，src/ 为源码，node build.js 重新生成；详见其 README）
.nojekyll       让 GitHub Pages 原样发布文件
```

每个游戏放在自己的文件夹里，入口是该文件夹下的 `index.html`；新增游戏时，在首页 `index.html` 和本表各加一项。

## 反馈

遇到问题或有建议，请到 [Issues](https://github.com/damizhoufang/game-sites/issues/new/choose) 按模板提交：卡关、报错、显示或声音不对用「游戏缺陷反馈」，难度、手感、画面、音乐方面的意见用「试玩体验建议」。帮忙试玩的 AI（如 Grok 维护 bot）也按这两个模板提交，标题里写上游戏名。
