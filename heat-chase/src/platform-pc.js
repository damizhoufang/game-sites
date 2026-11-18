/* ============ PC 版：键盘操作、横屏宽画面 ============ */
const PLATFORM = {
  id: 'pc', label: 'PC 版', viewDist: 150, maxDpr: 2, swipePx: 34, boardKey: 'Shift',
  hints: {
    jump: '按 <kbd>↑</kbd> / <kbd>W</kbd> / <kbd>空格</kbd> <b>跳跃</b>',
    roll: '按 <kbd>↓</kbd> / <kbd>S</kbd> <b>下蹲翻滚</b>',
    lane: '按 <kbd>←</kbd> <kbd>→</kbd> <b>切换车道</b>',
    board: '按 <kbd>Shift</kbd> 或双击鼠标 <b>放出滑板</b>',
  },
  controls: [
    ['← → / A D', '切换车道'],
    ['↑ / W / 空格', '跳跃'],
    ['↓ / S', '下蹲翻滚（空中按可急速落地）'],
    ['Shift / E / 双击鼠标', '放出滑板（护盾）'],
    ['V', '切换第一人称 / 追尾视角'],
    ['P / Esc', '暂停'],
    ['M', '静音'],
    ['按住鼠标拖动', '也可以像手机一样滑动操作'],
  ],
  keyBar: '<kbd>←</kbd><kbd>→</kbd> 换道　<kbd>↑</kbd> 跳　<kbd>↓</kbd> 滚　<kbd>Shift</kbd> 滑板　<kbd>V</kbd> 视角　<kbd>P</kbd> 暂停',
  menuFoot: '按 <kbd>Enter</kbd> 开始 · 全程离线可玩',
};
