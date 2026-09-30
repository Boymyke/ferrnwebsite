<?php
declare(strict_types=1);
require_once __DIR__.'/platform.php';
function ferrn_proposals():array{return ferrn_collection('proposals');}
function ferrn_find_proposal(string $id):?array {
 foreach(ferrn_proposals() as $p)if(($p['id']??'')===$id)return $p;
 return null;
}
function ferrn_proposal_items(string $text):array {
 $items=[];
 foreach(preg_split('/\r\n|\r|\n/',$text) as $line){
   if(trim($line)==='')continue;
   $parts=array_map('trim',explode('|',$line));
   $items[]=['name'=>mb_substr($parts[0]??'',0,160),'description'=>mb_substr($parts[1]??'',0,400),'price'=>mb_substr($parts[2]??'',0,70)];
   if(count($items)>=40)break;
 }
 return $items;
}
