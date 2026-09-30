<?php
declare(strict_types=1);
require_once __DIR__.'/storage.php';
/* Persistent account + IP lockouts. Files live outside the public web root. */
function ferrn_auth_limit_path(string $kind,string $id): string {
    $dir=ferrn_storage_dir().'/login-limits';
    if(!is_dir($dir)) @mkdir($dir,0700,true);
    return $dir.'/'.hash('sha256',$kind.'|'.$id).'.json';
}
function ferrn_auth_counter(string $kind,string $id,bool $failed=false,bool $reset=false): array {
    $path=ferrn_auth_limit_path($kind,$id);
    $handle=@fopen($path,'c+');
    if(!$handle) return ['count'=>3,'until'=>time()+1800]; // fail closed
    if(!flock($handle,LOCK_EX)){fclose($handle);return ['count'=>3,'until'=>time()+1800];}
    $raw=stream_get_contents($handle);
    $v=json_decode($raw?:'{}',true);
    if(!is_array($v))$v=[];
    $now=time();
    $state=['count'=>(int)($v['count']??0),'since'=>(int)($v['since']??$now),'until'=>(int)($v['until']??0)];
    if($state['until']>0 && $state['until']<=$now)$state=['count'=>0,'since'=>$now,'until'=>0];
    if($state['until']===0 && $now-$state['since']>=1800)$state=['count'=>0,'since'=>$now,'until'=>0];
    if($reset)$state=['count'=>0,'since'=>$now,'until'=>0];
    elseif($failed && $state['until']<=$now){
        if($state['count']===0)$state['since']=$now;
        $state['count']++;
        if($state['count']>=3)$state['until']=$now+1800;
    }
    rewind($handle);ftruncate($handle,0);fwrite($handle,json_encode($state));fflush($handle);flock($handle,LOCK_UN);fclose($handle);
    return $state;
}
function ferrn_auth_limits(string $email,bool $failed=false,bool $reset=false): int {
    $email=strtolower(trim($email));
    $ip=(string)($_SERVER['REMOTE_ADDR']??'unknown');
    $a=ferrn_auth_counter('email',$email,$failed,$reset);
    $b=ferrn_auth_counter('ip',$ip,$failed,$reset);
    return max((int)$a['until'],(int)$b['until']);
}
