<?php
declare(strict_types=1);
require_once __DIR__.'/platform.php';
function ferrn_campaigns():array{return ferrn_collection('campaigns');}
function ferrn_campaign_root():string{
 $path=ferrn_storage_dir().'/campaign-sites';
 if(!is_dir($path))@mkdir($path,0750,true);
 return $path;
}
function ferrn_campaign_reserved():array {
 return ['admin','api','assets','about','campaign','careers','contact','cron','data','docs','insights','lib','media','policies','procurement','proposal','rfp','services','studio','team','testimonials','work','robots','sitemap','manifest','404','500'];
}
function ferrn_campaign_install(array $zip,string $slug):void {
 if(($zip['error']??UPLOAD_ERR_NO_FILE)!==UPLOAD_ERR_OK)throw new RuntimeException('Choose a ZIP archive.');
 if(($zip['size']??0)<1||$zip['size']>12*1024*1024)throw new RuntimeException('Campaign ZIP must be at most 12 MB.');
 if(!class_exists('ZipArchive'))throw new RuntimeException('PHP ZipArchive is required on this hosting server.');
 $archive=new ZipArchive();
 if($archive->open((string)$zip['tmp_name'])!==true)throw new RuntimeException('The uploaded ZIP cannot be opened.');
 $temp=ferrn_campaign_root().'/tmp-'.bin2hex(random_bytes(8));$dest=ferrn_campaign_root().'/'.$slug;
 if(!@mkdir($temp,0750,true))throw new RuntimeException('Cannot create a campaign workspace.');
 $count=$archive->numFiles;$size=0;$allowed=['html','htm','css','js','mjs','json','txt','svg','png','jpg','jpeg','gif','webp','ico','woff','woff2','ttf','pdf','webmanifest','mp4','webm'];
 try{
  if($count<1||$count>180)throw new RuntimeException('A campaign may contain at most 180 files.');
  for($i=0;$i<$count;$i++){
   $info=$archive->statIndex($i);$name=str_replace('\\','/',(string)($info['name']??''));
   if($name===''||str_contains($name,'..')||str_starts_with($name,'/')||!preg_match('~^[A-Za-z0-9_./-]+$~D',$name))throw new RuntimeException('The archive contains an unsafe filename.');
   $pieces=explode('/',trim($name,'/'));
   if(count($pieces)>8||count(array_filter($pieces,fn($v)=>$v===''||str_starts_with($v,'.'))))throw new RuntimeException('The ZIP contains hidden or invalid paths.');
   if(str_ends_with($name,'/'))continue;
   $ext=strtolower(pathinfo($name,PATHINFO_EXTENSION));
   if(!in_array($ext,$allowed,true))throw new RuntimeException('Only static website files are supported. Blocked: '.$name);
   $size+=(int)($info['size']??0);
   if($size>35*1024*1024)throw new RuntimeException('Extracted campaign files exceed 35 MB.');
   $attributes=0;$opsys=0;$archive->getExternalAttributesIndex($i,$opsys,$attributes);
   if($opsys===ZipArchive::OPSYS_UNIX&&((($attributes>>16)&0170000)===0120000))throw new RuntimeException('ZIP symbolic links are not supported.');
   $target=$temp.'/'.$name;$dir=dirname($target);
   if(!is_dir($dir))@mkdir($dir,0750,true);
   $in=$archive->getStream((string)$info['name']);
   $out=@fopen($target,'wb');if(!$in||!$out)throw new RuntimeException('Could not extract '.$name);
   $written=0;while(!feof($in)){$chunk=fread($in,65536);$written+=strlen($chunk);if($written>$info['size']||$written>35*1024*1024)throw new RuntimeException('Invalid compressed asset size.');fwrite($out,$chunk);}
   fclose($in);fclose($out);@chmod($target,0640);
  }
  if(!is_file($temp.'/index.html'))throw new RuntimeException('Your ZIP must contain index.html at its root.');
  if(is_dir($dest))ferrn_campaign_delete_files($dest);
  if(!rename($temp,$dest))throw new RuntimeException('Could not activate uploaded campaign.');
 }finally{$archive->close();if(is_dir($temp))ferrn_campaign_delete_files($temp);}
}
function ferrn_campaign_delete_files(string $dir):void{
 if(!is_dir($dir))return;
 foreach(new FilesystemIterator($dir,FilesystemIterator::SKIP_DOTS) as $file){
   $file->isDir()&&!$file->isLink()?ferrn_campaign_delete_files($file->getPathname()):@unlink($file->getPathname());
 }
 @rmdir($dir);
}
