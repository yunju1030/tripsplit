export const PASSWORD_HINT='8~128자, 영문·숫자·특수문자 중 2종류 이상을 조합해 주세요.';
export function validPassword(password){
  if(typeof password!=='string'||password.length<8||password.length>128)return false;
  const kinds=[/[A-Za-z]/,/[0-9]/,/[\x21-\x2f\x3a-\x40\x5b-\x60\x7b-\x7e]/].filter(pattern=>pattern.test(password)).length;
  return kinds>=2;
}
