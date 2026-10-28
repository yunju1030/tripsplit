export async function accountRequest(path,body) {
  let response;
  try{response=await fetch(`/api/auth/${path}`,{method:body===undefined?'GET':'POST',credentials:'same-origin',cache:'no-store',headers:{'Content-Type':'application/json','X-Requested-With':'TripSplit'},...(body===undefined?{}:{body:JSON.stringify(body)})});}
  catch{throw Error('서버에 연결하지 못했습니다. 잠시 후 다시 시도해 주세요.');}
  const data=await response.json();if(!response.ok)throw Error(data.error||'계정을 확인하지 못했습니다.');return data;
}
export function renderAccount(app,register,onSuccess) {
  app.innerHTML=`<div class="wrap"><section class="card account-card"><span class="tag">나만의 여행 기록</span><h1>${register?'간단하게 시작하기':'다시 만나 반가워요'}</h1><p class="muted">${register?'아이디와 비밀번호만 만들면 준비 끝!':'같은 계정으로 로그인하면 저장한 여행을 불러와요.'}</p><form id="account-form"><label class="field">아이디<input name="username" required pattern="[a-zA-Z0-9][a-zA-Z0-9._-]{3,39}" minlength="4" maxlength="40" autocomplete="username" autocapitalize="none" spellcheck="false" placeholder="영문·숫자·._- 4~40자"></label><label class="field">비밀번호<input name="password" type="password" required minlength="12" maxlength="128" autocomplete="${register?'new-password':'current-password'}" placeholder="12자 이상 입력해 주세요"></label><p id="account-error" class="error" role="alert" hidden></p><button type="submit" class="btn primary" style="width:100%">${register?'가입하고 시작하기':'로그인'}</button></form><p class="account-switch">${register?'이미 계정이 있나요? <a href="#login">로그인</a>':'처음 오셨나요? <a href="#signup">간단 회원가입</a>'}</p><a class="back" href="#home">← 서비스 소개</a></section></div>`;
  const form=document.querySelector('#account-form');
  form.onsubmit=async event=>{
    event.preventDefault();const button=form.querySelector('[type=submit]');if(button.disabled)return;button.disabled=true;
    const error=form.querySelector('#account-error');error.hidden=true;
    try{const data=await accountRequest(register?'register':'login',{username:form.elements.username.value,password:form.elements.password.value});form.reset();await onSuccess(data.user);}
    catch(err){error.textContent=err.message;error.hidden=false;}
    finally{button.disabled=false;}
  };
}
