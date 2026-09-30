<?php
declare(strict_types=1);
require_once __DIR__.'/../lib/public-media.php';
$name=(string)($_GET['name']??'');
if(!preg_match('/^[a-f0-9]{40}\.(pdf|png|jpg|webp)$/D',$name)){http_response_code(404);exit;}
$ext=strtolower(pathinfo($name,PATHINFO_EXTENSION));$mime=['pdf'=>'application/pdf','jpg'=>'image/jpeg','png'=>'image/png','webp'=>'image/webp'][$ext]??'application/octet-stream';
$path=ferrn_media_root().'/'.$name;
if(!is_file($path)){http_response_code(404);exit;}
header('Content-Type: '.$mime);header('X-Content-Type-Options: nosniff');header('Cache-Control: public,max-age=86400');
header('Content-Disposition: inline; filename="ferrn-asset.'.$ext.'"');
header('Content-Length: '.filesize($path));readfile($path);
