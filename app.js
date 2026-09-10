const cfg = window.CUBIQ_CONFIG;
let sb = null;
try {
  if (!window.supabase || !window.supabase.createClient) throw new Error('Supabase library tidak berjaya dimuatkan. Pastikan internet aktif dan cuba refresh.');
  sb = window.supabase.createClient(cfg.supabaseUrl, cfg.supabaseKey);
} catch (e) {
  console.error(e);
  window.CUBIQ_BOOT_ERROR = e.message || String(e);
}
const seed = window.METER_DATA || [];
let data = [];
let currentUser = null;
let isAdmin = false;

const q=document.getElementById('q'), list=document.getElementById('list'), count=document.getElementById('count'), empty=document.getElementById('empty'), dlg=document.getElementById('dlg'), detail=document.getElementById('detail'), notice=document.getElementById('notice');
const loginDlg=document.getElementById('loginDlg'), adminDlg=document.getElementById('adminDlg');
const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const maps=m=>`https://www.google.com/maps/search/?api=1&query=${m.lat},${m.lng}`;

function normalize(row){return {id:row.id,meterNo:row.meter_no,address:row.address,lat:Number(row.latitude),lng:Number(row.longitude),status:row.status||'Active',remark:row.remark||'',photos:row.photos||[]}}
function setNotice(msg,type='info'){notice.textContent=msg;notice.className=`notice ${type}`;notice.hidden=!msg}

async function loadMeters(){
  count.textContent='Loading…';
  if(!sb){ data=[]; render(); setNotice(window.CUBIQ_BOOT_ERROR || 'Supabase tidak tersedia.','warn'); return; }
  const {data:rows,error}=await sb.from('meters').select('*').order('meter_no');
  if(error){
    data=[]; render();
    setNotice('Database belum disediakan. Jalankan fail SUPABASE_SETUP.sql dalam Supabase SQL Editor dahulu.','warn');
    return;
  }
  setNotice(''); data=(rows||[]).map(normalize); render();
}

function render(){
  const x=q.value.trim().toLowerCase();
  const a=data.filter(m=>m.meterNo.toLowerCase().includes(x)||m.address.toLowerCase().includes(x)||(m.status||'').toLowerCase().includes(x));
  count.textContent=`${a.length} meter`; empty.hidden=!!a.length;
  list.innerHTML=a.map(m=>`<article class="card"><img src="${m.photos[0]||placeholder(m.meterNo)}" alt="${esc(m.meterNo)}"><div class="body"><h2>${esc(m.meterNo)}</h2><span class="badge">${esc(m.status)}</span><p>${esc(m.address)}</p><div class="actions"><button onclick="showMeter('${m.id}')">View</button><a href="${maps(m)}" target="_blank" rel="noopener">Google Maps</a></div></div></article>`).join('');
  renderAdminList();
}
function placeholder(label){return `data:image/svg+xml;charset=UTF-8,${encodeURIComponent(`<svg xmlns="http://www.w3.org/2000/svg" width="800" height="500"><rect width="100%" height="100%" fill="#e5e7eb"/><text x="50%" y="50%" dominant-baseline="middle" text-anchor="middle" font-family="Arial" font-size="32" fill="#6b7280">${label}</text></svg>`)}`}
window.showMeter=id=>{const m=data.find(x=>x.id===id);if(!m)return;const photos=m.photos.length?m.photos:[placeholder(m.meterNo)];detail.innerHTML=`<div class="detail"><h2>${esc(m.meterNo)}</h2><div class="gallery">${photos.map((p,i)=>`<img src="${p}" alt="${esc(m.meterNo)}" role="button" tabindex="0" title="Tekan untuk besarkan gambar" onclick="openPhoto('${m.id}',${i})" onkeydown="if(event.key==='Enter'||event.key===' ')openPhoto('${m.id}',${i})">`).join('')}</div><div class="info"><div class="full"><small>Alamat</small><p>${esc(m.address)}</p></div><div><small>Status</small><p>${esc(m.status)}</p></div><div><small>GPS</small><p>${m.lat}, ${m.lng}</p></div>${m.remark?`<div class="full"><small>Remark</small><p>${esc(m.remark)}</p></div>`:''}</div><a class="map" href="${maps(m)}" target="_blank" rel="noopener">📍 Open in Google Maps</a></div>`;dlg.showModal()};


let lightboxPhotos=[];
let lightboxIndex=0;
const lightbox=document.createElement('dialog');
lightbox.id='photoLightbox';
lightbox.className='photo-lightbox';
lightbox.innerHTML=`<button class="lightbox-close" aria-label="Tutup gambar">×</button><button class="lightbox-nav lightbox-prev" aria-label="Gambar sebelumnya">‹</button><img id="lightboxImage" alt="Gambar meter besar"><button class="lightbox-nav lightbox-next" aria-label="Gambar seterusnya">›</button><div id="lightboxCounter" class="lightbox-counter"></div>`;
document.body.appendChild(lightbox);
const lightboxImage=document.getElementById('lightboxImage');
const lightboxCounter=document.getElementById('lightboxCounter');
function renderLightbox(){
  if(!lightboxPhotos.length)return;
  lightboxImage.src=lightboxPhotos[lightboxIndex];
  lightboxCounter.textContent=lightboxPhotos.length>1?`${lightboxIndex+1} / ${lightboxPhotos.length}`:'';
  lightbox.querySelector('.lightbox-prev').hidden=lightboxPhotos.length<2;
  lightbox.querySelector('.lightbox-next').hidden=lightboxPhotos.length<2;
}
window.openPhoto=(id,index=0)=>{
  const m=data.find(x=>x.id===id); if(!m)return;
  lightboxPhotos=m.photos.length?m.photos:[placeholder(m.meterNo)];
  lightboxIndex=Math.max(0,Math.min(index,lightboxPhotos.length-1));
  renderLightbox(); lightbox.showModal();
};
function moveLightbox(step){lightboxIndex=(lightboxIndex+step+lightboxPhotos.length)%lightboxPhotos.length;renderLightbox()}
lightbox.querySelector('.lightbox-close').onclick=()=>lightbox.close();
lightbox.querySelector('.lightbox-prev').onclick=()=>moveLightbox(-1);
lightbox.querySelector('.lightbox-next').onclick=()=>moveLightbox(1);
lightbox.addEventListener('click',e=>{if(e.target===lightbox)lightbox.close()});
lightbox.addEventListener('keydown',e=>{if(e.key==='ArrowLeft'&&lightboxPhotos.length>1)moveLightbox(-1);if(e.key==='ArrowRight'&&lightboxPhotos.length>1)moveLightbox(1)});

q.addEventListener('input',render);

async function refreshAuth(){
  if(!sb){ currentUser=null; isAdmin=false; return; }
  const {data:{user}}=await sb.auth.getUser(); currentUser=user||null; isAdmin=false;
  if(currentUser){
    const {data:adminRow}=await sb.from('admins').select('user_id').eq('user_id',currentUser.id).maybeSingle();
    isAdmin=!!adminRow;
  }
}
document.getElementById('adminBtn').onclick=async()=>{
  const msg=document.getElementById('loginMsg'); msg.textContent='';
  if(!sb){ msg.textContent=window.CUBIQ_BOOT_ERROR || 'Supabase tidak tersedia. Pastikan internet aktif dan refresh.'; loginDlg.showModal(); return; }
  await refreshAuth(); if(currentUser&&isAdmin){openAdmin()}else{loginDlg.showModal()}
};
document.getElementById('loginForm').onsubmit=async e=>{e.preventDefault();const msg=document.getElementById('loginMsg'); if(!sb){msg.textContent=window.CUBIQ_BOOT_ERROR || 'Supabase tidak tersedia.';return;} msg.textContent='Logging in…';const {error}=await sb.auth.signInWithPassword({email:document.getElementById('loginEmail').value.trim(),password:document.getElementById('loginPassword').value});if(error){msg.textContent=error.message;return}await refreshAuth();if(!isAdmin){await sb.auth.signOut();msg.textContent='Akaun ini bukan admin.';return}loginDlg.close();openAdmin()};
function openAdmin(){document.getElementById('adminEmail').textContent=currentUser?.email||'';renderAdminList();adminDlg.showModal()}
document.getElementById('logoutBtn').onclick=async()=>{await sb.auth.signOut();currentUser=null;isAdmin=false;adminDlg.close()};

function renderAdminList(){const el=document.getElementById('adminList');if(!el)return;el.innerHTML=data.map(m=>`<div class="admin-item"><div><strong>${esc(m.meterNo)}</strong><small>${esc(m.status)}</small></div><div><button class="secondary mini" onclick="editMeter('${m.id}')">Edit</button><button class="danger mini" onclick="deleteMeter('${m.id}')">Delete</button></div></div>`).join('')||'<p class="muted">Tiada data.</p>'}
window.editMeter=id=>{const m=data.find(x=>x.id===id);if(!m)return;document.getElementById('editId').value=m.id;document.getElementById('meterNo').value=m.meterNo;document.getElementById('address').value=m.address;document.getElementById('lat').value=m.lat;document.getElementById('lng').value=m.lng;document.getElementById('status').value=m.status;document.getElementById('remark').value=m.remark;document.getElementById('formTitle').textContent='Edit Meter';document.getElementById('meterNo').focus()};
function resetForm(){document.getElementById('meterForm').reset();document.getElementById('editId').value='';document.getElementById('formTitle').textContent='Tambah Meter';document.getElementById('saveMsg').textContent=''}
document.getElementById('resetBtn').onclick=resetForm;

async function uploadFiles(meterNo,files){
  const urls=[];
  for(let i=0;i<files.length;i++){
    const f=files[i]; const ext=(f.name.split('.').pop()||'jpg').toLowerCase(); const path=`${meterNo}/${Date.now()}_${i+1}.${ext}`;
    const {error}=await sb.storage.from(cfg.bucket).upload(path,f,{upsert:false,contentType:f.type||undefined}); if(error)throw error;
    const {data:u}=sb.storage.from(cfg.bucket).getPublicUrl(path); urls.push(u.publicUrl);
  }
  return urls;
}

document.getElementById('meterForm').onsubmit=async e=>{
  e.preventDefault(); const msg=document.getElementById('saveMsg'); msg.textContent='Saving…';
  try{
    const id=document.getElementById('editId').value; const meterNo=document.getElementById('meterNo').value.trim(); const files=[...document.getElementById('photos').files];
    let existing=id?data.find(x=>x.id===id):null; let photos=existing?.photos||[]; if(files.length)photos=photos.concat(await uploadFiles(meterNo,files));
    const payload={meter_no:meterNo,address:document.getElementById('address').value.trim(),latitude:Number(document.getElementById('lat').value),longitude:Number(document.getElementById('lng').value),status:document.getElementById('status').value,remark:document.getElementById('remark').value.trim(),photos};
    const result=id?await sb.from('meters').update(payload).eq('id',id):await sb.from('meters').insert(payload); if(result.error)throw result.error;
    msg.textContent='Saved.'; resetForm(); await loadMeters();
  }catch(err){msg.textContent=err.message||String(err)}
};

window.deleteMeter=async id=>{if(!confirm('Padam meter ini?'))return;const {error}=await sb.from('meters').delete().eq('id',id);if(error){alert(error.message);return}await loadMeters()};

async function fetchLocalFile(path){
  const dataUrl=(window.EMBEDDED_PHOTOS||{})[path];
  if(!dataUrl)throw new Error(`Gambar import tidak ditemui: ${path}`);
  const [meta,b64]=dataUrl.split(',');
  const mime=((meta.match(/data:([^;]+)/)||[])[1])||'image/jpeg';
  const bytes=Uint8Array.from(atob(b64),c=>c.charCodeAt(0));
  const blob=new Blob([bytes],{type:mime});
  return new File([blob],path.split('/').pop(),{type:mime});
}
document.getElementById('importBtn').onclick=async()=>{
  const msg=document.getElementById('importMsg'); msg.textContent='Importing…';
  try{
    for(const m of seed){
      const {data:existing}=await sb.from('meters').select('id').eq('meter_no',m.meterNo).maybeSingle(); if(existing)continue;
      const files=[]; for(const p of m.photos)files.push(await fetchLocalFile(p));
      const urls=await uploadFiles(m.meterNo,files);
      const {error}=await sb.from('meters').insert({meter_no:m.meterNo,address:m.address,latitude:m.lat,longitude:m.lng,status:m.status,remark:m.remark||'',photos:urls}); if(error)throw error;
    }
    msg.textContent='Import selesai.'; await loadMeters();
  }catch(err){msg.textContent=err.message||String(err)}
};

loadMeters(); refreshAuth();
