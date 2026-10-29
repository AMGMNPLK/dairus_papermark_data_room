import bcrypt from "bcryptjs";
export const checkPassword = async (password:string,hash:string)=>
  typeof password==="string" && password.length<=256 && /^\$2[aby]\$/.test(hash) && await bcrypt.compare(password,hash);
// Legacy encrypted passwords are deliberately unsupported in this new empty
// workspace. The preserved installation has not been changed or reset.
export const decryptEncrpytedPassword = (_password:string):string=>{throw new Error("Legacy password format is unavailable");};
export const log = (_details:unknown)=>console.error(JSON.stringify({event:"viewer-request-failed"}));
