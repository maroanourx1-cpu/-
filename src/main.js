// نقطة بداية اللعبة
import './style.css';
import { Game } from './game/game.js';

const game = new Game(document.getElementById('c'));
window.__game = game; // للاختبار والتصحيح
game.init().catch((e) => {
  console.error(e);
  const m = document.getElementById('loadmsg');
  if (m) m.textContent = 'حصل خطأ أثناء التحميل: ' + (e && e.message ? e.message : e) + ' — جرّب تحديث الصفحة (F5)';
});
