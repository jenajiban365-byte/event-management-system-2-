/* EventHub — V65+ avatar studio (layout matches modern chat-profile design) */
(function (global) {
  'use strict';

  const AVATARS = [
    ['kairo','Kairo','Warm casual'],
    ['sora','Sora','Soft girl'],
    ['nyx','Nyx','Dark anime'],
    ['aria','Aria','Iridescent'],
    ['zane','Zane','Streetwear'],
    ['mira','Mira','Cherry blossom'],
    ['rei','Rei','Mono tone'],
    ['nova','Nova','Starlight'],
    ['juno','Juno','Ocean breeze'],
    ['axel','Axel','Racing club'],
    ['lyra','Lyra','Lavender night'],
    ['kai','Kai','Ocean blue'],
    ['aya','Aya','Rose haze'],
    ['neo','Neo','Terminal green'],
    ['skye','Skye','Cloud blue'],
    ['riven','Riven','Velvet red'],
    ['eden','Eden','Sage calm'],
    ['yuki','Yuki','Snow chrome'],
    ['zion','Zion','Electric violet'],
    ['luna','Luna','Moon silver'],
    ['rio','Rio','Sunset street'],
    ['sage','Sage','Matcha studio'],
    ['vex','Vex','Redline cyber'],
    ['mika','Mika','Pastel chrome'],
    ['ivy','Ivy','Urban black']
  ];

  /* Neon photorealistic characters from avatar-sheet (local assets). */
  const ASSET_ROOT = 'assets/chat-avatars-modern/';
  const esc = v => String(v || '').replace(/[&<>'"]/g, c => ({
    '&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'
  }[c]));
  const find = id => AVATARS.find(a => a[0] === id) || AVATARS[0];
  // Older EventHub versions used a different (color/theme-based) avatar id
  // set — e.g. "skater" was valid there. Since the character art set was
  // redesigned, an id like that no longer matches anything in AVATARS, and
  // building a URL straight from an unvalidated id points at a file that
  // was never generated (repeated 404s, one per rendered avatar). Routing
  // every lookup through find() first guarantees the URL always resolves
  // to a real, current avatar image instead of a stale/unknown id.
  const dataUrl = id => ASSET_ROOT + encodeURIComponent(find(id)[0]) + '.webp';
  const art = id => `<img src="${esc(dataUrl(id))}" alt="" loading="lazy" decoding="async">`;
  const getSaved = () => {
    try { return String(global.Session?.getUser?.()?.chatAvatarId || ''); }
    catch (e) { return ''; }
  };

  function open(opts) {
    opts = opts || {};
    let current = global.Session?.getUser?.()?.chatAvatarId || '';
    if (!find(current) || !current) current = AVATARS[0][0];

    const user = global.Session?.getUser?.() || {};
    const displayName = user.name || user.fullName || 'Student';
    let statusText = user.chatStatus || 'Coding. Coffee. Campus. ☕';
    let mode = 'avatar'; // avatar | upload
    let uploadDataUrl = '';

    const scrim = document.createElement('div');
    scrim.className = 'eh-avatar-gallery-scrim eh-avatar-studio-v66';
    scrim.innerHTML = `
      <section class="eh-avatar-gallery eh-studio-shell" role="dialog" aria-modal="true" aria-label="Choose your chat profile">
        <div class="eh-studio-main">
          <header class="eh-studio-header">
            <div>
              <h2>Choose your chat profile</h2>
              <p>Pick an avatar or upload your own photo</p>
            </div>
            <button class="eh-avatar-close" type="button" aria-label="Close">×</button>
          </header>

          <div class="eh-studio-tabs">
            <button type="button" class="eh-studio-tab" data-mode="upload" id="ehTabUpload">
              <span class="eh-studio-tab-icon eh-studio-tab-icon--upload">↑</span>
              <span>
                <strong>Upload Photo</strong>
                <small>Use your own photo</small>
              </span>
            </button>
            <button type="button" class="eh-studio-tab on" data-mode="avatar" id="ehTabAvatar">
              <span class="eh-studio-tab-icon eh-studio-tab-icon--avatar">✦</span>
              <span>
                <strong>Choose Avatar</strong>
                <small>Pick from our collection</small>
              </span>
              <i class="eh-studio-tab-check" aria-hidden="true">✓</i>
            </button>
          </div>
          <input type="file" id="ehAvatarFile" accept="image/*" hidden>

          <div class="eh-studio-grid-label">Select an avatar</div>
          <div class="eh-avatar-grid eh-studio-grid" aria-label="Avatar choices">
            ${AVATARS.map(a => `
              <button type="button" class="eh-avatar-choice ${a[0] === current ? 'on' : ''}" data-avatar="${esc(a[0])}" aria-pressed="${a[0] === current}" title="${esc(a[1])}">
                <span class="eh-avatar-art">${art(a[0])}</span>
                <i class="eh-avatar-check" aria-hidden="true">✓</i>
              </button>`).join('')}
          </div>

          <div class="eh-studio-privacy-foot">
            <span>🔒</span>
            <span>Your avatar is only visible in Campus Chat and not on your public profile.</span>
          </div>
        </div>

        <aside class="eh-studio-preview">
          <div class="eh-studio-preview-title">Profile preview</div>
          <div class="eh-studio-preview-avatar-wrap">
            <div class="eh-studio-preview-avatar" id="ehAvatarPreview">${art(current)}</div>
            <button type="button" class="eh-studio-camera-btn" id="ehCameraBtn" title="Upload photo">📷</button>
          </div>
          <div class="eh-studio-online"><span class="eh-studio-dot"></span> Online</div>

          <label class="eh-studio-field">
            <span>Name</span>
            <input type="text" id="ehPreviewName" value="${esc(displayName)}" maxlength="40">
          </label>
          <label class="eh-studio-field">
            <span>Status</span>
            <input type="text" id="ehPreviewStatus" value="${esc(statusText)}" maxlength="60" placeholder="Coding. Coffee. Campus. ☕">
          </label>

          <button class="eh-avatar-save eh-studio-save" type="button" id="ehAvatarSave">Save Profile</button>
          <p class="eh-studio-save-hint">Changes will update in chat immediately</p>

          <div class="eh-studio-privacy-card">
            <strong>🛡 Your Privacy Matters</strong>
            <p>Your chat profile is separate from your public profile and is only visible to campus chat users.</p>
          </div>
        </aside>
      </section>`;

    document.body.appendChild(scrim);
    const preview = scrim.querySelector('#ehAvatarPreview');
    const fileInput = scrim.querySelector('#ehAvatarFile');
    const tabUpload = scrim.querySelector('#ehTabUpload');
    const tabAvatar = scrim.querySelector('#ehTabAvatar');

    function setMode(m) {
      mode = m;
      tabUpload.classList.toggle('on', m === 'upload');
      tabAvatar.classList.toggle('on', m === 'avatar');
    }

    function paint() {
      if (mode === 'upload' && uploadDataUrl) {
        preview.innerHTML = `<img src="${esc(uploadDataUrl)}" alt="" loading="lazy">`;
      } else {
        const a = find(current);
        preview.innerHTML = art(a[0]);
      }
      scrim.querySelectorAll('.eh-avatar-choice').forEach(b => {
        const selected = mode === 'avatar' && b.dataset.avatar === current;
        b.classList.toggle('on', selected);
        b.setAttribute('aria-pressed', String(selected));
      });
    }
    paint();

    const close = () => {
      try { scrim.remove(); } catch (e) {}
      document.removeEventListener('keydown', onKey);
    };
    const onKey = (e) => { if (e.key === 'Escape') close(); };
    document.addEventListener('keydown', onKey);

    scrim.addEventListener('click', e => { if (e.target === scrim) close(); });
    scrim.querySelector('.eh-avatar-close').onclick = close;

    scrim.querySelectorAll('.eh-avatar-choice').forEach(b => {
      b.onclick = () => {
        current = b.dataset.avatar;
        uploadDataUrl = '';
        setMode('avatar');
        paint();
      };
    });

    tabAvatar.onclick = () => { setMode('avatar'); paint(); };
    tabUpload.onclick = () => { setMode('upload'); fileInput.click(); };
    scrim.querySelector('#ehCameraBtn').onclick = () => fileInput.click();

    fileInput.onchange = () => {
      const file = fileInput.files && fileInput.files[0];
      if (!file) return;
      const reader = new FileReader();
      reader.onload = () => {
        uploadDataUrl = String(reader.result || '');
        setMode('upload');
        paint();
      };
      reader.readAsDataURL(file);
    };

    scrim.querySelector('#ehAvatarSave').onclick = async function () {
      const btn = this;
      const nameVal = (scrim.querySelector('#ehPreviewName').value || '').trim() || displayName;
      statusText = (scrim.querySelector('#ehPreviewStatus').value || '').trim();

      btn.disabled = true;
      btn.textContent = 'Saving…';

      try {
        // Prefer avatar ID path (bundled illustrated assets)
        if (mode === 'avatar' || !uploadDataUrl) {
          if (!current) current = AVATARS[0][0];
          let r;
          if (global.Api?.updateProfile) {
            r = await global.Api.updateProfile({
              chatAvatarId: current,
              chatAvatarUrl: '',
              chatStatus: statusText,
              name: nameVal
            });
          } else {
            const token = global.Session?.getToken?.();
            if (!token) throw new Error('Your session has expired. Please sign in again.');
            const response = await fetch('/api/users/me', {
              method: 'PUT',
              headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + token },
              body: JSON.stringify({ chatAvatarId: current, chatAvatarUrl: '', chatStatus: statusText, name: nameVal })
            });
            const data = await response.json().catch(() => ({}));
            if (!response.ok) throw new Error(data.message || `Account sync failed (${response.status}).`);
            r = data;
          }
          const u = global.Session.getUser() || {};
          u.chatAvatarId = current;
          u.chatAvatarUrl = '';
          if (statusText) u.chatStatus = statusText;
          if (nameVal) u.name = nameVal;
          if (r?.user) Object.assign(u, r.user);
          global.Session.setUser(u);
          opts.onSaved?.(current);
          document.dispatchEvent(new CustomEvent('eh:chat-avatar-changed', {
            detail: { id: current, url: dataUrl(current), name: find(current)[1] }
          }));
          close();
          return;
        }

        // Upload path: store as chatAvatarUrl if API supports media upload
        let url = uploadDataUrl;
        if (global.Api?.uploadChatAvatar && fileInput.files?.[0]) {
          const up = await global.Api.uploadChatAvatar(fileInput.files[0]);
          url = up?.url || up?.chatAvatarUrl || url;
        }
        if (global.Api?.updateProfile) {
          await global.Api.updateProfile({
            chatAvatarId: '',
            chatAvatarUrl: url,
            chatStatus: statusText,
            name: nameVal
          });
        }
        const u = global.Session.getUser() || {};
        u.chatAvatarId = '';
        u.chatAvatarUrl = url;
        if (statusText) u.chatStatus = statusText;
        if (nameVal) u.name = nameVal;
        global.Session.setUser(u);
        opts.onSaved?.(url);
        document.dispatchEvent(new CustomEvent('eh:chat-avatar-changed', {
          detail: { id: '', url, name: nameVal }
        }));
        close();
      } catch (err) {
        btn.disabled = false;
        btn.textContent = 'Save Profile';
        let msg = scrim.querySelector('.eh-avatar-save-error');
        if (!msg) {
          msg = document.createElement('div');
          msg.className = 'eh-avatar-save-error';
          btn.parentElement.insertBefore(msg, btn);
        }
        msg.textContent = err.message || 'Could not save profile.';
      }
    };
  }

  global.EHAvatarStudio = { open, getSaved, AVATARS, avatarDataUrl: dataUrl, find };
})(window);
