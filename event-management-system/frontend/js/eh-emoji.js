/* EventHub — Campus emoji / sticker / GIF picker (inspired by WA/IG, unique layout) */
(function (global) {
  'use strict';
  var RECENT_KEY = 'eh_emoji_recent_v3';
  var CATEGORIES = [
    ['recent','🕘','Recent',''],
    ['smileys','😀','Smileys','😀 😃 😄 😁 😆 😅 🤣 😂 🙂 🙃 😉 😊 😇 🥰 😍 🤩 😘 😗 😚 😙 🥲 😋 😛 😜 🤪 😝 🤑 🤗 🤭 🤫 🤔 🫡 🤐 🤨 😐 😑 😶 😏 😒 🙄 😬 😌 😔 😪 🤤 😴 😷 🤒 🤕 🤢 🤮 🤧 🥵 🥶 🥴 😵 🤯 🤠 🥳 🥸 😎 🤓 🧐 😕 😟 🙁 😮 😯 😲 😳 🥺 🥹 😦 😧 😨 😰 😥 😢 😭 😱 😖 😣 😞 😓 😩 😫 🥱 😤 😡 😠 🤬 😈 👿 💀 ☠️ 💩 🤡 👻 👽 🤖'],
    ['people','🫶','People','👋 🤚 🖐️ ✋ 🖖 👌 🤌 🤏 ✌️ 🤞 🤟 🤘 🤙 👈 👉 👆 👇 ☝️ 👍 👎 ✊ 👊 🤛 🤜 👏 🙌 🫶 👐 🤲 🤝 🙏 💪 🦾 🧠 👀 👁️ 👅 👄 💋 💘 💝 💖 💗 💓 💞 💕 💟 ❣️ 💔 ❤️ 🧡 💛 💚 💙 💜 🖤 🤍 🤎 💯'],
    ['campus','📚','Campus','📚 📖 📝 ✏️ 📎 📌 🎓 🎒 🧪 🧬 💻 🖥️ 📱 🗓️ ⏰ ☕ 🧋 🍕 🍔 🍜 🍱 🍪 🍩 🚌 🚲 🏃 🏀 ⚽ 🎯 🏆 🎉 🥳 🔥 💡 🧠 ✨ 🌟 💬 📣 🏫 🗺️'],
    ['animals','🐶','Animals','🐶 🐱 🐭 🐹 🐰 🦊 🐻 🐼 🐨 🐯 🦁 🐮 🐷 🐸 🐵 🐔 🐧 🐦 🐤 🦄 🐝 🦋 🐢 🐙 🐠 🐬 🐳 🌹 🌸 🌻 🌈 ☀️ 🌙 ⭐'],
    ['food','🍕','Food','🍎 🍌 🍉 🍇 🍓 🍒 🍑 🥭 🍍 🥥 🥝 🍅 🥑 🍟 🍔 🌭 🍕 🥪 🌮 🌯 🥗 🍝 🍜 🍣 🍱 🍙 🍘 🍨 🍩 🍪 🎂 🧁 🍫 🍬 🍭 ☕ 🧋 🍵 🥤'],
    ['symbols','💯','Symbols','❤️ 🧡 💛 💚 💙 💜 🖤 🤍 🤎 💔 ❣️ 💕 💞 💓 💗 💖 💘 💝 💟 ☮️ ✝️ ☪️ 🕉️ ☸️ ✡️ 🔯 🕎 ☯️ ☦️ 🛐 ⛎ ♈ ♉ ♊ ♋ ♌ ♍ ♎ ♏ ♐ ♑ ♒ ♓ 🆔 ⚛️ 🉑 ☢️ ☣️ 📴 📳 🈶 🈚 🈸 🈺 🈷️ ✴️ 🆚 💮 🉐 ㊙️ ㊗️ 🈴 🈵 🈹 🈲 🅰️ 🅱️ 🆎 🆑 🅾️ 🆘 ❌ ⭕ 🛑 ⛔ 🚫 💯 🔆 🔅 ⚠️ 🚸 🔱 ⚜️ 🔰 ♻️ ✅ 🈯 💹 ❇️ ✳️ ❎ 🌐 💠 Ⓜ️ 🌀 💤 🏧 🚾 ♿ 🅿️ 🛗 🛂 🛃 🛄 🛅 🚹 🚺 🚼 🚻 🚮 🎦 📶 🈁 🔣 ℹ️ 🔤 🔡 🔠 🆖 🆗 🆙 🆒 🆕 🆓']
  ];

  // Campus sticker packs (emoji compositions — no external assets needed)
  var STICKERS = [
    { id:'s1', label:'Good luck', render:'🍀📚' },
    { id:'s2', label:'Exam mode', render:'🧠⚡' },
    { id:'s3', label:'Coffee?', render:'☕💬' },
    { id:'s4', label:'On my way', render:'🏃‍♂️💨' },
    { id:'s5', label:'Library', render:'📖🤫' },
    { id:'s6', label:'Party', render:'🎉🥳' },
    { id:'s7', label:'Fire', render:'🔥💯' },
    { id:'s8', label:'Love it', render:'💜✨' },
    { id:'s9', label:'Sleepy', render:'😴💤' },
    { id:'s10', label:'Win', render:'🏆🎓' },
    { id:'s11', label:'Team up', render:'🤝🚀' },
    { id:'s12', label:'Idea', render:'💡🤯' }
  ];

  function loadRecent(){
    try { return JSON.parse(localStorage.getItem(RECENT_KEY) || '[]'); } catch(e){ return []; }
  }
  function saveRecent(ch){
    var list = loadRecent().filter(function(x){ return x !== ch; });
    list.unshift(ch);
    localStorage.setItem(RECENT_KEY, JSON.stringify(list.slice(0,48)));
  }

  function attach(opts){
    opts = opts || {};
    var button = opts.button;
    var onPick = opts.onPick || function(){};
    if(!button) return;

    // Avoid duplicate panels when chat re-renders
    var host = button.closest('.ehc-emoji-wrap') || button.parentElement || document.body;
    var existing = host.querySelector('.eh-emoji-panel');
    if(existing) existing.remove();
    // clone button to drop old listeners if re-wired
    if(button.dataset.ehEmojiBound === '1'){
      var fresh = button.cloneNode(true);
      button.parentNode.replaceChild(fresh, button);
      button = fresh;
      opts.button = fresh;
    }
    button.dataset.ehEmojiBound = '1';

    var wrap = document.createElement('div');
    wrap.className = 'eh-emoji-panel';
    wrap.hidden = true;
    wrap.innerHTML =
      '<div class="eh-emoji-head">' +
        '<div class="eh-emoji-tabs" role="tablist">' +
          '<button type="button" data-panel="emoji" class="on">Emoji</button>' +
          '<button type="button" data-panel="stickers">Stickers</button>' +
          '<button type="button" data-panel="gifs">GIFs</button>' +
        '</div>' +
        '<button type="button" class="eh-emoji-close" aria-label="Close">×</button>' +
      '</div>' +
      '<div class="eh-emoji-search"><input type="search" placeholder="Search emoji or GIFs…" aria-label="Search"></div>' +
      '<div class="eh-emoji-cats"></div>' +
      '<div class="eh-emoji-body"></div>';

    // Place panel near composer
    host.appendChild(wrap);

    var currentPanel = 'emoji';
    var currentCat = 'smileys';
    var body = wrap.querySelector('.eh-emoji-body');
    var cats = wrap.querySelector('.eh-emoji-cats');
    var search = wrap.querySelector('.eh-emoji-search input');
    var tabs = wrap.querySelector('.eh-emoji-tabs');

    function pick(value, meta){
      saveRecent(typeof value === 'string' && value.length <= 4 ? value : '');
      onPick(value, meta || { type:'emoji' });
    }

    function renderCats(){
      if(currentPanel !== 'emoji'){ cats.innerHTML = ''; cats.hidden = true; return; }
      cats.hidden = false;
      cats.innerHTML = CATEGORIES.map(function(c){
        return '<button type="button" data-cat="'+c[0]+'" class="'+(c[0]===currentCat?'on':'')+'" title="'+c[2]+'">'+c[1]+'</button>';
      }).join('');
    }

    function renderEmoji(){
      var q = (search.value || '').trim().toLowerCase();
      var arr = [];
      if(currentCat === 'recent'){
        arr = loadRecent();
      } else {
        var cat = CATEGORIES.find(function(c){ return c[0]===currentCat; }) || CATEGORIES[1];
        arr = (cat[3] || '').split(/\s+/).filter(Boolean);
      }
      if(q){
        arr = [];
        CATEGORIES.forEach(function(c){
          (c[3]||'').split(/\s+/).forEach(function(ch){ if(ch && (!q || c[2].toLowerCase().indexOf(q)>=0 || ch.indexOf(q)>=0)) arr.push(ch); });
        });
        // de-dupe
        arr = arr.filter(function(v,i,a){ return a.indexOf(v)===i; }).slice(0,120);
      }
      if(!arr.length){ body.innerHTML = '<div class="eh-emoji-empty">No emoji found</div>'; return; }
      var grid = document.createElement('div');
      grid.className = 'eh-emoji-grid';
      arr.forEach(function(ch){
        var b = document.createElement('button');
        b.type = 'button'; b.textContent = ch; b.title = ch;
        b.onclick = function(){ pick(ch, { type:'emoji' }); };
        grid.appendChild(b);
      });
      body.innerHTML = '';
      body.appendChild(grid);
    }

    function renderStickers(){
      var grid = document.createElement('div');
      grid.className = 'eh-sticker-grid';
      STICKERS.forEach(function(s){
        var b = document.createElement('button');
        b.type = 'button';
        b.className = 'eh-sticker';
        b.innerHTML = '<span class="eh-sticker-art">'+s.render+'</span><small>'+s.label+'</small>';
        b.onclick = function(){ pick(s.render, { type:'sticker', id:s.id, label:s.label }); };
        grid.appendChild(b);
      });
      body.innerHTML = '';
      body.appendChild(grid);
    }

    function renderGifs(){
      var q = (search.value || '').trim() || 'campus funny';
      body.innerHTML = '<div class="eh-emoji-empty">Loading GIFs…</div>';
      // Public demo Giphy key (rate-limited; fine for campus demo)
      var url = 'https://api.giphy.com/v1/gifs/search?api_key=dc6zaTOxFJmzC&limit=24&q=' + encodeURIComponent(q);
      fetch(url).then(function(r){ return r.json(); }).then(function(data){
        var list = (data && data.data) || [];
        if(!list.length){ body.innerHTML = '<div class="eh-emoji-empty">No GIFs found. Try another word.</div>'; return; }
        var grid = document.createElement('div');
        grid.className = 'eh-gif-grid';
        list.forEach(function(g){
          var imgUrl = g.images && (g.images.fixed_height_small || g.images.preview_gif || g.images.original);
          var src = imgUrl && imgUrl.url;
          if(!src) return;
          var b = document.createElement('button');
          b.type = 'button';
          b.className = 'eh-gif';
          b.innerHTML = '<img src="'+src+'" alt="" loading="lazy">';
          b.onclick = function(){
            var full = (g.images.original && g.images.original.url) || src;
            pick(full, { type:'gif', url: full });
            wrap.hidden = true;
            button.setAttribute('aria-expanded','false');
          };
          grid.appendChild(b);
        });
        body.innerHTML = '';
        body.appendChild(grid);
      }).catch(function(){
        body.innerHTML = '<div class="eh-emoji-empty">GIF search unavailable offline. Use emoji or stickers.</div>';
      });
    }

    function render(){
      renderCats();
      if(currentPanel === 'emoji') renderEmoji();
      else if(currentPanel === 'stickers') renderStickers();
      else renderGifs();
    }

    tabs.addEventListener('click', function(e){
      var b = e.target.closest('button[data-panel]');
      if(!b) return;
      currentPanel = b.dataset.panel;
      tabs.querySelectorAll('button').forEach(function(x){ x.classList.toggle('on', x===b); });
      search.placeholder = currentPanel === 'gifs' ? 'Search GIFs…' : 'Search emoji…';
      render();
    });
    cats.addEventListener('click', function(e){
      var b = e.target.closest('button[data-cat]');
      if(!b) return;
      currentCat = b.dataset.cat;
      render();
    });
    var searchTimer;
    search.addEventListener('input', function(){
      clearTimeout(searchTimer);
      searchTimer = setTimeout(render, currentPanel === 'gifs' ? 350 : 80);
    });
    wrap.querySelector('.eh-emoji-close').onclick = function(){
      wrap.hidden = true;
      button.setAttribute('aria-expanded','false');
    };
    button.addEventListener('click', function(e){
      e.stopPropagation();
      wrap.hidden = !wrap.hidden;
      button.setAttribute('aria-expanded', String(!wrap.hidden));
      if(!wrap.hidden){ render(); setTimeout(function(){ search.focus(); }, 20); }
    });
    document.addEventListener('click', function(e){
      if(!wrap.hidden && !wrap.contains(e.target) && e.target !== button){
        wrap.hidden = true;
        button.setAttribute('aria-expanded','false');
      }
    });
  }

  global.EHEmoji = { attach: attach, CATEGORIES: CATEGORIES, STICKERS: STICKERS };
})(window);
