<?php
declare(strict_types=1);
if(session_status()!==PHP_SESSION_ACTIVE)session_start();
require_once __DIR__.'/../lib/admin-users.php';
require_once __DIR__.'/../lib/proposals.php';
ferrn_require_admin_permission('proposals');
if(!empty(ferrn_current_admin()['must_change'])){header('Location:/admin/account.php?first=1');exit;}
if(empty($_SESSION['csrf']))$_SESSION['csrf']=bin2hex(random_bytes(24));
$csrf=(string)$_SESSION['csrf'];$error='';
if($_SERVER['REQUEST_METHOD']==='POST'){
 if(!hash_equals($csrf,(string)($_POST['csrf']??''))){http_response_code(403);exit('Invalid request.');}
 $action=(string)($_POST['action']??'');$items=ferrn_proposals();$id=(string)($_POST['id']??'');
 if($action==='delete'){
    $items=array_values(array_filter($items,fn($p)=>($p['id']??'')!==$id));
    if(ferrn_save_collection('proposals',$items)){header('Location:/admin/?tab=proposals');exit;}
    $error='Could not delete proposal.';
 }
 if($action==='archive'){
    foreach($items as &$p)if(($p['id']??'')===$id){$p['status']='archived';$p['updated_at']=date(DATE_ATOM);break;}unset($p);
    if(ferrn_save_collection('proposals',$items)){header('Location:/admin/?tab=proposals');exit;}
    $error='Could not archive proposal.';
 }
 if($action==='save'){
    $title=trim((string)($_POST['title']??''));$client=trim((string)($_POST['client']??''));
    $status=(string)($_POST['status']??'draft');
    if(!in_array($status,['draft','published','archived'],true))$status='draft';
    if($title===''||$client==='')$error='Enter a proposal title and client.';
    else{
      $old=null;foreach($items as $p)if(($p['id']??'')===$id){$old=$p;break;}
      if(!$old)$id=bin2hex(random_bytes(10));
      $p=['id'=>$id,'share_key'=>$old['share_key']??bin2hex(random_bytes(20)),
       'title'=>mb_substr($title,0,220),'client'=>mb_substr($client,0,180),
       'client_logo'=>filter_var((string)($_POST['client_logo']??''),FILTER_VALIDATE_URL)?trim((string)$_POST['client_logo']):'',
       'eyebrow'=>mb_substr(trim((string)($_POST['eyebrow']??'Digital solution proposal')),0,140),
       'headline'=>mb_substr(trim((string)($_POST['headline']??$title)),0,260),
       'intro'=>mb_substr(trim((string)($_POST['intro']??'')),0,2500),
       'problem'=>mb_substr(trim((string)($_POST['problem']??'')),0,5500),
       'approach'=>mb_substr(trim((string)($_POST['approach']??'')),0,5500),
       'scope'=>mb_substr(trim((string)($_POST['scope']??'')),0,8500),
       'timeline'=>mb_substr(trim((string)($_POST['timeline']??'')),0,6500),
       'budget_intro'=>mb_substr(trim((string)($_POST['budget_intro']??'')),0,1800),
       'currency'=>mb_substr(trim((string)($_POST['currency']??'₦')),0,8),
       'total'=>mb_substr(trim((string)($_POST['total']??'')),0,70),
       'deposit'=>mb_substr(trim((string)($_POST['deposit']??'')),0,160),
       'balance'=>mb_substr(trim((string)($_POST['balance']??'')),0,160),
       'items'=>ferrn_proposal_items((string)($_POST['budget_lines']??'')),
       'terms'=>mb_substr(trim((string)($_POST['terms']??'')),0,4500),
       'team'=>mb_substr(trim((string)($_POST['team']??'')),0,4000),
       'cta'=>mb_substr(trim((string)($_POST['cta']??'Ready to build what’s next?')),0,250),
       'contact_email'=>filter_var((string)($_POST['contact_email']??''),FILTER_VALIDATE_EMAIL)?trim((string)$_POST['contact_email']):'info@ferrnagency.com',
       'status'=>$status,'created_at'=>$old['created_at']??date(DATE_ATOM),'updated_at'=>date(DATE_ATOM)];
      $found=false;foreach($items as &$record)if(($record['id']??'')===$id){$record=$p;$found=true;break;}unset($record);if(!$found)array_unshift($items,$p);
      if(ferrn_save_collection('proposals',$items)){header('Location:/admin/?tab=proposals&edit='.$id);exit;}
      $error='Could not save proposal.';
    }
 }
}
$items=ferrn_proposals();$edit=ferrn_find_proposal((string)($_GET['edit']??''));
$fields=[
 ['eyebrow','Section label','input'],['headline','Hero headline','input'],['intro','Executive summary','textarea'],
 ['problem','01 · Understanding of the problem','textarea'],['approach','02 · Approach and methodology','textarea'],
 ['scope','03 · Scope and deliverables','textarea'],['timeline','04 · Timeline and milestones','textarea'],
 ['budget_intro','05 · Budget overview','textarea'],['currency','Currency symbol','input'],
 ['total','Total project investment','input'],['deposit','Commitment / deposit terms','input'],
 ['balance','Final payment / balance terms','input'],['budget_lines','Budget line items — one per line: Workstream | Deliverables | Price','textarea'],
 ['terms','Terms, assumptions and exclusions','textarea'],['team','People responsible for delivery','textarea'],['cta','Closing CTA','input'],['contact_email','Contact email','input']
];
$budgetText=$edit?implode("\n",array_map(fn($v)=>($v['name']??'').' | '.($v['description']??'').' | '.($v['price']??''),$edit['items']??[])):'';
?><!doctype html><html lang="en" data-admin-theme="dark"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Client proposals — Ferrn Admin</title><link href="https://fonts.googleapis.com/css2?family=Poppins:wght@400;500;600&display=swap" rel="stylesheet"><link rel="stylesheet" href="/assets/admin-unified.css"><script src="/assets/admin-unified.js" defer></script>
<style>.proposal-editor{display:grid;grid-template-columns:minmax(0,1fr) 320px;gap:16px;align-items:start}.proposal-form{min-width:0}.proposal-list{position:sticky;top:20px;max-height:calc(100vh - 40px);overflow:auto}.proposal-grid{display:grid;grid-template-columns:1fr 1fr;gap:14px}.proposal-record{padding:15px;border:1px solid var(--adm-border-soft);border-radius:13px;background:var(--adm-panel-2);margin-top:10px}.proposal-record strong{display:block;font-size:13px}.proposal-record p{font-size:10px;line-height:1.55;margin:6px 0;color:var(--adm-muted)}.proposal-record .actions{margin-top:11px}.proposal-record .share{font-size:9px;display:block;margin-top:8px;overflow-wrap:anywhere}@media(max-width:1150px){.proposal-editor{grid-template-columns:1fr}.proposal-list{position:static;max-height:none}}@media(max-width:720px){.proposal-grid{grid-template-columns:1fr}}</style></head><body><div class="app"><?php $tab='proposals';include __DIR__.'/sidebar.php';?><main class="main"><div class="top"><div><div class="muted">CLIENT WORKSPACE</div><h1>Proposals</h1></div><?php if($edit):?><a href="/admin/?tab=proposals" class="btn secondary">New proposal</a><?php endif;?></div><p class="muted">Create structured, branded proposals and control when each private client link is available.</p>
<?php if($error):?><div class="error"><?=htmlspecialchars($error)?></div><?php endif;?>
<div class="proposal-editor"><section class="panel proposal-form"><div class="panel-head"><h2><?=$edit?'Edit proposal':'Create proposal'?></h2><?php if($edit):?><span class="status-pill <?=($edit['status']??'draft')==='published'?'is-active':'is-disabled'?>"><?=htmlspecialchars(ucfirst($edit['status']??'draft'))?></span><?php endif;?></div><form method="post"><input type="hidden" name="csrf" value="<?=htmlspecialchars($csrf)?>"><input type="hidden" name="action" value="save"><input type="hidden" name="id" value="<?=htmlspecialchars($edit['id']??'')?>">
<div class="proposal-grid"><div class="field"><label>Proposal title *</label><input name="title" value="<?=htmlspecialchars($edit['title']??'')?>" required></div><div class="field"><label>Client / company *</label><input name="client" value="<?=htmlspecialchars($edit['client']??'')?>" required></div><div class="field"><label>Client logo URL</label><input name="client_logo" type="url" value="<?=htmlspecialchars($edit['client_logo']??'')?>" placeholder="https://..."></div><div class="field"><label>Status</label><select name="status"><?php foreach(['draft','published','archived'] as $s):?><option value="<?=$s?>" <?=($edit['status']??'draft')===$s?'selected':''?>><?=ucfirst($s)?></option><?php endforeach;?></select></div></div>
<div class="proposal-grid"><?php foreach($fields as [$key,$label,$type]):?><div class="field" style="<?=in_array($key,['problem','approach','scope','timeline','budget_lines','terms','team','intro','budget_intro'])?'grid-column:1/-1':''?>"><label><?=htmlspecialchars($label)?></label><?php $value=$key==='budget_lines'?$budgetText:($edit[$key]??'');?><?php if($type==='textarea'):?><textarea name="<?=$key?>"><?=htmlspecialchars((string)$value)?></textarea><?php else:?><input name="<?=$key?>" value="<?=htmlspecialchars((string)$value)?>"><?php endif;?></div><?php endforeach;?></div>
<div class="actions" style="margin-top:18px"><button class="btn">Save proposal</button><?php if($edit):?><a href="/admin/?tab=proposals" class="btn secondary">Cancel editing</a><?php endif;?></div></form></section>
<aside class="panel proposal-list"><div class="panel-head"><h2>All proposals</h2><span class="muted"><?=count($items)?> total</span></div><?php if(!$items):?><p class="muted">No proposals yet.</p><?php endif;?>
<?php foreach($items as $p):$link='/proposal/'.rawurlencode($p['id']).'/?key='.rawurlencode($p['share_key']);$published=($p['status']??'')==='published';?><article class="proposal-record"><div class="panel-head"><strong><?=htmlspecialchars($p['title'])?></strong><span class="status-pill <?=$published?'is-active':'is-disabled'?>"><?=htmlspecialchars(ucfirst($p['status']))?></span></div><p><?=htmlspecialchars($p['client'])?> · Updated <?=htmlspecialchars(substr((string)$p['updated_at'],0,10))?></p><?php if($published):?><a class="share" href="<?=htmlspecialchars($link)?>" target="_blank" rel="noopener">Open private client link ↗</a><?php else:?><span class="muted" style="font-size:9px">Publish to activate the client link.</span><?php endif;?><div class="actions"><a class="btn secondary" href="/admin/?tab=proposals&amp;edit=<?=urlencode($p['id'])?>">Edit</a><a class="btn secondary" href="<?=htmlspecialchars($link)?>" target="_blank" rel="noopener">Preview</a><?php if(($p['status']??'')!=='archived'):?><form method="post" onsubmit="return confirm('Archive this proposal and deactivate its public link?')"><input type="hidden" name="csrf" value="<?=htmlspecialchars($csrf)?>"><input type="hidden" name="id" value="<?=htmlspecialchars($p['id'])?>"><input type="hidden" name="action" value="archive"><button class="btn secondary">Archive</button></form><?php endif;?><form method="post" onsubmit="return confirm('Permanently delete this proposal?')"><input type="hidden" name="csrf" value="<?=htmlspecialchars($csrf)?>"><input type="hidden" name="id" value="<?=htmlspecialchars($p['id'])?>"><input type="hidden" name="action" value="delete"><button class="btn danger">Delete</button></form></div></article><?php endforeach;?></aside></div></main></div></body></html>