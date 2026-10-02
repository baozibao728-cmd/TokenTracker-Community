import { createAdminClient } from "npm:@insforge/sdk@1.4.5";
import { readCommunityLimits } from "../config.mjs";
import { resolveServerCredential } from "../../edge/server-credential.ts";

type Operation = "create-community" | "join-community" | "leave-community" | "community-detail" | "community-leaderboard"
  | "create-community-transfer" | "accept-community-transfer" | "reject-community-transfer" | "delete-community";
type Fields = Record<string, unknown>;
const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  "Access-Control-Allow-Headers": "Authorization, Content-Type",
};
class InputError extends Error {}
class ConfigurationError extends Error {}
class PayloadTooLarge extends Error {}
function json(value: unknown, status = 200, extra: Record<string,string> = {}) {
  return new Response(JSON.stringify(value), {status,headers:{...cors,"Content-Type":"application/json","Cache-Control":"no-store",...extra}});
}
function error(code: string, status: number, extra: Record<string,string> = {}) {
  return json({ok:false,error:{code}},status,extra);
}
function object(value: unknown): Fields {
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new InputError();
  return value as Fields;
}
function allowFields(fields: Fields, allowed: string[]) {
  if (Object.keys(fields).some(key=>!allowed.includes(key))) throw new InputError();
}
function uuid(value: unknown): string {
  if(typeof value!=="string" || !uuidPattern.test(value)) throw new InputError();
  return value.toLowerCase();
}
function text(value: unknown, max: number, trim = false): string {
  if(typeof value!=="string") throw new InputError();
  const result=trim ? value.trim() : value;
  if(!result || Array.from(result).length>max) throw new InputError();
  return result;
}
function pageNumber(value: unknown, fallback: number, minimum: number, maximum: number): number {
  if(value===undefined) return fallback;
  if(typeof value!=="string" || !/^(0|[1-9]\d*)$/.test(value)) throw new InputError();
  const n=Number(value);
  if(!Number.isInteger(n) || n<minimum || n>maximum) throw new InputError();
  return n;
}
async function requestFields(req: Request, get: boolean): Promise<Fields> {
  const url=new URL(req.url), fields: Fields={};
  if(get) {
    for(const [name,value] of url.searchParams) {
      if(Object.hasOwn(fields,name)) throw new InputError();
      Object.defineProperty(fields,name,{value,enumerable:true});
    }
    return fields;
  }
  if(url.search) throw new InputError();
  if(!/^application\/json(?:\s*;|$)/i.test(req.headers.get("Content-Type") || "")) throw new InputError();
  if(!req.body) throw new InputError();
  const reader=req.body.getReader(), chunks: Uint8Array[]=[];
  let length=0;
  try {
    for(;;) {
      const next=await reader.read(); if(next.done) break;
      length+=next.value.byteLength;
      if(length>16384) {await reader.cancel(); throw new PayloadTooLarge();}
      chunks.push(next.value);
    }
  } finally {reader.releaseLock();}
  const bytes=new Uint8Array(length); let offset=0;
  for(const chunk of chunks) {bytes.set(chunk,offset);offset+=chunk.byteLength;}
  try {return object(JSON.parse(new TextDecoder("utf-8",{fatal:true}).decode(bytes)));}
  catch {throw new InputError();}
}
function decode(segment: string): Uint8Array<ArrayBuffer> {
  if(!/^[A-Za-z0-9_-]+$/.test(segment)) throw new InputError();
  const raw=atob(segment.replace(/-/g,"+").replace(/_/g,"/")+"=".repeat((4-segment.length%4)%4));
  return Uint8Array.from(raw,char=>char.charCodeAt(0));
}
let keyPem: string | undefined;
let verificationKey: CryptoKey | undefined;
async function actorFromJwt(req: Request): Promise<string|null> {
  const auth=req.headers.get("Authorization") || "";
  const match=/^Bearer ([A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+)$/i.exec(auth);
  if(!match || auth.length>16384) return null;
  const [head,body,signature]=match[1].split(".");
  let header: Fields, payload: Fields;
  try {
    header=object(JSON.parse(new TextDecoder().decode(decode(head))));
    payload=object(JSON.parse(new TextDecoder().decode(decode(body))));
    if(header.alg!=="RS256" || (header.typ!==undefined && header.typ!=="JWT")) return null;
    const now=Date.now()/1000;
    if(typeof payload.exp!=="number" || !Number.isInteger(payload.exp) || payload.exp<=now) return null;
    for(const field of ["nbf","iat"]) if(payload[field]!==undefined
      && (typeof payload[field]!=="number" || !Number.isInteger(payload[field]) || payload[field]>now)) return null;
    if(payload.role!==undefined && payload.role!=="authenticated") return null;
    if(typeof payload.sub!=="string" || !uuidPattern.test(payload.sub)) return null;
  } catch {return null;}
  const pem=Deno.env.get("JWT_PUBLIC_KEY");
  if(!pem) throw new ConfigurationError();
  if(pem!==keyPem || !verificationKey) {
    try {
      if(!/^\s*-----BEGIN PUBLIC KEY-----[\s\S]+-----END PUBLIC KEY-----\s*$/.test(pem)) throw new Error();
      const raw=atob(pem.replace(/-----BEGIN PUBLIC KEY-----|-----END PUBLIC KEY-----|\s/g,""));
      verificationKey=await crypto.subtle.importKey("spki",Uint8Array.from(raw,c=>c.charCodeAt(0)),
        {name:"RSASSA-PKCS1-v1_5",hash:"SHA-256"},false,["verify"]);
      keyPem=pem;
    } catch {throw new ConfigurationError();}
  }
  try {
    const valid=await crypto.subtle.verify("RSASSA-PKCS1-v1_5",verificationKey,decode(signature),new TextEncoder().encode(`${head}.${body}`));
    return valid ? (payload.sub as string).toLowerCase() : null;
  } catch {return null;}
}
function serverConfig() {
  const service=resolveServerCredential();
  const base=Deno.env.get("INSFORGE_BASE_URL")?.trim();
  if(!service || service.startsWith("uak_") || !base) throw new ConfigurationError();
  try {
    const url=new URL(base);
    if(url.protocol!=="https:" || url.username || url.password || url.search || url.hash || (url.pathname!=="/" && url.pathname!=="")) throw new Error();
    return {baseUrl:url.origin,service,limits:readCommunityLimits(name=>Deno.env.get(name))};
  } catch {throw new ConfigurationError();}
}
function blockedUsers(): string[] {
  const values=(Deno.env.get("LEADERBOARD_BLOCKED_USER_IDS") || "").split(",").map(v=>v.trim()).filter(Boolean);
  if(values.some(v=>!uuidPattern.test(v))) throw new ConfigurationError();
  return [...new Set(values.map(v=>v.toLowerCase()))];
}
async function execute(op: Operation, actor: string, fields: Fields, config: ReturnType<typeof serverConfig>) {
  // No cookies, caller API key, user JWT or anon credential enters this client.
  const admin=createAdminClient({baseUrl:config.baseUrl,apiKey:config.service});
  const p_actor=actor, p_limits=config.limits;
  switch(op) {
    case "create-community": {
      allowFields(fields,["name","description"]);
      const p_name=text(fields.name,100,true);
      let p_description: string|null=null;
      if(fields.description!==undefined && fields.description!==null) {
        if(typeof fields.description!=="string" || Array.from(fields.description).length>2000) throw new InputError();
        p_description=fields.description;
      }
      return admin.database.rpc("community_create",{p_actor,p_name,p_description,p_limits});
    }
    case "join-community": {
      allowFields(fields,["invite_code"]);
      const p_invite_code=text(fields.invite_code,64,true).toUpperCase();
      if(!/^[A-F0-9]{32}$/.test(p_invite_code)) throw new InputError();
      return admin.database.rpc("community_join",{p_actor,p_invite_code,p_limits});
    }
    case "leave-community": {
      allowFields(fields,["community_id"]);
      const p_community_id=uuid(fields.community_id);
      return admin.database.rpc("community_leave",{p_actor,p_community_id});
    }
    case "community-detail": {
      allowFields(fields,["community_id","limit","offset"]);
      const p_community_id=fields.community_id===undefined ? null : uuid(fields.community_id);
      const p_limit=pageNumber(fields.limit,50,1,100), p_offset=pageNumber(fields.offset,0,0,2147483647);
      return admin.database.rpc("community_read",{p_actor,p_limits,p_community_id,p_limit,p_offset});
    }
    case "community-leaderboard": {
      allowFields(fields,["community_id","period","limit","offset"]);
      const p_community_id=uuid(fields.community_id), p_period=fields.period ?? "week";
      if(p_period!=="week" && p_period!=="month" && p_period!=="total") throw new InputError();
      const p_limit=pageNumber(fields.limit,50,1,100), p_offset=pageNumber(fields.offset,0,0,2147483647);
      const p_excluded_user_ids=blockedUsers();
      return admin.database.rpc("community_leaderboard",{p_actor,p_community_id,p_period,p_limit,p_offset,p_excluded_user_ids});
    }
    case "create-community-transfer": {
      allowFields(fields,["community_id","to_user_id"]);
      const p_community_id=uuid(fields.community_id), p_to_user_id=uuid(fields.to_user_id);
      return admin.database.rpc("community_create_transfer",{p_actor,p_community_id,p_to_user_id});
    }
    case "accept-community-transfer": {
      allowFields(fields,["request_id"]);
      const p_request_id=uuid(fields.request_id);
      return admin.database.rpc("community_accept_transfer",{p_actor,p_request_id,p_limits});
    }
    case "reject-community-transfer": {
      allowFields(fields,["request_id"]);
      const p_request_id=uuid(fields.request_id);
      return admin.database.rpc("community_reject_transfer",{p_actor,p_request_id});
    }
    case "delete-community": {
      allowFields(fields,["community_id","confirmation_name"]);
      const p_community_id=uuid(fields.community_id), p_confirmation_name=text(fields.confirmation_name,100);
      return admin.database.rpc("community_delete",{p_actor,p_community_id,p_confirmation_name});
    }
  }
}
const businessStatuses: Record<string,number> = {
  COMMUNITY_UNAVAILABLE:404, TRANSFER_UNAVAILABLE:404, TRANSFER_EXPIRED:410,
  OWNED_LIMIT:409, JOINED_LIMIT:409, MEMBER_LIMIT:409, OWNER_CANNOT_LEAVE:409,
  TRANSFER_PENDING:409, TRANSFER_NOT_PENDING:409, TARGET_NOT_MEMBER:409,
  INVALID_INPUT:400, INVALID_TARGET:400, INVALID_PAGINATION:400, INVALID_PERIOD:400, CONFIRMATION_REQUIRED:400,
};
export function makeCommunityHandler(op: Operation) {
  const get=op==="community-detail" || op==="community-leaderboard";
  return async function(req: Request): Promise<Response> {
    if(req.method==="OPTIONS") return new Response(null,{status:204,headers:cors});
    try {
      const actor=await actorFromJwt(req);
      if(!actor) return error("UNAUTHORIZED",401);
      if(req.method!==(get ? "GET" : "POST")) return error("METHOD_NOT_ALLOWED",405,{Allow:`${get ? "GET" : "POST"}, OPTIONS`});
      const config=serverConfig();
      const fields=await requestFields(req,get);
      const result=await execute(op,actor,fields,config);
      if(result.error) {
        if(result.error.code==="28000") return error("AUTH_USER_UNAVAILABLE",401);
        return error("DATABASE_ERROR",500);
      }
      if(!result.data || typeof result.data!=="object" || Array.isArray(result.data)) return error("DATABASE_ERROR",500);
      const data=result.data as Fields;
      if(data.ok===false) {
        if(!data.error || typeof data.error!=="object" || Array.isArray(data.error)) return error("DATABASE_ERROR",500);
        const code=(data.error as Fields).code;
        if(typeof code!=="string" || !Object.hasOwn(businessStatuses,code)) return error("DATABASE_ERROR",500);
        return error(code,businessStatuses[code]);
      }
      if(data.ok!==true) return error("DATABASE_ERROR",500);
      return json(data,op==="create-community" || op==="create-community-transfer" ? 201 : 200);
    } catch(e) {
      if(e instanceof PayloadTooLarge) return error("REQUEST_TOO_LARGE",413);
      if(e instanceof ConfigurationError) return error("SERVER_MISCONFIGURED",500);
      if(e instanceof InputError) return error("INVALID_INPUT",400);
      // Never echo SDK/SQL errors, requests, tokens or secret-bearing exceptions.
      return error("INTERNAL_ERROR",500);
    }
  };
}
