<?php
declare(strict_types=1);
require_once __DIR__.'/../lib/platform.php';
if($_SERVER['REQUEST_METHOD']!=='POST') ferrn_json_response(['ok'=>false],405);
$raw=file_get_contents('php://input'); $body=json_decode($raw?:'{}',true); if(!is_array($body))$body=[];
$type=(string)($body['type']??'pageview'); if(!in_array($type,['pageview','click','conversion','chat_open','rfp_start'],true))$type='pageview';
$record=[
'id'=>ferrn_item_id(),'created_at'=>date(DATE_ATOM),'type'=>$type,
'session'=>substr(preg_replace('/[^a-zA-Z0-9_-]/','',(string)($body['session']??''))??'',0,80),
'path'=>ferrn_safe_text((string)($body['path']??''),500),'target'=>ferrn_safe_text((string)($body['target']??''),500),
'referrer'=>ferrn_safe_text((string)($body['referrer']??''),800),'device'=>ferrn_safe_text((string)($body['device']??''),80),
'country'=>ferrn_safe_text((string)($_SERVER['HTTP_CF_IPCOUNTRY']??'Unknown'),80)
];
$events=ferrn_collection('analytics'); array_unshift($events,$record); if(count($events)>25000)$events=array_slice($events,0,25000); ferrn_save_collection('analytics',$events);
ferrn_json_response(['ok'=>true]);
