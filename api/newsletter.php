<?php
declare(strict_types=1);
require_once __DIR__.'/../lib/platform.php';
if($_SERVER['REQUEST_METHOD']!=='POST') ferrn_json_response(['ok'=>false],405);
$email=strtolower(trim((string)($_POST['email']??''))); if(!filter_var($email,FILTER_VALIDATE_EMAIL))ferrn_json_response(['ok'=>false,'message'=>'Enter a valid email.'],422);
$list=ferrn_collection('newsletter'); foreach($list as $item){if(($item['email']??'')===$email)ferrn_json_response(['ok'=>true,'message'=>'Already subscribed.']);}
$list[]=['id'=>ferrn_item_id(),'email'=>$email,'name'=>ferrn_safe_text((string)($_POST['name']??''),120),'source'=>ferrn_safe_text((string)($_POST['source']??'website'),80),'created_at'=>date(DATE_ATOM),'status'=>'subscribed'];
ferrn_save_collection('newsletter',$list); ferrn_json_response(['ok'=>true]);
