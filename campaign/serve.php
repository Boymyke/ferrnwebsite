<?php
declare(strict_types=1);
require_once __DIR__.'/../lib/campaigns.php';
$slug=(string)($_GET['slug']??'');$file=(string)($_GET['path']??'');
$slug=strtolower($slug);
if(!preg_match('/^[a-z][a-z0-9-]{2,58}$/D',$slug)||in_array($slug,ferrn_campaign_reserved(),true)){http_response_code(404);require __DIR__.'/../404.php';exit;}
$campaign=null;foreach(ferrn_campaigns() as $entry)if(($entry['slug']??'')===$slug&&!empty($entry['active'])){$campaign=$entry;break;}
if(!$campaign){http_response_code(404);require __DIR__.'/../404.php';exit;}
$file=trim($file,'/');
if($file==='')$file='index.html';
if(!preg_match('~^[A-Za-z0-9_./-]+$~D',$file)||str_contains($file,'..')||str_starts_with($file,'.')){http_response_code(404);exit;}
$ext=strtolower(pathinfo($file,PATHINFO_EXTENSION));
$types=['html'=>'text/html','htm'=>'text/html','css'=>'text/css','js'=>'text/javascript','mjs'=>'text/javascript','json'=>'application/json','txt'=>'text/plain','svg'=>'image/svg+xml','png'=>'image/png','jpg'=>'image/jpeg','jpeg'=>'image/jpeg','gif'=>'image/gif','webp'=>'image/webp','ico'=>'image/x-icon','woff'=>'font/woff','woff2'=>'font/woff2','ttf'=>'font/ttf','pdf'=>'application/pdf','webmanifest'=>'application/manifest+json','mp4'=>'video/mp4','webm'=>'video/webm'];
if(!isset($types[$ext])){http_response_code(404);exit;}
$root=realpath(ferrn_campaign_root().'/'.$slug);$requested=$root?realpath($root.'/'.$file):false;
if(!$root||!$requested||!str_starts_with($requested,$root.DIRECTORY_SEPARATOR)||!is_file($requested)){http_response_code(404);exit;}
header('Content-Type: '.$types[$ext].($ext==='html'||$ext==='css'||$ext==='js'?'; charset=utf-8':''));
header('X-Content-Type-Options: nosniff');header('Referrer-Policy: strict-origin-when-cross-origin');header('Cache-Control: private, no-store');header('X-Frame-Options: SAMEORIGIN');
header('Content-Length: '.filesize($requested));readfile($requested);
