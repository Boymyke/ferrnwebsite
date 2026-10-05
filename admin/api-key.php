<?php
declare(strict_types=1);
if(session_status()!==PHP_SESSION_ACTIVE)session_start();
require_once __DIR__.'/../lib/admin-users.php';
require_once __DIR__.'/../lib/platform.php';
require_once __DIR__.'/../lib/private-secrets.php';
header('Content-Type: application/json; charset=utf-8');
header('Cache-Control: no-store, max-age=0');
$user=ferrn_current_admin();
if(!$user){http_response_code(401);echo json_encode(['ok'=>false,'message'=>'Sign in again.']);exit;}
if(($user['role']??'')!=='super'){http_response_code(403);echo json_encode(['ok'=>false,'message'=>'Super administrator only.']);exit;}
function api_reply(array $data,int $status=200):never{http_response_code($status);echo json_encode($data,JSON_UNESCAPED_SLASHES|JSON_UNESCAPED_UNICODE);exit;}
function api_mask_source(string $source):string{return $source==='environment'?'Hosting environment variable':($source==='encrypted_storage'?'Encrypted private storage':'Not configured');}
if($_SERVER['REQUEST_METHOD']==='GET'){
 $source=ferrn_api_key_source();$settings=ferrn_settings();
 api_reply(['ok'=>true,'configured'=>$source!=='none','source'=>$source,'source_label'=>api_mask_source($source),'model'=>$settings['ai']['text_model']??'gpt-6-luna']);
}
if($_SERVER['REQUEST_METHOD']!=='POST')api_reply(['ok'=>false,'message'=>'Method not allowed.'],405);
$csrf=(string)($_POST['csrf']??'');
if(empty($_SESSION['csrf'])||!hash_equals((string)$_SESSION['csrf'],$csrf))api_reply(['ok'=>false,'message'=>'Your admin session expired. Refresh the page and try again.'],403);
$key=trim((string)($_POST['api_key']??''));
if(!preg_match('/^sk-[A-Za-z0-9_\-]{20,}$/',$key))api_reply(['ok'=>false,'message'=>'Enter a valid OpenAI API key.'],422);
/* Validate the key with the same Responses API the public chatbot uses. */
$payload=['model'=>'gpt-6-luna','input'=>'Reply with exactly OK.','max_output_tokens'=>8];
$ch=curl_init('https://api.openai.com/v1/responses');
if(!$ch)api_reply(['ok'=>false,'message'=>'PHP cURL is unavailable on this server. Enable cURL in cPanel/PHP Selector.'],500);
curl_setopt_array($ch,[CURLOPT_POST=>true,CURLOPT_RETURNTRANSFER=>true,CURLOPT_HTTPHEADER=>['Authorization: Bearer '.$key,'Content-Type: application/json'],CURLOPT_POSTFIELDS=>json_encode($payload),CURLOPT_TIMEOUT=>25,CURLOPT_CONNECTTIMEOUT=>10]);
$raw=curl_exec($ch);$curlError=curl_error($ch);$status=(int)curl_getinfo($ch,CURLINFO_RESPONSE_CODE);curl_close($ch);
if($raw===false||$curlError!=='')api_reply(['ok'=>false,'message'=>'Could not reach OpenAI from the server: '.$curlError],502);
$data=json_decode((string)$raw,true);
if($status<200||$status>=300){$detail=(string)($data['error']['message']??'OpenAI rejected the key or model request.');api_reply(['ok'=>false,'message'=>$detail,'status'=>$status],422);}
try{ferrn_store_api_key($key);}catch(Throwable $e){api_reply(['ok'=>false,'message'=>$e->getMessage()],500);}
$source=ferrn_api_key_source();
api_reply(['ok'=>true,'configured'=>true,'source'=>$source,'source_label'=>api_mask_source($source),'message'=>$source==='environment'?'The key was saved, but your cPanel OPENAI_API_KEY environment variable currently takes precedence.':'API key saved and verified successfully.']);
