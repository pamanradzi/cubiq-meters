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

/* All meters map */
let metersMap=null;
let mapLayer=null;
const mapDlg=document.getElementById('mapDlg');
const mapBtn=document.getElementById('mapBtn');
const metersMapEl=document.getElementById('metersMap');
const mapCount=document.getElementById('mapCount');

function mapPinClass(status){
  const st=String(status||'').toLowerCase();
  if(st==='no data')return 'nodata';
  if(st==='closed')return 'closed';
  return 'active';
}
function markerIcon(status){
  const cls=mapPinClass(status);
  return L.divIcon({className:'',html:`<div class="meter-map-pin ${cls}"></div>`,iconSize:[18,18],iconAnchor:[9,9],popupAnchor:[0,-10]});
}
function popupHtml(m){
  return `<div class="map-popup-title">${esc(m.meterNo)}</div><div class="map-popup-status">${esc(m.status)}</div><div class="map-popup-address">${esc(m.address)}</div><div class="map-popup-actions"><button type="button" onclick="showMeterFromMap('${m.id}')">View</button><a href="${maps(m)}" target="_blank" rel="noopener">Google Maps</a></div>`;
}
function drawMetersMap(){
  if(!window.L||!metersMapEl)return;
  const valid=data.filter(m=>Number.isFinite(m.lat)&&Number.isFinite(m.lng));
  mapCount.textContent=`${valid.length} lokasi meter`;
  if(!metersMap){
    metersMap=L.map(metersMapEl,{zoomControl:true});
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',{maxZoom:19,attribution:'&copy; OpenStreetMap contributors'}).addTo(metersMap);
    mapLayer=L.layerGroup().addTo(metersMap);
  }
  mapLayer.clearLayers();
  const bounds=[];
  valid.forEach(m=>{
    L.marker([m.lat,m.lng],{icon:markerIcon(m.status),title:m.meterNo}).bindPopup(popupHtml(m)).addTo(mapLayer);
    bounds.push([m.lat,m.lng]);
  });
  setTimeout(()=>{
    metersMap.invalidateSize();
    if(bounds.length===1)metersMap.setView(bounds[0],17);
    else if(bounds.length)metersMap.fitBounds(bounds,{padding:[28,28],maxZoom:17});
    else metersMap.setView([3.139,101.6869],10);
  },80);
}
window.showMeterFromMap=id=>{mapDlg.close();setTimeout(()=>showMeter(id),60)};
if(mapBtn)mapBtn.onclick=()=>{
  if(!window.L){setNotice('Peta tidak dapat dimuatkan. Pastikan internet aktif dan refresh website.','warn');return;}
  mapDlg.showModal();drawMetersMap();
};
if(mapDlg){
  mapDlg.querySelector('.map-close').onclick=()=>mapDlg.close();
  mapDlg.addEventListener('click',e=>{if(e.target===mapDlg)mapDlg.close()});
}


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

// ===== Bulk Import Excel / CSV =====
let bulkRowsReady=[];
let bulkFileStats=null;

function bulkNormHeader(v){
  return String(v??'').trim().toLowerCase()
    .replace(/[._\-\/]+/g,' ')
    .replace(/\s+/g,' ');
}
function bulkFindKey(row,aliases){
  const keys=Object.keys(row||{});
  const aliasSet=new Set(aliases.map(bulkNormHeader));
  return keys.find(k=>aliasSet.has(bulkNormHeader(k)));
}
function bulkCell(row,aliases){
  const k=bulkFindKey(row,aliases); return k===undefined?undefined:row[k];
}
function bulkStatus(v){
  const s=String(v??'Active').trim().toLowerCase().replace(/[_-]+/g,' ');
  if(!s || s==='active') return 'Active';
  if(s==='no data'||s==='nodata'||s==='no_data') return 'No Data';
  if(s==='closed'||s==='close'||s==='tutup') return 'Closed';
  return null;
}
function bulkEsc(v){return esc(String(v??''))}
function renderBulkPreview(stats){
  const el=document.getElementById('bulkPreview');
  el.hidden=false;
  const issues=[];
  if(stats.invalidRows.length)issues.push(`<li class="bad">${stats.invalidRows.length} baris tidak lengkap / GPS tidak sah</li>`);
  if(stats.duplicateInFile.length)issues.push(`<li class="warn">${stats.duplicateInFile.length} Meter No. duplicate dalam fail (rekod pertama sahaja digunakan)</li>`);
  if(stats.badStatus.length)issues.push(`<li class="warn">${stats.badStatus.length} status tidak dikenali (baris tersebut tidak akan diimport)</li>`);
  el.innerHTML=`<strong>Semakan fail</strong>
    <div>Jumlah baris data: <b>${stats.total}</b></div>
    <div class="ok">Sedia untuk semakan database: <b>${stats.validUnique}</b></div>
    ${issues.length?`<ul>${issues.join('')}</ul>`:'<div class="ok">✓ Format asas kelihatan betul.</div>'}
    <div class="muted" style="margin-top:6px">Gambar tidak diupload dalam proses ini. Ruangan Photo Name boleh kekal dalam Excel.</div>`;
}

async function parseBulkFile(file){
  if(!window.XLSX)throw new Error('Library Excel tidak berjaya dimuatkan. Pastikan internet aktif dan refresh website.');
  const buf=await file.arrayBuffer();
  const wb=XLSX.read(buf,{type:'array'});
  const sheet=wb.Sheets[wb.SheetNames[0]];
  const rows=XLSX.utils.sheet_to_json(sheet,{defval:'',raw:false});
  if(!rows.length)throw new Error('Fail kosong atau tiada data pada sheet pertama.');

  const sample=rows[0];
  const required={
    meterNo:['Meter No','Meter Number','Meter No.','meter_no','No Meter','Nombor Meter'],
    address:['Address','Alamat'],
    lat:['Latitude','Lat'],
    lng:['Longitude','Lng','Long']
  };
  const missing=Object.entries(required).filter(([,a])=>bulkFindKey(sample,a)===undefined).map(([k])=>k);
  if(missing.length)throw new Error('Column wajib tidak ditemui: '+missing.join(', ')+'. Gunakan Meter No., Address, Latitude dan Longitude.');

  const seen=new Set(), duplicateInFile=[], invalidRows=[], badStatus=[], ready=[];
  rows.forEach((r,i)=>{
    const rowNo=i+2;
    const meterNo=String(bulkCell(r,required.meterNo)??'').trim();
    const address=String(bulkCell(r,required.address)??'').trim();
    const lat=Number(String(bulkCell(r,required.lat)??'').trim());
    const lng=Number(String(bulkCell(r,required.lng)??'').trim());
    const status=bulkStatus(bulkCell(r,['Status']));
    const remark=String(bulkCell(r,['Remark','Remarks','Catatan'])??'').trim();
    if(!meterNo||!address||!Number.isFinite(lat)||!Number.isFinite(lng)||Math.abs(lat)>90||Math.abs(lng)>180){invalidRows.push({rowNo,meterNo});return;}
    if(!status){badStatus.push({rowNo,meterNo});return;}
    const key=meterNo.toUpperCase();
    if(seen.has(key)){duplicateInFile.push({rowNo,meterNo});return;}
    seen.add(key);
    ready.push({meter_no:meterNo,address,latitude:lat,longitude:lng,status,remark,photos:[]});
  });
  return {rows:ready,stats:{total:rows.length,validUnique:ready.length,duplicateInFile,invalidRows,badStatus}};
}

const bulkFile=document.getElementById('bulkFile');
const bulkPreviewBtn=document.getElementById('bulkPreviewBtn');
const bulkImportBtn=document.getElementById('bulkImportBtn');
const bulkMsg=document.getElementById('bulkMsg');
if(bulkFile){
  bulkFile.onchange=()=>{bulkRowsReady=[];bulkFileStats=null;bulkImportBtn.disabled=true;document.getElementById('bulkPreview').hidden=true;bulkMsg.textContent='';};
  bulkPreviewBtn.onclick=async()=>{
    bulkMsg.textContent='Membaca fail…'; bulkImportBtn.disabled=true;
    try{
      const file=bulkFile.files[0]; if(!file)throw new Error('Pilih fail Excel / CSV dahulu.');
      const parsed=await parseBulkFile(file); bulkRowsReady=parsed.rows; bulkFileStats=parsed.stats;
      renderBulkPreview(parsed.stats);
      bulkImportBtn.disabled=!bulkRowsReady.length;
      bulkMsg.textContent=bulkRowsReady.length?'Semakan siap. Tekan “Import Data” untuk teruskan.':'Tiada rekod yang sah untuk diimport.';
    }catch(err){bulkRowsReady=[];bulkMsg.textContent=err.message||String(err)}
  };
  bulkImportBtn.onclick=async()=>{
    if(!bulkRowsReady.length)return;
    if(!confirm(`Import ${bulkRowsReady.length} rekod yang sah? Meter yang sudah ada dalam database akan dilangkau.`))return;
    bulkImportBtn.disabled=true; bulkPreviewBtn.disabled=true; bulkMsg.textContent='Menyemak duplicate dalam database…';
    try{
      if(!sb)throw new Error('Supabase tidak tersedia.');
      await refreshAuth(); if(!currentUser||!isAdmin)throw new Error('Sesi admin tamat. Login semula.');
      const {data:existing,error:existingErr}=await sb.from('meters').select('meter_no');
      if(existingErr)throw existingErr;
      const existingSet=new Set((existing||[]).map(x=>String(x.meter_no||'').toUpperCase()));
      const newRows=bulkRowsReady.filter(r=>!existingSet.has(r.meter_no.toUpperCase()));
      const skipped=bulkRowsReady.length-newRows.length;
      let imported=0;
      for(let i=0;i<newRows.length;i+=100){
        const batch=newRows.slice(i,i+100);
        bulkMsg.textContent=`Importing… ${imported}/${newRows.length}`;
        const {error}=await sb.from('meters').insert(batch); if(error)throw error;
        imported+=batch.length;
      }
      bulkMsg.textContent=`Import selesai: ${imported} meter baru dimasukkan${skipped?`, ${skipped} duplicate database dilangkau`:''}.`;
      bulkRowsReady=[]; bulkImportBtn.disabled=true; bulkFile.value='';
      await loadMeters();
    }catch(err){bulkMsg.textContent='Import gagal: '+(err.message||String(err)); bulkImportBtn.disabled=false}
    finally{bulkPreviewBtn.disabled=false}
  };
}


/* Bulk ZIP Photo Upload */
let photoZipReady=[];
let photoZipStats=null;

function photoMeterNoFromName(name){
  const base=String(name||'').split('/').pop().replace(/\.[^.]+$/,'');
  return base.replace(/[_-]\d+$/,'').trim();
}
function photoIsImage(name){return /\.(jpe?g|png|webp|gif|heic)$/i.test(String(name||''));}
function safeStorageName(name){
  return String(name||'image.jpg').split('/').pop().replace(/[^A-Za-z0-9._-]+/g,'_');
}
function renderPhotoZipPreview(stats){
  const el=document.getElementById('photoZipPreview'); if(!el)return;
  el.hidden=false;
  const missing=stats.missingMeters.length?`<li class="warn">${stats.missingMeters.length} Meter No. tiada dalam database dan akan dilangkau.</li>`:'';
  const ignored=stats.ignoredFiles?`<li class="warn">${stats.ignoredFiles} fail bukan gambar / tidak dapat dipadankan akan diabaikan.</li>`:'';
  el.innerHTML=`<strong>Semakan ZIP gambar</strong>
    <div>Jumlah gambar dalam ZIP: <b>${stats.totalImages}</b></div>
    <div>Meter unik dalam ZIP: <b>${stats.uniqueMeters}</b></div>
    <div class="ok">Gambar yang boleh dipadankan: <b>${stats.matchedImages}</b></div>
    <div class="ok">Meter yang sepadan dalam database: <b>${stats.matchedMeters}</b></div>
    ${(missing||ignored)?`<ul>${missing}${ignored}</ul>`:'<div class="ok">✓ Semua gambar yang dikenal pasti mempunyai padanan meter.</div>'}
    ${stats.missingMeters.length?`<div class="muted" style="margin-top:6px">Tiada dalam database: ${stats.missingMeters.slice(0,8).map(bulkEsc).join(', ')}${stats.missingMeters.length>8?'…':''}</div>`:''}
    <div class="muted" style="margin-top:6px">Upload selamat untuk diulang: URL gambar yang sama tidak akan ditambah dua kali dalam rekod meter.</div>`;
}
async function preparePhotoZip(file){
  if(!window.JSZip)throw new Error('Library ZIP tidak berjaya dimuatkan. Pastikan internet aktif dan refresh website.');
  if(!file)throw new Error('Pilih fail ZIP gambar dahulu.');
  if(!sb)throw new Error('Supabase tidak tersedia.');
  await refreshAuth(); if(!currentUser||!isAdmin)throw new Error('Sesi admin tamat. Login semula.');
  const zip=await JSZip.loadAsync(file);
  const entries=Object.values(zip.files).filter(x=>!x.dir);
  const images=entries.filter(x=>photoIsImage(x.name));
  if(!images.length)throw new Error('Tiada gambar JPG/PNG/WEBP/GIF ditemui dalam ZIP.');
  const {data:rows,error}=await sb.from('meters').select('id,meter_no,photos'); if(error)throw error;
  const meterMap=new Map((rows||[]).map(r=>[String(r.meter_no||'').toUpperCase(),r]));
  const ready=[], missingSet=new Set(); let ignoredFiles=entries.length-images.length;
  for(const entry of images){
    const meterNo=photoMeterNoFromName(entry.name);
    const meter=meterMap.get(meterNo.toUpperCase());
    if(!meter){missingSet.add(meterNo);continue;}
    ready.push({entry,meter,meterNo,filename:safeStorageName(entry.name)});
  }
  const metersInZip=new Set(images.map(x=>photoMeterNoFromName(x.name).toUpperCase()).filter(Boolean));
  const matchedMeters=new Set(ready.map(x=>x.meterNo.toUpperCase()));
  return {ready,stats:{totalImages:images.length,uniqueMeters:metersInZip.size,matchedImages:ready.length,matchedMeters:matchedMeters.size,missingMeters:[...missingSet].sort(),ignoredFiles}};
}

const photoZipFile=document.getElementById('photoZipFile');
const photoZipPreviewBtn=document.getElementById('photoZipPreviewBtn');
const photoZipUploadBtn=document.getElementById('photoZipUploadBtn');
const photoZipMsg=document.getElementById('photoZipMsg');
const photoZipProgressWrap=document.getElementById('photoZipProgressWrap');
const photoZipProgress=document.getElementById('photoZipProgress');
const photoZipProgressText=document.getElementById('photoZipProgressText');
if(photoZipFile){
  photoZipFile.onchange=()=>{photoZipReady=[];photoZipStats=null;photoZipUploadBtn.disabled=true;document.getElementById('photoZipPreview').hidden=true;photoZipProgressWrap.hidden=true;photoZipMsg.textContent='';};
  photoZipPreviewBtn.onclick=async()=>{
    photoZipMsg.textContent='Membaca ZIP dan menyemak database…'; photoZipUploadBtn.disabled=true; photoZipPreviewBtn.disabled=true;
    try{
      const result=await preparePhotoZip(photoZipFile.files[0]); photoZipReady=result.ready; photoZipStats=result.stats; renderPhotoZipPreview(result.stats);
      photoZipUploadBtn.disabled=!photoZipReady.length;
      photoZipMsg.textContent=photoZipReady.length?'Semakan siap. Tekan “Upload Semua” untuk teruskan.':'Tiada gambar yang mempunyai padanan meter dalam database.';
    }catch(err){photoZipReady=[];photoZipMsg.textContent='Semakan gagal: '+(err.message||String(err));}
    finally{photoZipPreviewBtn.disabled=false;}
  };
  photoZipUploadBtn.onclick=async()=>{
    if(!photoZipReady.length)return;
    const metersCount=new Set(photoZipReady.map(x=>x.meterNo.toUpperCase())).size;
    if(!confirm(`Upload ${photoZipReady.length} gambar untuk ${metersCount} meter? Proses ini mungkin mengambil beberapa minit.`))return;
    photoZipUploadBtn.disabled=true; photoZipPreviewBtn.disabled=true; photoZipProgressWrap.hidden=false; photoZipProgress.value=0; photoZipProgressText.textContent='0%';
    let done=0, uploaded=0, reused=0, failed=0;
    const urlsByMeter=new Map();
    try{
      await refreshAuth(); if(!currentUser||!isAdmin)throw new Error('Sesi admin tamat. Login semula.');
      for(const item of photoZipReady){
        photoZipMsg.textContent=`Uploading gambar ${done+1}/${photoZipReady.length}: ${item.filename}`;
        try{
          const blob=await item.entry.async('blob');
          const ext=(item.filename.split('.').pop()||'jpg').toLowerCase();
          const contentType=ext==='png'?'image/png':ext==='webp'?'image/webp':ext==='gif'?'image/gif':ext==='heic'?'image/heic':'image/jpeg';
          const path=`${item.meterNo}/bulk/${item.filename}`;
          const {error}=await sb.storage.from(cfg.bucket).upload(path,blob,{upsert:false,contentType});
          if(error){
            const msg=String(error.message||error); const status=String(error.statusCode||error.status||'');
            if(/already exists|duplicate|resource already exists/i.test(msg)||status==='409')reused++;
            else throw error;
          }else uploaded++;
          const {data:u}=sb.storage.from(cfg.bucket).getPublicUrl(path);
          const key=item.meterNo.toUpperCase(); if(!urlsByMeter.has(key))urlsByMeter.set(key,{meter:item.meter,urls:[]});
          urlsByMeter.get(key).urls.push(u.publicUrl);
        }catch(err){failed++;console.error('Photo upload failed',item.filename,err);}
        done++; const pct=Math.round(done/photoZipReady.length*100); photoZipProgress.value=pct; photoZipProgressText.textContent=`${pct}%`;
      }
      photoZipMsg.textContent='Mengemaskini rekod meter dengan URL gambar…';
      let updatedMeters=0;
      for(const {meter,urls} of urlsByMeter.values()){
        const current=Array.isArray(meter.photos)?meter.photos:[];
        const merged=[...new Set([...current,...urls])];
        const {error}=await sb.from('meters').update({photos:merged}).eq('id',meter.id); if(error)throw error;
        updatedMeters++;
      }
      photoZipMsg.textContent=`Siap: ${uploaded} gambar baru diupload${reused?`, ${reused} gambar sedia ada digunakan semula`:''}; ${updatedMeters} meter dikemaskini${failed?`; ${failed} gambar gagal`:''}.`;
      await loadMeters(); photoZipReady=[]; photoZipFile.value=''; photoZipUploadBtn.disabled=true;
    }catch(err){photoZipMsg.textContent='Upload gagal: '+(err.message||String(err)); photoZipUploadBtn.disabled=false;}
    finally{photoZipPreviewBtn.disabled=false;}
  };
}
