
const NAMES=["Bahodirjonov Sardor","Bahodirov Asadbek","Farangiz","Farxodjon 08","Hikmatillo","Ibrohim","Mashrapov Azizbek","Muhiddinov Nurillo","Dadajonova Munavvara","Og'abek","Omonov Alisher","Shavkatova Fotima","Shaxboz","Shodiyona","Tojaliyev G'ayratjon","Tolipjonov Asadbek","Tursunaliyev Abdulaziz","Umaraliyev Ozodbek"];
const SK="texno_v4";
const DEFAULT_ADMIN_PASSWORD="Admin2026";
let teachers=[],students=[],txs=[],nid=1,ntid=1,adminPassword=DEFAULT_ADMIN_PASSWORD,curType=null,curId=null,curTeacherId=null,lbM="overall",lbM2="overall",chart=null;
const medals=['🥇','🥈','🥉'];

function nNum(v){return Number(v);} 
function escHtml(v){return String(v).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;').replace(/'/g,'&#39;');}
function genP(seed){const safe=(seed||'').replace(/[^a-zA-Z0-9]/g,'');return(safe.slice(0,3).toUpperCase()||"USR")+(~~(Math.random()*900)+100);}
function isAdmin(){return curType==='admin';}
function isTeacherMode(){return curType==='teacher'||curType==='admin';}
function getTeacherById(id){return teachers.find(t=>t.id===nNum(id));}
function nonMainTeachers(){return teachers.filter(t=>!t.isMain);} 
function scopeStudents(){if(curType==='student'){const s=students.find(x=>x.id===curId);if(!s)return[];return students.filter(x=>x.teacherId===s.teacherId);}if(curType==='teacher')return students.filter(x=>x.teacherId===curTeacherId);return students;}
function manageStudents(){if(curType==='teacher')return students.filter(x=>x.teacherId===curTeacherId);if(curType==='admin')return students;return[];}
function canManageStudent(s){if(!s)return false;return curType==='admin'||(curType==='teacher'&&s.teacherId===curTeacherId);} 
function byModeValue(sid,mode){if(mode==="weekly"){const w=Date.now()-7*864e5;return txs.filter(t=>t.studentId===sid&&t.timestamp>=w).reduce((a,b)=>a+b.amount,0);}if(mode==="monthly"){const m=Date.now()-30*864e5;return txs.filter(t=>t.studentId===sid&&t.timestamp>=m).reduce((a,b)=>a+b.amount,0);}return students.find(s=>s.id===sid)?.totalCoins||0;}
function sorted(mode){return[...scopeStudents()].map(s=>({...s,score:byModeValue(s.id,mode)})).sort((a,b)=>b.score-a.score);} 
function rank(sid,mode){const numSid=nNum(sid);return sorted(mode).findIndex(s=>s.id===numSid)+1;}

function mkDef(){
  teachers=[
    {id:1,name:"Asosiy Admin",subject:"Boshqaruv",password:genP("ADM"),isMain:true},
    {id:2,name:"IT O'qituvchi",subject:"IT",password:genP("UST"),isMain:false}
  ];
  students=[];let id=1;
  for(const n of NAMES){const curId=id++;const p=genP(n);students.push({id:curId,teacherId:2,name:n,refCode:`REF${curId}${~~(Math.random()*100)}`,password:p,totalCoins:0,streak:0,lastDailyDate:null,level:1,badge:"Starter"});}
  nid=id;ntid=3;txs=[];adminPassword=DEFAULT_ADMIN_PASSWORD;
}

function normalizeData(d){
  const oldTeacherPwd = localStorage.getItem('tpwd') || "Ustoz2023";
  teachers=(Array.isArray(d?.teachers)&&d.teachers.length?d.teachers:[
    {id:1,name:"Asosiy Admin",subject:"Boshqaruv",password:genP("ADM"),isMain:true},
    {id:2,name:"IT O'qituvchi",subject:"IT",password:oldTeacherPwd,isMain:false}
  ]).map(t=>({id:nNum(t.id),name:t.name||"O'qituvchi",subject:t.subject||"Fan",password:String(t.password||genP(t.name)),isMain:!!t.isMain}));
  if(!teachers.some(t=>t.isMain)){const maxTid=teachers.length?Math.max(...teachers.map(t=>t.id)):0;teachers.unshift({id:maxTid+1,name:"Asosiy Admin",subject:"Boshqaruv",password:genP("ADM"),isMain:true});}
  const fallbackTeacherId=(nonMainTeachers()[0]?.id)||teachers.find(t=>t.isMain)?.id||1;
  students=(Array.isArray(d?.students)?d.students:[]).map(s=>({...s,id:nNum(s.id),teacherId:nNum(s.teacherId)||fallbackTeacherId,totalCoins:nNum(s.totalCoins)||0,streak:nNum(s.streak)||0,level:nNum(s.level)||1}));
  txs=(Array.isArray(d?.transactions)?d.transactions:[]).map(t=>({...t,studentId:nNum(t.studentId),amount:nNum(t.amount)||0,timestamp:nNum(t.timestamp)||Date.now(),teacherId:nNum(t.teacherId)||null}));
  const maxId=students.length?Math.max(...students.map(s=>s.id)):0;
  nid=Math.max(nNum(d?.nextStudentId)||1,maxId+1);
  const maxTid=teachers.length?Math.max(...teachers.map(t=>t.id)):0;
  ntid=Math.max(nNum(d?.nextTeacherId)||1,maxTid+1);
  adminPassword=String(d?.adminPassword||DEFAULT_ADMIN_PASSWORD);
  updBadges();
}

async function save(){
  const d={students,transactions:txs,nextStudentId:nid,teachers,nextTeacherId:ntid,adminPassword};
  try{await fetch('/api/data',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(d)});}catch(e){}
  try{localStorage.setItem(SK,JSON.stringify(d));}catch(e){}
}
async function load(){
  try{const res=await fetch('/api/data');if(res.ok){const d=await res.json();if(d&&Array.isArray(d.students)&&Array.isArray(d.transactions))return d;}}catch(e){}
  try{const r=localStorage.getItem(SK);if(r)return JSON.parse(r);}catch(e){}
  return null;
}
function updBadges(){for(const s of students){s.level=~~(s.totalCoins/100)+1;s.badge=s.totalCoins<100?"Starter":s.totalCoins<300?"Active":s.totalCoins<600?"Pro":"Elite";}}
function updTeacherLoginOptions(){
  const tOps=nonMainTeachers().map(t=>`<option value="${t.id}">${escHtml(t.name)} (${escHtml(t.subject)})</option>`).join('');
  document.getElementById('sTeacherSel').innerHTML=`<option value="">-- O'qituvchi tanlang --</option>${tOps}`;
  document.getElementById('tLoginSel').innerHTML=`<option value="">-- O'qituvchi tanlang --</option>${tOps}`;
}
function updStudentLoginOptions(){
  const tid=nNum(document.getElementById('sTeacherSel').value);
  const list=students.filter(s=>s.teacherId===tid);
  const o=list.map(s=>`<option value="${s.id}">${escHtml(s.name)}</option>`).join('');
  document.getElementById('sLoginSel').innerHTML=`<option value="">-- Talaba tanlang --</option>${o}`;
}
function updSels(){
  const vis=manageStudents();
  const stOps=vis.map(s=>`<option value="${s.id}">${escHtml(s.name)} (${s.totalCoins}🪙)</option>`).join('');
  ['aSt','hSt','pSt','rSt','mSt','dSt'].forEach(id=>{const el=document.getElementById(id);if(el)el.innerHTML=stOps;});
  const nsTeacher=document.getElementById('nsTeacher');
  if(isAdmin()){
    nsTeacher.style.display='block';
    nsTeacher.innerHTML=`<option value="">-- O'qituvchi --</option>`+nonMainTeachers().map(t=>`<option value="${t.id}">${escHtml(t.name)} (${escHtml(t.subject)})</option>`).join('');
  }else{nsTeacher.style.display='none';nsTeacher.innerHTML='';}
}

function swTab(t){
  document.getElementById('sLoginForm').style.display=t==='student'?'block':'none';
  document.getElementById('tLoginForm').style.display=t==='teacher'?'block':'none';
  document.getElementById('aLoginForm').style.display=t==='admin'?'block':'none';
  document.getElementById('tabSBtn').classList.toggle('active',t==='student');
  document.getElementById('tabTBtn').classList.toggle('active',t==='teacher');
  document.getElementById('tabABtn').classList.toggle('active',t==='admin');
}
function doSLogin(){
  const sid=nNum(document.getElementById('sLoginSel').value);
  const pwd=document.getElementById('sPwdIn').value;
  if(!sid){toast('Talabani tanlang!','error');return;}
  const s=students.find(x=>x.id===sid);
  if(!s){toast('Talaba topilmadi!','error');return;}
  if(s.password!==pwd){toast('Parol xato!','error');return;}
  curType='student';curId=sid;curTeacherId=s.teacherId;enterS();
}
function doTLogin(){
  const tid=nNum(document.getElementById('tLoginSel').value);
  const pwd=document.getElementById('tPwdIn').value;
  const t=getTeacherById(tid);
  if(!t||t.isMain){toast("O'qituvchini tanlang!",'error');return;}
  if(t.password!==pwd){toast('Parol xato!','error');return;}
  curType='teacher';curTeacherId=t.id;curId=null;enterT();
}
function doALogin(){
  const pwd=document.getElementById('aPwdIn').value;
  if(pwd!==adminPassword){toast('Admin paroli xato!','error');return;}
  curType='admin';curTeacherId=null;curId=null;enterT();
}

function enterS(){
  const s=students.find(x=>x.id===curId);if(!s)return;
  document.getElementById('loginScreen').style.display='none';
  document.getElementById('appShell').style.display='flex';
  document.getElementById('sbAv').textContent=s.name.slice(0,2).toUpperCase();
  document.getElementById('sbNm').textContent=s.name;
  document.getElementById('sbRl').textContent=`${s.badge} · D${s.level}`;
  document.getElementById('sNav').style.display='';
  document.getElementById('tNav').style.display='none';
  document.getElementById('tbRight').innerHTML='';
  renderLb();renderFLb();renderHist();renderProf();
  showPage('dpg',document.querySelector('#sNav .nav-item'));
  startAutoRefresh();
}
function enterT(){
  document.getElementById('loginScreen').style.display='none';
  document.getElementById('appShell').style.display='flex';
  const t=isAdmin()?{name:"Asosiy Admin",subject:"Boshqaruv"}:getTeacherById(curTeacherId);
  document.getElementById('sbAv').textContent=isAdmin()?'AD':(t?.name||'OQ').slice(0,2).toUpperCase();
  document.getElementById('sbNm').textContent=isAdmin()?'Asosiy Admin':(t?.name||"O'qituvchi");
  document.getElementById('sbRl').textContent=isAdmin()?'Super Admin':(t?.subject||"O'qituvchi");
  document.getElementById('sNav').style.display='none';
  document.getElementById('tNav').style.display='';
  document.getElementById('tNavTeachers').style.display=isAdmin()?'':'none';
  document.getElementById('tbRight').innerHTML='';
  renderAD();renderSTbl();renderTeachersPage();updSels();
  showPage('adpg',document.querySelector('#tNav .nav-item'));
  startAutoRefresh();
}
function doLogout(){
  stopAutoRefresh();
  curType=null;curId=null;curTeacherId=null;
  document.getElementById('appShell').style.display='none';
  document.getElementById('loginScreen').style.display='flex';
  ['sPwdIn','tPwdIn','aPwdIn'].forEach(id=>{const el=document.getElementById(id);if(el)el.value='';});
}

let _refreshTimer=null;
function startAutoRefresh(){
  stopAutoRefresh();
  _refreshTimer=setInterval(async()=>{
    if(!curType)return;
    try{
      const d=await load();if(!d)return;
      normalizeData(d);
      if(curType==='student'&&!students.some(s=>s.id===curId)){toast('Hisobingiz topilmadi.','error');doLogout();return;}
      if(curType==='teacher'&&!teachers.some(t=>t.id===curTeacherId&&!t.isMain)){toast("O'qituvchi hisobi topilmadi.",'error');doLogout();return;}
      const activePage=document.querySelector('.page.active')?.id;
      if(activePage==='dpg')renderSD();
      else if(activePage==='rpg'){renderLb();renderFLb();}
      else if(activePage==='hpg')renderHist();
      else if(activePage==='ppg')renderProf();
      else if(activePage==='adpg')renderAD();
      else if(activePage==='stpg')renderSTbl();
      else if(activePage==='tpg')renderTeachersPage();
      updTeacherLoginOptions();updStudentLoginOptions();updSels();
    }catch(e){}
  },30000);
}
function stopAutoRefresh(){if(_refreshTimer){clearInterval(_refreshTimer);_refreshTimer=null;}}

function showPage(pid,el){
  if(pid==='tpg'&&!isAdmin()){toast('Bu sahifa faqat asosiy admin uchun.','error');return;}
  document.querySelectorAll('.page').forEach(p=>p.classList.remove('active'));
  document.getElementById(pid)?.classList.add('active');
  const tmap={dpg:'Bosh sahifa',rpg:'Reyting',hpg:'Faollik tarixi',ppg:'Profilim',adpg:'Statistika',stpg:'Talabalar',cpg:'Tanga boshqaruvi',tpg:"O'qituvchilar"};
  document.getElementById('tbTitle').textContent=tmap[pid]||'';
  document.querySelectorAll('.nav-item').forEach(n=>n.classList.remove('active'));
  if(el)el.classList.add('active');
  if(pid==='dpg')renderSD();
  if(pid==='rpg')renderFLb();
  if(pid==='hpg')renderHist();
  if(pid==='ppg')renderProf();
  if(pid==='stpg')renderSTbl();
  if(pid==='adpg')renderAD();
  if(pid==='tpg')renderTeachersPage();
  if(pid==='cpg')updSels();
  closeSB();
}
function renderSD(){
  if(!curId)return;
  const s=students.find(x=>x.id===curId);if(!s)return;
  const peers=scopeStudents();
  document.getElementById('st_c').textContent=s.totalCoins;
  document.getElementById('st_l').textContent=s.level;
  document.getElementById('st_b').textContent=s.badge;
  document.getElementById('st_s').textContent=s.streak||0;
  document.getElementById('st_r').textContent=`#${rank(curId,'overall')}`;
  document.getElementById('st_rs').textContent=`${peers.length} talabadan`;
  const wk=byModeValue(curId,'weekly');
  document.getElementById('wkf').style.width=Math.min(100,Math.max(0,wk))+'%';
  document.getElementById('wkt').textContent=`${wk}/100`;
  const l7=[];
  for(let i=6;i>=0;i--){let d=new Date();d.setDate(d.getDate()-i);d.setHours(0,0,0,0);l7.push(txs.filter(t=>t.studentId===curId&&t.timestamp>=d.getTime()&&t.timestamp<d.getTime()+86400000).reduce((a,b)=>a+b.amount,0));}
  const ctx=document.getElementById('wkChart').getContext('2d');
  if(chart)chart.destroy();
  chart=new Chart(ctx,{type:'bar',data:{labels:['D-6','D-5','D-4','D-3','D-2','Kecha','Bugun'],datasets:[{label:'Tanga',data:l7,backgroundColor:'rgba(43,125,233,.6)',borderColor:'#2b7de9',borderWidth:1,borderRadius:5}]},options:{responsive:true,plugins:{legend:{display:false}},scales:{x:{grid:{color:'rgba(255,255,255,.04)'},ticks:{color:'#4a5878',font:{size:11}}},y:{grid:{color:'rgba(255,255,255,.04)'},ticks:{color:'#4a5878',font:{size:11}}}}}});
  const ut=txs.filter(t=>t.studentId===curId).slice(0,8);
  document.getElementById('actList').innerHTML=ut.length?ut.map(t=>`<div class="ai"><span class="at">${escHtml(t.details||'Faollik')}</span><span class="ac">${t.amount>=0?'+':''}${t.amount} 🪙</span></div>`).join(''):'<p style="color:var(--text-dim);text-align:center;padding:14px;font-size:13px;">Hozircha faollik yo\'q</p>';
  document.getElementById('tbRight').innerHTML=`<div class="top-badge tb-gold">🪙 ${s.totalCoins}</div><div class="top-badge tb-blue">🔥 ${s.streak||0}</div>`;
}
function renderLb(){const s2=sorted(lbM);document.getElementById('lbList').innerHTML=s2.slice(0,10).map((s,i)=>`<div class="lb-item ${s.id===curId?'me':''}"><div class="lb-rank">${medals[i]||i+1}</div><div class="lb-name">${escHtml(s.name)}${s.id===curId?' <span style="font-size:10px;color:var(--blue-light)">(Siz)</span>':''}</div><div class="lb-score">${s.score}🪙</div></div>`).join('');}
function setLb(mode,btn){lbM=mode;document.querySelectorAll('.lb1').forEach(b=>b.classList.remove('active'));btn.classList.add('active');renderLb();}
function renderFLb(){const s2=sorted(lbM2);document.getElementById('flb').innerHTML=`<table style="width:100%"><thead><tr><th>#</th><th>Ism</th><th>Tanga</th><th>Daraja</th><th>Nishon</th></tr></thead><tbody>`+s2.map((s,i)=>`<tr style="${s.id===curId?'background:rgba(43,125,233,.08);':''}"><td style="font-family:Rajdhani,sans-serif;font-weight:700;color:var(--text-muted);">${medals[i]||i+1}</td><td style="font-weight:${s.id===curId?700:400};color:${s.id===curId?'var(--blue-light)':'var(--text)'};">${escHtml(s.name)}${s.id===curId?' ✓':''}</td><td style="font-family:Rajdhani,sans-serif;font-weight:700;color:var(--gold-mid);">${s.score}</td><td><span class="badge bb">D${s.level}</span></td><td><span class="badge bg">${s.badge}</span></td></tr>`).join('')+`</tbody></table>`;}
function setLb2(mode,btn){lbM2=mode;document.querySelectorAll('.lb2').forEach(b=>b.classList.remove('active'));btn.classList.add('active');renderFLb();}
function renderHist(){if(!curId)return;const ut=txs.filter(t=>t.studentId===curId);const c=document.getElementById('fhist');if(!ut.length){c.innerHTML='<p style="color:var(--text-dim);text-align:center;padding:20px;">Faollik yo\'q</p>';return;}c.innerHTML=ut.map(t=>{const dt=new Date(t.timestamp).toLocaleDateString('uz-UZ',{day:'numeric',month:'short',year:'numeric'});return`<div class="ai"><div><div class="at">${escHtml(t.details||'Faollik')}</div><div style="font-size:10px;color:var(--text-dim);margin-top:2px;">${dt}</div></div><span class="ac">${t.amount>=0?'+':''}${t.amount} 🪙</span></div>`;}).join('');}
function renderProf(){if(!curId)return;const s=students.find(x=>x.id===curId);if(!s)return;document.getElementById('pr_n').textContent=s.name;document.getElementById('pr_l').innerHTML=`<span class="badge bb">Daraja ${s.level}</span>`;document.getElementById('pr_b').innerHTML=`<span class="badge bg">${s.badge}</span>`;document.getElementById('pr_c').textContent=s.totalCoins+' 🪙';document.getElementById('pr_s').textContent=`🔥 ${s.streak||0} kun`;document.getElementById('pr_w').textContent=byModeValue(curId,'weekly')+' 🪙';document.getElementById('pr_m').textContent=byModeValue(curId,'monthly')+' 🪙';document.getElementById('pr_r').textContent=`#${rank(curId,'overall')} / ${scopeStudents().length}`;document.getElementById('pr_rc').textContent=s.refCode||`REF${s.id}`;document.getElementById('sbRl').textContent=`${s.badge} · D${s.level}`;}
function cpRef(){const c=document.getElementById('pr_rc').textContent;navigator.clipboard.writeText(c).then(()=>toast('Nusxalandi: '+c,'success'));}

function renderAD(){
  const vis=manageStudents();
  const visSet=new Set(vis.map(s=>s.id));
  const tc=txs.filter(t=>visSet.has(t.studentId)).reduce((a,b)=>a+b.amount,0);
  const ac=vis.filter(s=>s.lastDailyDate&&((new Date()-new Date(s.lastDailyDate))/864e5<=7)).length;
  const rc=txs.filter(t=>t.reason==='referral'&&visSet.has(t.studentId)).length;
  document.getElementById('ad_t').textContent=vis.length;
  document.getElementById('ad_c').textContent=tc;
  document.getElementById('ad_a').textContent=ac;
  document.getElementById('ad_r').textContent=rc;
  document.getElementById('atop').innerHTML=sorted('overall').slice(0,18).map((s,i)=>`<div class="lb-item"><div class="lb-rank">${medals[i]||i+1}</div><div class="lb-name">${escHtml(s.name)}</div><div class="lb-score">${s.totalCoins}🪙</div></div>`).join('');
}
function renderSTbl(){
  const vis=manageStudents();let h='';
  vis.forEach((s,i)=>{const t=getTeacherById(s.teacherId);const encodedPwd=encodeURIComponent(String(s.password));h+=`<tr><td>${i+1}</td><td style="font-weight:600;">${escHtml(s.name)}</td><td>${escHtml(t?.name||'-')}</td><td style="font-family:Rajdhani,sans-serif;font-weight:700;color:var(--gold-mid);">${s.totalCoins}</td><td><span class="badge bb">D${s.level}</span></td><td><code style="background:var(--bg-deep);padding:2px 8px;border-radius:4px;font-size:12px;border:1px solid var(--border);">******</code><button onclick="cpC(decodeURIComponent('${encodedPwd}'))" class="btn btn-outline btn-sm" style="padding:3px 7px;margin-left:4px;"><i class="fas fa-copy"></i></button></td><td><button onclick="delSt(${s.id})" class="btn btn-danger btn-sm"><i class="fas fa-trash"></i></button></td></tr>`;});
  document.getElementById('stBody').innerHTML=h||'<tr><td colspan="7" style="text-align:center;color:var(--text-dim);padding:18px;">Talabalar yo\'q</td></tr>';
}
async function addSt(){
  if(!isTeacherMode()){toast("Ruxsat yo'q",'error');return;}
  const n=document.getElementById('nsName').value.trim();if(!n){toast('Ism kiriting!','error');return;}
  const teacherId=isAdmin()?nNum(document.getElementById('nsTeacher').value):curTeacherId;
  if(!teacherId||!getTeacherById(teacherId)){toast("O'qituvchini tanlang!",'error');return;}
  const id=nid++;const p=genP(n);
  students.push({id,teacherId,name:n,refCode:`REF${id}${~~(Math.random()*100)}`,password:p,totalCoins:0,streak:0,lastDailyDate:null,level:1,badge:'Starter'});
  await save();document.getElementById('nsName').value='';renderSTbl();updSels();renderAD();updStudentLoginOptions();
  toast(`${n} qo'shildi! Talaba paroli: ${p}`,'success');
}
async function delSt(id){
  if(!confirm("O'chirilsinmi?"))return;
  const numId=nNum(id);const s=students.find(x=>x.id===numId);if(!canManageStudent(s)){toast("Ruxsat yo'q",'error');return;}
  students=students.filter(x=>x.id!==numId);txs=txs.filter(t=>t.studentId!==numId);
  await save();renderSTbl();renderAD();updSels();updStudentLoginOptions();toast("O'chirildi",'success');
}

async function addCoin(sid,amt,reason,details){
  const numSid=nNum(sid);const amount=nNum(amt);const s=students.find(x=>x.id===numSid);
  if(!s){toast('Talaba topilmadi!','error');return false;}
  if(!canManageStudent(s)){toast("Bu talabaga amalingiz yo'q",'error');return false;}
  if(!Number.isFinite(amount)||amount===0){toast("Noto'g'ri miqdor",'error');return false;}
  if(s.totalCoins+amount<0){toast("Talaba tangasi manfiy bo'lib qolmaydi",'error');return false;}
  s.totalCoins+=amount;
  if(amount>0){const td=new Date().toDateString();if(s.lastDailyDate!==td){s.streak=(s.streak||0)+1;s.lastDailyDate=td;}}
  txs.unshift({id:Date.now()+Math.random(),studentId:numSid,teacherId:isTeacherMode()?(curTeacherId||null):null,amount,reason,timestamp:Date.now(),details:details||`${reason} ${amount}`});
  updBadges();await save();return true;
}
async function giveC(reason,selId,rangeId,label){
  const sid=nNum(document.getElementById(selId).value);const amt=parseInt(document.getElementById(rangeId).value,10);
  if(!sid){toast('Talabani tanlang!','error');return;}
  const ok=await addCoin(sid,amt,reason,`${label} uchun ${amt} tanga`);if(!ok)return;
  renderAD();updSels();const sName=students.find(s=>s.id===sid)?.name||'Talaba';toast(`${sName}ga ${amt} tanga berildi!`,'success');
}
async function giveManual(){
  const sid=nNum(document.getElementById('mSt').value);const amt=parseInt(document.getElementById('mAmt').value,10);const r=document.getElementById('mReason').value.trim();
  if(!sid||!amt||!r){toast("To'liq ma'lumot kiriting",'error');return;}
  const ok=await addCoin(sid,amt,'manual_plus',r);if(!ok)return;
  renderAD();updSels();document.getElementById('mAmt').value='';document.getElementById('mReason').value='';const sName=students.find(s=>s.id===sid)?.name||'Talaba';toast(`${sName}ga ${amt} tanga berildi!`,'success');
}
async function deductManual(){
  const sid=nNum(document.getElementById('dSt').value);const amt=parseInt(document.getElementById('dAmt').value,10);const r=document.getElementById('dReason').value.trim();
  if(!sid||!amt||!r){toast("To'liq ma'lumot kiriting",'error');return;}
  const ok=await addCoin(sid,-Math.abs(amt),'manual_minus',`Ayrildi: ${r}`);if(!ok)return;
  renderAD();updSels();document.getElementById('dAmt').value='';document.getElementById('dReason').value='';const sName=students.find(s=>s.id===sid)?.name||'Talaba';toast(`${sName}dan ${Math.abs(amt)} tanga ayirildi!`,'success');
}
async function monthlyBonus(){
  const vis=manageStudents();if(!vis.length){toast("Talaba topilmadi",'error');return;}
  const visSet=new Set(vis.map(s=>s.id));const ms=Date.now()-30*864e5;
  const top=[...vis].map(s=>({...s,earn:txs.filter(t=>t.studentId===s.id&&t.timestamp>=ms&&visSet.has(t.studentId)).reduce((a,b)=>a+b.amount,0)})).sort((a,b)=>b.earn-a.earn)[0];
  if(!top){toast("Talaba topilmadi",'error');return;}
  const ok=await addCoin(top.id,50,'monthly_bonus','Oylik eng yaxshi talaba bonusi');if(!ok)return;
  renderAD();updSels();toast(`${top.name}ga 50 tanga sovg'a!`,'success');
}

async function chgTPwd(){
  if(curType==='teacher'){
    const t=getTeacherById(curTeacherId);if(!t)return;
    const old=prompt("Joriy o'qituvchi paroli:");if(old===null)return;if(old!==t.password){toast('Joriy parol xato!','error');return;}
    const np=prompt("Yangi o'qituvchi paroli:");if(np===null)return;if(np.length<3){toast('Parol kamida 3 belgi','error');return;}
    t.password=np;await save();toast("O'qituvchi paroli yangilandi!",'success');
    return;
  }
  if(curType==='admin'){
    const old=prompt("Joriy admin paroli:");if(old===null)return;if(old!==adminPassword){toast('Joriy admin paroli xato!','error');return;}
    const np=prompt("Yangi admin paroli:");if(np===null)return;if(np.length<4){toast('Parol kamida 4 belgi','error');return;}
    adminPassword=np;await save();toast("Admin paroli yangilandi!",'success');
    return;
  }
  toast("Avval o'qituvchi/admin sifatida kiring",'error');
}

async function doChgPwd(){
  const s=students.find(x=>x.id===curId);if(!s){toast('Foydalanuvchi topilmadi!','error');return;}
  const o=document.getElementById('oldP').value,n=document.getElementById('newP').value,c=document.getElementById('cnfP').value;
  if(o!==s.password){toast('Eski parol xato!','error');return;}
  if(n.length<3){toast('Parol kamida 3 belgi','error');return;}
  if(n!==c){toast('Parollar mos emas','error');return;}
  s.password=n;await save();closeModal('cpModal');toast('Parol yangilandi!','success');['oldP','newP','cnfP'].forEach(id=>document.getElementById(id).value='');
}

async function addTeacher(){
  if(!isAdmin()){toast("Faqat admin qo'sha oladi",'error');return;}
  const n=document.getElementById('ntName').value.trim();const sub=document.getElementById('ntSubj').value.trim();
  if(!n||!sub){toast("Ism va fan kiriting",'error');return;}
  const p=genP(n);teachers.push({id:ntid++,name:n,subject:sub,password:p,isMain:false});
  await save();document.getElementById('ntName').value='';document.getElementById('ntSubj').value='';
  renderTeachersPage();updTeacherLoginOptions();updSels();toast(`${n} qo'shildi. O'qituvchi paroli: ${p}`,'success');
}
async function resetTeacherPwd(id){
  if(!isAdmin()){toast("Faqat admin",'error');return;}
  const t=getTeacherById(id);if(!t||t.isMain){toast("Bu o'qituvchi uchun mumkin emas",'error');return;}
  const p=genP(t.name);t.password=p;await save();toast(`${t.name} yangi parol: ${p}`,'success');
}
async function delTeacher(id){
  if(!isAdmin()){toast("Faqat admin",'error');return;}
  const t=getTeacherById(id);if(!t||t.isMain){toast("Asosiy adminni o'chirib bo'lmaydi",'error');return;}
  if(students.some(s=>s.teacherId===t.id)){toast("Avval shu o'qituvchining talabalarini boshqa o'qituvchiga o'tkazing",'error');return;}
  if(!confirm("O'qituvchi o'chirilsinmi?"))return;
  teachers=teachers.filter(x=>x.id!==t.id);await save();renderTeachersPage();updTeacherLoginOptions();updSels();toast("O'qituvchi o'chirildi",'success');
}
function renderTeachersPage(){
  const el=document.getElementById('tBody');if(!el)return;
  if(!isAdmin()){el.innerHTML='<tr><td colspan="5" style="text-align:center;color:var(--text-dim);padding:18px;">Faqat admin ko\'ra oladi</td></tr>';return;}
  const rows=nonMainTeachers().map((t,i)=>{const cnt=students.filter(s=>s.teacherId===t.id).length;return`<tr><td>${i+1}</td><td style="font-weight:600;">${escHtml(t.name)}</td><td>${escHtml(t.subject)}</td><td>${cnt}</td><td><button class="btn btn-outline btn-sm" onclick="resetTeacherPwd(${t.id})"><i class="fas fa-key"></i> Parol reset</button> <button class="btn btn-danger btn-sm" onclick="delTeacher(${t.id})"><i class="fas fa-trash"></i></button></td></tr>`;}).join('');
  el.innerHTML=rows||'<tr><td colspan="5" style="text-align:center;color:var(--text-dim);padding:18px;">O\'qituvchilar yo\'q</td></tr>';
}

window.delSt=delSt;
window.cpC=t=>{navigator.clipboard.writeText(t).then(()=>toast('Nusxalandi: '+t,'success'));};
window.updStudentLoginOptions=updStudentLoginOptions;
window.addTeacher=addTeacher;
window.resetTeacherPwd=resetTeacherPwd;
window.delTeacher=delTeacher;

function openModal(id){document.getElementById(id).classList.add('open');}
function closeModal(id){document.getElementById(id).classList.remove('open');}
function toast(msg,type='info'){const c=document.getElementById('tc');const t=document.createElement('div');t.className=`toast ${type}`;t.textContent=msg;c.appendChild(t);setTimeout(()=>t.remove(),3500);}
function toggleSB(){document.getElementById('sidebar').classList.toggle('open');document.getElementById('sbBg').classList.toggle('open');}
function closeSB(){document.getElementById('sidebar').classList.remove('open');document.getElementById('sbBg').classList.remove('open');}

let dp=null;
window.addEventListener('beforeinstallprompt',e=>{e.preventDefault();dp=e;document.getElementById('installBanner').classList.add('show');});
document.getElementById('installBtn').addEventListener('click',async()=>{if(!dp)return;dp.prompt();const{outcome}=await dp.userChoice;dp=null;document.getElementById('installBanner').classList.remove('show');if(outcome==='accepted')toast('Ilova o\'rnatildi!','success');});
document.getElementById('installDismiss').addEventListener('click',()=>document.getElementById('installBanner').classList.remove('show'));
if('serviceWorker' in navigator){navigator.serviceWorker.register('/sw.js').catch(()=>{});}
const mf={name:"Teacher_texno",short_name:"T_texno",start_url:"./",display:"standalone",background_color:"#1a2235",theme_color:"#1a2235",orientation:"portrait-primary",icons:[{src:"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 192 192'%3E%3Crect fill='%231a2235' width='192' height='192' rx='38'/%3E%3Cpolygon points='96,12 172,52 172,140 96,180 20,140 20,52' fill='none' stroke='%23c8a020' stroke-width='6'/%3E%3Ctext x='96' y='112' font-size='52' font-family='Arial' font-weight='bold' fill='%232b7de9' text-anchor='middle'%3ETT%3C/text%3E%3C/svg%3E",sizes:"192x192",type:"image/svg+xml"},{src:"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 512 512'%3E%3Crect fill='%231a2235' width='512' height='512' rx='100'/%3E%3Cpolygon points='256,30 460,140 460,372 256,482 52,372 52,140' fill='none' stroke='%23c8a020' stroke-width='12'/%3E%3Ctext x='256' y='296' font-size='130' font-family='Arial' font-weight='bold' fill='%232b7de9' text-anchor='middle'%3ETT%3C/text%3E%3C/svg%3E",sizes:"512x512",type:"image/svg+xml"}]};
const ml=document.createElement('link');ml.rel='manifest';ml.href=URL.createObjectURL(new Blob([JSON.stringify(mf)],{type:'application/json'}));document.head.appendChild(ml);

document.addEventListener('keydown',e=>{if(e.key!=='Enter')return;const ls=document.getElementById('loginScreen');if(!ls||ls.style.display==='none')return;if(document.getElementById('sLoginForm').style.display!=='none')doSLogin();else if(document.getElementById('tLoginForm').style.display!=='none')doTLogin();else doALogin();});

async function init(){
  await new Promise(r=>setTimeout(r,1400));
  const d=await load();
  if(d)normalizeData(d);else{mkDef();await save();}
  updTeacherLoginOptions();updStudentLoginOptions();updSels();
  document.getElementById('loadingOverlay').style.opacity='0';
  setTimeout(()=>document.getElementById('loadingOverlay').style.display='none',500);
}
init();
