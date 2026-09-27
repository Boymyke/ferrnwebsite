<?php
declare(strict_types=1);
require_once __DIR__.'/../lib/platform.php';
if($_SERVER['REQUEST_METHOD']!=='POST') ferrn_json_response(['ok'=>false,'message'=>'Method not allowed'],405);
$required=['company','name','email','country','project_type','services','description'];
foreach($required as $key){if(trim((string)($_POST[$key]??''))==='') ferrn_json_response(['ok'=>false,'message'=>'Please complete all required fields.'],422);}
$email=filter_var((string)$_POST['email'],FILTER_VALIDATE_EMAIL);
if(!$email) ferrn_json_response(['ok'=>false,'message'=>'Use a valid work email.'],422);
$uploadDir=ferrn_storage_dir().'/rfp_uploads'; if(!is_dir($uploadDir)) @mkdir($uploadDir,0750,true);
function save_rfp_upload(string $key,string $dir):?array{
  if(empty($_FILES[$key])||($_FILES[$key]['error']??UPLOAD_ERR_NO_FILE)===UPLOAD_ERR_NO_FILE)return null;
  $f=$_FILES[$key]; if(($f['error']??UPLOAD_ERR_OK)!==UPLOAD_ERR_OK)return null;
  if(($f['size']??0)>15*1024*1024)return null;
  $ext=strtolower(pathinfo((string)$f['name'],PATHINFO_EXTENSION));
  $allowed=['pdf','doc','docx','txt','xls','xlsx','csv','ppt','pptx','zip']; if(!in_array($ext,$allowed,true))return null;
  $name=date('Ymd-His').'-'.bin2hex(random_bytes(4)).'.'.$ext;
  if(!move_uploaded_file((string)$f['tmp_name'],$dir.'/'.$name))return null;
  @chmod($dir.'/'.$name,0640);
  return ['original_name'=>basename((string)$f['name']),'stored_name'=>$name,'size'=>(int)$f['size']];
}
$record=[
'id'=>ferrn_item_id(),'created_at'=>date(DATE_ATOM),'status'=>'new',
'company'=>ferrn_safe_text((string)$_POST['company'],180),'name'=>ferrn_safe_text((string)$_POST['name'],180),'email'=>$email,
'phone'=>ferrn_safe_text((string)($_POST['phone']??''),80),'country'=>ferrn_safe_text((string)$_POST['country'],120),
'project_type'=>ferrn_safe_text((string)$_POST['project_type'],180),'budget'=>ferrn_safe_text((string)($_POST['budget']??''),120),
'description'=>ferrn_safe_text((string)$_POST['description'],12000),'services'=>ferrn_safe_text((string)$_POST['services'],1500),
'launch_date'=>ferrn_safe_text((string)($_POST['launch_date']??''),40),'procurement_deadline'=>ferrn_safe_text((string)($_POST['procurement_deadline']??''),40),
'rfp_reference'=>ferrn_safe_text((string)($_POST['rfp_reference']??''),120),
'rfp_file'=>save_rfp_upload('rfp_file',$uploadDir),'supporting_file'=>save_rfp_upload('supporting_file',$uploadDir)
];
$items=ferrn_collection('rfps'); array_unshift($items,$record); ferrn_save_collection('rfps',$items);
ferrn_json_response(['ok'=>true,'id'=>$record['id']]);
