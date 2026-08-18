/* EventHub WhatsApp-style chat camera: front/back camera + crop + zoom + rotate + review */
(function(global){
  'use strict';
  function open(){
    var stream=null, facing='user', zoom=1, rotation=0, review=false;
    var scrim=document.createElement('div'); scrim.className='eh-camera-scrim';
    var ic={
      close:'<path d="m6 6 12 12M18 6 6 18"/>',
      switch:'<path d="M7 7h13l-3-3M17 17H4l3 3"/>',
      rotate:'<path d="M3 12a9 9 0 0 0 15.5 6.2L21 16M21 12A9 9 0 0 0 5.5 5.8L3 8M3 8h5M21 16h-5"/>',
      image:'<rect x="3" y="5" width="18" height="14" rx="3"/><circle cx="8.5" cy="10" r="1.5"/><path d="m4 17 5-5 4 4 2-2 5 5"/>',
      camera:'<path d="M4 7h3l2-2h6l2 2h3v12H4z"/><circle cx="12" cy="13" r="3.5"/>',
      check:'<path d="m5 12 4 4L19 6"/>'
    };
    var icon=function(name,size){return '<svg class="eh-icon" width="'+(size||17)+'" height="'+(size||17)+'" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">'+ic[name]+'</svg>';};
    scrim.innerHTML='<section class="eh-camera" role="dialog" aria-modal="true" aria-label="Chat camera">'+
      '<header><div><span>CHAT CAMERA</span><h2>Send a photo</h2><small>Front or back camera · crop before sending</small></div><button type="button" data-cam="close" aria-label="Close">'+icon('close',17)+'</button></header>'+
      '<div class="eh-camera-stage"><video autoplay playsinline muted></video><canvas hidden></canvas><div class="eh-crop-guide"></div><div class="eh-camera-status">Point, snap, crop & send</div></div>'+
      '<div class="eh-camera-tools"><button type="button" data-cam="switch">'+icon('switch')+' Switch</button><button type="button" data-cam="rotate">'+icon('rotate')+' Rotate</button><label>Zoom <input data-cam="zoom" type="range" min="1" max="2" step=".05" value="1"></label><button type="button" data-cam="upload">'+icon('image')+' Gallery</button></div>'+
      '<div class="eh-camera-actions"><button type="button" data-cam="cancel">Cancel</button><button class="primary" type="button" data-cam="shoot">'+icon('camera')+' Capture</button></div>'+
      '<input type="file" accept="image/*" hidden></section>';
    document.body.appendChild(scrim);
    var video=scrim.querySelector('video'),canvas=scrim.querySelector('canvas'),guide=scrim.querySelector('.eh-crop-guide'),status=scrim.querySelector('.eh-camera-status'),zoomIn=scrim.querySelector('[data-cam=zoom]'),actions=scrim.querySelector('.eh-camera-actions'),fileIn=scrim.querySelector('input[type=file]');
    function stop(){if(stream){stream.getTracks().forEach(function(t){t.stop();});stream=null;}}
    function close(){stop();scrim.remove();document.removeEventListener('keydown',key);}
    function key(e){if(e.key==='Escape')close();}
    document.addEventListener('keydown',key);
    async function start(){
      review=false; video.hidden=false; canvas.hidden=true; guide.hidden=false;
      actions.innerHTML='<button type="button" data-cam="cancel">Cancel</button><button class="primary" type="button" data-cam="shoot">'+icon('camera')+' Capture</button>';
      stop();
      if(!navigator.mediaDevices||!navigator.mediaDevices.getUserMedia){status.textContent='Camera unavailable — use Gallery.';return;}
      try{stream=await navigator.mediaDevices.getUserMedia({video:{facingMode:{ideal:facing},width:{ideal:1280},height:{ideal:1280}},audio:false});video.srcObject=stream;status.textContent=facing==='user'?'Front camera ready':'Back camera ready';}
      catch(e){status.textContent='Camera permission needed — use Gallery if you prefer.';}
    }
    function drawFrame(src,sw,sh,isVideo){
      var side=Math.min(sw,sh)/zoom, sx=(sw-side)/2, sy=(sh-side)/2;
      canvas.width=1024;canvas.height=1024;var c=canvas.getContext('2d');c.save();c.translate(512,512);c.rotate(rotation*Math.PI/180);if(facing==='user'&&isVideo)c.scale(-1,1);c.drawImage(src,sx,sy,side,side,-512,-512,1024,1024);c.restore();
    }
    function reviewPhoto(src,sw,sh,isVideo){
      drawFrame(src,sw,sh,isVideo); stop(); video.hidden=true; canvas.hidden=false; guide.hidden=true; review=true;
      status.textContent='Looks good? Crop, rotate, then use it.';
      actions.innerHTML='<button type="button" data-cam="retake">'+icon('rotate')+' Retake</button><button class="primary" type="button" data-cam="use">'+icon('check')+' Use photo</button>';
    }
    function usePhoto(){
      canvas.toBlob(function(blob){
        if(!blob)return;
        var file=new File([blob],'camera-'+Date.now()+'.jpg',{type:'image/jpeg'});
        close(); document.dispatchEvent(new CustomEvent('eh:camera-captured',{detail:{file:file}}));
      },'image/jpeg',.9);
    }
    scrim.addEventListener('click',function(e){var b=e.target.closest('[data-cam]');if(!b)return;var a=b.dataset.cam;
      if(a==='close'||a==='cancel')return close();
      if(a==='switch'&&!review){facing=facing==='user'?'environment':'user';start();}
      if(a==='rotate'&&review){rotation=(rotation+90)%360; var img=canvas; var tmp=document.createElement('canvas'); tmp.width=img.width;tmp.height=img.height;tmp.getContext('2d').drawImage(img,0,0); drawFrame(tmp,1024,1024,false); status.textContent='Rotation '+rotation+'°';}
      if(a==='upload'&&!review)fileIn.click();
      if(a==='shoot'&&!review){if(!stream){fileIn.click();return;}reviewPhoto(video,video.videoWidth||1280,video.videoHeight||720,true);}
      if(a==='retake')start();
      if(a==='use'&&review)usePhoto();
    });
    zoomIn.addEventListener('input',function(){zoom=Number(this.value)||1;if(!review)video.style.transform='scale('+zoom+')';});
    fileIn.addEventListener('change',function(){var f=fileIn.files&&fileIn.files[0];if(!f)return;var img=new Image();img.onload=function(){reviewPhoto(img,img.naturalWidth,img.naturalHeight,false);};img.src=URL.createObjectURL(f);});
    start();
  }
  global.EHChatCamera={open:open};
})(window);
