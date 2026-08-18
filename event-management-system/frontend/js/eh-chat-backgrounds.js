/* EventHub — Campus Chat Background Studio.
   Backgrounds are account + conversation scoped and never replace avatar/theme data. */
(function(global){
  'use strict';

  const OPTIONS = [
    ['default','Default','Clean EventHub','ehc-bg-default'],
    ['aurora','Aurora Glow','Soft aurora','ehc-bg-aurora'],
    ['chrome','Y2K Chrome','Metal bubbles','ehc-bg-chrome'],
    ['cyber','Cyber Grid','Neon wireframe','ehc-bg-cyber'],
    ['iridescent','Iridescent','Liquid holographic','ehc-bg-iridescent'],
    ['pixel','Pixel Night','Lo-fi pixel vibe','ehc-bg-pixel'],
    ['terminal','Retro Terminal','Green hacker mode','ehc-bg-terminal'],
    ['vaporwave','Vaporwave','80s sunset grid','ehc-bg-vaporwave'],
    ['doodle','Doodle Bomb','Sticker/doodle feel','ehc-bg-doodle'],
    ['ocean','Ocean Mist','Cool blue waves','ehc-bg-ocean'],
    ['midnight','Midnight Stars','Dark starfield','ehc-bg-midnight'],
    ['sunset','Sunset Rush','Warm neon sunset','ehc-bg-sunset'],
    ['sakura','Sakura Pop','Soft pink confetti','ehc-bg-sakura'],
    ['blueprint','Blueprint','Campus-tech grid','ehc-bg-blueprint'],
    ['candy','Candy Glass','Pastel glass','ehc-bg-candy'],
    ['noir','Noir','Dark minimal','ehc-bg-noir'],
    ['velvet','Velvet Noir','Deep plum glow','ehc-bg-velvet'],
    ['roseglass','Rose Glass','Soft rose glass','ehc-bg-roseglass'],
    ['moonsea','Moonlit Sea','Calm deep water','ehc-bg-moonsea'],
    ['matcha','Matcha Haze','Muted green calm','ehc-bg-matcha'],
    ['cosmic','Cosmic Bloom','Violet nebula','ehc-bg-cosmic'],
    ['liquidchrome','Liquid Chrome','Polished silver','ehc-bg-liquidchrome'],
    ['softfocus','Soft Focus','Dreamy neutral','ehc-bg-softfocus'],
    ['neonrain','Neon Rain','Night city glow','ehc-bg-neonrain']
  ];

  /* Inline backgrounds are intentional: they beat the existing theme's
     !important stream background without modifying the theme system. */
  const STYLES = {
    default: '',
    aurora: 'radial-gradient(85% 70% at 100% 0%,rgba(108,92,231,.30),transparent 68%),radial-gradient(75% 60% at 0% 100%,rgba(20,184,166,.24),transparent 68%),linear-gradient(135deg,#f7f3ff,#eafaf8 55%,#fff8e8)',
    chrome: 'radial-gradient(circle at 18% 25%,#ffffff 0 3%,#aeb8c2 8%,#697582 15%,transparent 16%),radial-gradient(circle at 76% 66%,#ffffff 0 4%,#8b96a2 10%,#515c68 17%,transparent 18%),linear-gradient(135deg,#e9edf1,#707b87 42%,#fafbfc 56%,#596572 80%,#dce2e7)',
    cyber: 'linear-gradient(rgba(0,255,196,.10) 1px,transparent 1px),linear-gradient(90deg,rgba(132,92,255,.11) 1px,transparent 1px),radial-gradient(circle at 80% 10%,rgba(0,255,196,.22),transparent 30%),#080f1e',
    iridescent: 'radial-gradient(circle at 15% 20%,rgba(255,255,255,.48),transparent 24%),linear-gradient(125deg,#ffb7d8,#c7b6ff 28%,#a9eaff 50%,#b7f5d4 68%,#ffe5a7 84%,#ffb7d8)',
    pixel: 'linear-gradient(90deg,rgba(255,255,255,.05) 50%,transparent 50%),linear-gradient(rgba(255,255,255,.04) 50%,transparent 50%),linear-gradient(180deg,rgba(93,190,255,.2),transparent 50%,rgba(20,184,166,.15)),#16213e',
    terminal: 'repeating-linear-gradient(0deg,rgba(55,255,126,.09) 0,rgba(55,255,126,.09) 1px,transparent 1px,transparent 5px),linear-gradient(90deg,transparent 0 12%,rgba(55,255,126,.08) 12% 12.2%,transparent 12.2% 100%),#07110b',
    vaporwave: 'linear-gradient(rgba(255,255,255,.13) 1px,transparent 1px),linear-gradient(90deg,rgba(255,255,255,.13) 1px,transparent 1px),linear-gradient(180deg,#30206d 0 45%,#ed5fa8 46%,#ffb26b 65%,#26184f 66%)',
    doodle: 'radial-gradient(circle,#151c27 1.4px,transparent 1.5px),radial-gradient(circle,#ff5c8a 1.5px,transparent 1.6px),linear-gradient(28deg,transparent 45%,rgba(108,92,231,.13) 46% 54%,transparent 55%),#fff9ed',
    ocean: 'radial-gradient(circle at 20% 25%,rgba(255,255,255,.42),transparent 15%),radial-gradient(circle at 75% 65%,rgba(20,184,166,.25),transparent 23%),linear-gradient(145deg,#dff7ff,#9fd8ec 48%,#0f6685)',
    midnight: 'radial-gradient(circle,rgba(255,255,255,.55) 1px,transparent 1.4px),radial-gradient(circle,rgba(124,92,255,.45) 1px,transparent 1.4px),radial-gradient(circle at 50% 10%,rgba(124,92,255,.26),transparent 28%),#0b1220',
    sunset: 'radial-gradient(circle at 50% 95%,#ffcf6b 0 5%,transparent 6%),linear-gradient(180deg,#2b2059,#7148a9 42%,#ff7a72 68%,#ffd18a)',
    sakura: 'radial-gradient(circle at 18% 25%,rgba(255,92,138,.24) 0 5px,transparent 6px),radial-gradient(circle at 72% 35%,rgba(255,184,46,.2) 0 4px,transparent 5px),radial-gradient(circle at 44% 78%,rgba(124,92,255,.18) 0 5px,transparent 6px),#fff5fa',
    blueprint: 'linear-gradient(rgba(122,195,255,.14) 1px,transparent 1px),linear-gradient(90deg,rgba(122,195,255,.14) 1px,transparent 1px),linear-gradient(rgba(122,195,255,.05) 1px,transparent 1px),linear-gradient(90deg,rgba(122,195,255,.05) 1px,transparent 1px),#102b55',
    candy: 'radial-gradient(circle at 20% 20%,rgba(255,255,255,.65),transparent 20%),linear-gradient(135deg,#ffd3e4,#d9d2ff 40%,#bdf4ee 70%,#fff0b8)',
    noir: 'radial-gradient(circle at 30% 20%,rgba(255,255,255,.08),transparent 22%),linear-gradient(135deg,#0f1720,#1e293b 45%,#080b11)',
    velvet: 'radial-gradient(circle at 78% 18%,rgba(211,157,255,.25),transparent 25%),radial-gradient(circle at 20% 82%,rgba(255,94,148,.16),transparent 28%),linear-gradient(145deg,#100d18,#24152e 55%,#08090e)',
    roseglass: 'radial-gradient(circle at 18% 18%,rgba(255,255,255,.7),transparent 20%),radial-gradient(circle at 80% 70%,rgba(255,117,159,.2),transparent 30%),linear-gradient(135deg,#f8dce8,#f1d8e8 38%,#d9dcf8 72%,#f7efe7)',
    moonsea: 'radial-gradient(circle at 75% 15%,rgba(194,226,255,.3),transparent 24%),linear-gradient(160deg,#071426,#0d2b47 48%,#0b5964 100%)',
    matcha: 'radial-gradient(circle at 80% 15%,rgba(255,255,255,.48),transparent 25%),radial-gradient(circle at 20% 80%,rgba(112,185,131,.22),transparent 30%),linear-gradient(145deg,#eef6df,#d6e9cf 48%,#a9cfb4)',
    cosmic: 'radial-gradient(circle at 72% 22%,rgba(218,166,255,.5) 0 1px,transparent 2px),radial-gradient(circle at 25% 72%,rgba(120,191,255,.5) 0 1px,transparent 2px),radial-gradient(circle at 55% 45%,rgba(125,92,255,.42),transparent 30%),linear-gradient(145deg,#090b19,#19143a 55%,#0a1324)',
    liquidchrome: 'radial-gradient(ellipse at 20% 30%,#fff 0 4%,#b8c2cb 10%,transparent 18%),radial-gradient(ellipse at 78% 65%,#fff 0 5%,#7d8995 12%,transparent 20%),linear-gradient(135deg,#d7dde2,#6e7985 42%,#f7f9fb 55%,#626d78 80%,#cbd3da)',
    softfocus: 'radial-gradient(circle at 25% 25%,rgba(255,255,255,.75),transparent 28%),radial-gradient(circle at 75% 75%,rgba(197,188,255,.22),transparent 28%),linear-gradient(135deg,#f6f3ed,#e8e4df 52%,#dce8e6)',
    neonrain: 'linear-gradient(115deg,transparent 0 30%,rgba(86,228,255,.16) 31% 31.5%,transparent 32% 100%),radial-gradient(circle at 78% 18%,rgba(255,74,163,.25),transparent 22%),linear-gradient(145deg,#080d18,#111b2f 52%,#0c2231)'
  };

  const SIZES = {
    chrome:'', cyber:'28px 28px,28px 28px,100% 100%', iridescent:'220% 220%',
    pixel:'16px 16px,16px 16px,100% 100%', terminal:'100% 100%,100% 100%',
    vaporwave:'22px 22px,22px 22px,100% 100%', doodle:'31px 31px,47px 47px,73px 73px',
    midnight:'43px 43px,71px 71px,100% 100%', blueprint:'36px 36px,36px 36px,9px 9px,9px 9px', cosmic:'80px 80px,110px 110px,100% 100%'
  };

  const valid = id => OPTIONS.some(x => x[0] === id) ? id : 'default';

  function keyFor(userId, conversationId){
    return `eventhub.chat.background.${String(userId || 'guest')}.${String(conversationId || 'all')}`;
  }
  function current(userId, conversationId){
    try { return valid(localStorage.getItem(keyFor(userId, conversationId)) || 'default'); }
    catch(e) { return 'default'; }
  }
  function save(userId, conversationId, id){
    try { localStorage.setItem(keyFor(userId, conversationId), valid(id)); } catch(e) {}
  }

  function paintPreview(el, id){
    if(!el) return;
    const bg = STYLES[valid(id)] || '';
    el.style.background = bg || '#f4f7fb';
    const size = SIZES[valid(id)];
    if(size) el.style.backgroundSize = size;
  }

  function apply(app, stream, userId, id, conversationId){
    const bg = valid(id || current(userId, conversationId));
    if(app) app.dataset.chatBg = bg;
    if(stream){
      stream.dataset.chatBg = bg;
      /* Clear previous inline values before applying the new selection. */
      stream.style.removeProperty('background');
      stream.style.removeProperty('background-image');
      stream.style.removeProperty('background-color');
      stream.style.removeProperty('background-size');
      if(bg !== 'default'){
        stream.style.setProperty('background', STYLES[bg], 'important');
        if(SIZES[bg]) stream.style.setProperty('background-size', SIZES[bg], 'important');
      }
    }
    save(userId, conversationId, bg);
    return bg;
  }

  function open(opts){
    opts = opts || {};
    const userId = opts.userId || 'guest';
    const conversationId = opts.conversationId || 'all';
    const app = opts.app || document.getElementById('chatApp');
    const stream = opts.stream || document.getElementById('stream');
    let selected = current(userId, conversationId);

    const scrim = document.createElement('div');
    scrim.className = 'ehc-bg-studio-scrim';
    scrim.innerHTML = `<section class="ehc-bg-studio" role="dialog" aria-modal="true" aria-label="Choose chat background">
      <header><div><span class="ehc-bg-kicker">CAMPUS CHAT</span><h3>Make your chat feel like you ✦</h3><p>Pick a background for this chat. Your avatar, messages, profile and chat theme stay untouched.</p></div><button class="ehc-bg-close" type="button" aria-label="Close">×</button></header>
      <div class="ehc-bg-grid">${OPTIONS.map(o => `<button type="button" class="ehc-bg-choice ${o[0]===selected?'on':''}" data-bg="${o[0]}"><span class="ehc-bg-preview ${o[3]}"></span><strong>${o[1]}</strong><small>${o[2]}</small></button>`).join('')}</div>
      <footer><button type="button" class="ehc-bg-reset">Reset to default</button><button type="button" class="ehc-bg-done">Done</button></footer>
    </section>`;
    document.body.appendChild(scrim);

    scrim.querySelectorAll('[data-bg]').forEach(b => paintPreview(b.querySelector('.ehc-bg-preview'), b.dataset.bg));

    const paint = () => {
      scrim.querySelectorAll('[data-bg]').forEach(b => {
        b.classList.toggle('on', b.dataset.bg === selected);
      });
    };
    const close = () => { scrim.remove(); document.removeEventListener('keydown', key); };
    const key = e => { if(e.key === 'Escape') close(); };
    const change = id => {
      selected = valid(id);
      apply(app, stream, userId, selected, conversationId);
      paint();
      if(typeof opts.onChange === 'function') opts.onChange(selected);
    };

    scrim.addEventListener('click', e => { if(e.target === scrim) close(); });
    scrim.querySelector('.ehc-bg-close').onclick = close;
    scrim.querySelector('.ehc-bg-done').onclick = close;
    scrim.querySelector('.ehc-bg-reset').onclick = () => change('default');
    scrim.querySelectorAll('[data-bg]').forEach(b => b.onclick = () => change(b.dataset.bg));
    document.addEventListener('keydown', key);
  }

  global.EHChatBackgrounds = { options: OPTIONS, current, apply, open, paintPreview };
})(window);
