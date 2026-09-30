<?php
declare(strict_types=1);
require_once __DIR__.'/platform.php';
/* Public assets stay outside document root; only generated names can be fetched. */
function ferrn_media_root():string {
    $root=ferrn_storage_dir().'/public-media';
    if(!is_dir($root))@mkdir($root,0750,true);
    return $root;
}
function ferrn_media_upload(string $field,string $kind='image'):string {
    $f=$_FILES[$field]??null;
    if(!is_array($f)||($f['error']??UPLOAD_ERR_NO_FILE)!==UPLOAD_ERR_OK)throw new RuntimeException('Choose a valid upload.');
    $limit=$kind==='pdf'?12*1024*1024:5*1024*1024;
    if(($f['size']??0)<1||$f['size']>$limit)throw new RuntimeException('The uploaded file exceeds the permitted size.');
    $mime=(new finfo(FILEINFO_MIME_TYPE))->file((string)$f['tmp_name']);
    $allowed=$kind==='pdf'?['application/pdf'=>'pdf']:['image/jpeg'=>'jpg','image/png'=>'png','image/webp'=>'webp'];
    $ext=$allowed[$mime]??null;
    if(!$ext)throw new RuntimeException($kind==='pdf'?'Upload a PDF file.':'Upload a PNG, JPG or WebP image.');
    if($kind==='pdf'&&file_get_contents((string)$f['tmp_name'],false,null,0,5)!=='%PDF-')throw new RuntimeException('The document is not a PDF.');
    if($kind==='image'&&getimagesize((string)$f['tmp_name'])===false)throw new RuntimeException('Invalid image file.');
    $name=bin2hex(random_bytes(20)).'.'.$ext;
    $target=ferrn_media_root().'/'.$name;
    if(!move_uploaded_file((string)$f['tmp_name'],$target))throw new RuntimeException('Could not save the uploaded file.');
    @chmod($target,0640);
    return '/media/file.php?name='.$name;
}
