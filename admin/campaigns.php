<?php
declare(strict_types=1);
if(session_status()!==PHP_SESSION_ACTIVE)session_start();
require_once __DIR__.'/../lib/admin-users.php';require_once __DIR__.'/../lib/campaigns.php';
ferrn_require_admin_permission('campaigns');
if((ferrn_current_admin()['role']??'')!=='super'){http_response_code(403);exit('For security, uploading executable campaign assets is restricted to the super administrator.');}
if(!empty(ferrn_current_admin()['must_change'])){header('Location:/admin/account.php?first=1');exit;}
if(empty($_SESSION['csrf']))$_SESSION['csrf']=bin2hex(random_bytes(24));
$csrf=(string)$_SESSION['csrf'];$error='';
if($_SERVER['REQUEST_METHOD']==='POST'){
 if(!hash_equals($csrf,(string)($_POST['csrf']??''))){http_response_code(403);exit('Invalid request.');}
 $action=(string)($_POST['action']??'');$items=ferrn_campaigns();
 $slug=ferrn_slugify((string)($_POST['slug']??''));
 try{
   if($action==='save'){
     if(!preg_match('/^[a-z][a-z0-9-]{2,58}$/D',$slug)||in_array($slug,ferrn_campaign_reserved(),true))throw new RuntimeException('Use a unique campaign slug of 3–59 characters, avoiding reserved site paths.');
     $existing=null;foreach($items as $it)if(($it['slug']??'')===$slug){$existing=$it;break;}
     if(!empty($_FILES['archive']['name']))ferrn_campaign_install($_FILES['archive'],$slug);
     elseif(!$existing)throw new RuntimeException('Upload a ZIP containing index.html at its root.');
     $entry=['id'=>$existing['id']??ferrn_item_id(),'slug'=>$slug,'name'=>ferrn_safe_text((string)($_POST['name']??$slug),200),'active'=>!empty($_POST['active']),'updated_at'=>date(DATE_ATOM)];
     if(!$existing)$entry['created_at']=date(DATE_ATOM);
     $found=false;foreach($items as &$it)if(($it['slug']??'')===$slug){$it=array_merge($it,$entry);$found=true;break;}unset($it);if(!$found)$items[]=$entry;
     if(!ferrn_save_collection('campaigns',$items))throw new RuntimeException('Failed to save campaign status.');
     header('Location:/admin/campaigns.php');exit;
   }
   if($action==='toggle'||$action==='delete'){
     $found=false;foreach($items as &$entry)if(($entry['slug']??'')===$slug){$found=true;if($action==='toggle')$entry['active']=empty($entry['active']);break;}unset($entry);
     if(!$found)throw new RuntimeException('Campaign not found.');
     if($action==='delete'){
       $items=array_values(array_filter($items,fn($e)=>($e['slug']??'')!==$slug));
       // Do not delete ZIP contents until public metadata is removed.
       if(!ferrn_save_collection('campaigns',$items))throw new RuntimeException('Could not disable campaign.');
       ferrn_campaign_delete_files(ferrn_campaign_root().'/'.$slug);
     }elseif(!ferrn_save_collection('campaigns',$items))throw new RuntimeException('Could not update campaign status.');
     header('Location:/admin/campaigns.php');exit;
   }
 }catch(Throwable $e){$error=$e->getMessage();}
}
$items=ferrn_campaigns();
?><!doctype html><html lang="en" data-admin-theme="dark"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Campaign websites · Ferrn Admin</title><link href="https://fonts.googleapis.com/css2?family=Poppins:wght@400;500;600&display=swap" rel="stylesheet"><link rel="stylesheet" href="/assets/admin-unified.css"><script src="/assets/admin-unified.js" defer></script>
<style>*{box-sizing:border-box}body{margin:0;background:var(--adm-bg);color:var(--adm-text);font:13px Poppins,system-ui}.app{display:grid;grid-template-columns:245px minmax(0,1fr);min-height:100vh}.main{padding:35px clamp(18px,3vw,56px)}.panel{background:var(--adm-panel);border:1px solid var(--adm-border);border-radius:18px;padding:24px;margin-bottom:18px}.field{display:grid;gap:8px;margin:12px 0}.field input{background:var(--adm-field);color:var(--adm-text);padding:12px;border-radius:9px;border:1px solid var(--adm-border)}.grid{display:grid;grid-template-columns:1fr 1fr;gap:16px}.btn{border:0;border-radius:999px;background:#ff4100;color:#fff;cursor:pointer;padding:11px 17px;text-decoration:none;font:600 12px Poppins;display:inline-block}.btn.secondary{background:var(--adm-hover);border:1px solid var(--adm-border);color:var(--adm-text)}.actions{display:flex;gap:7px;flex-wrap:wrap}.record{display:flex;justify-content:space-between;align-items:center;gap:22px;flex-wrap:wrap;padding:20px 0;border-bottom:1px solid var(--adm-border)}.record strong{display:block;font-size:18px}.muted{font-size:12px;color:var(--adm-muted);line-height:1.7}@media(max-width:900px){.app,.grid{grid-template-columns:1fr}}</style></head><body><div class="app"><?php $tab='campaigns';include __DIR__.'/sidebar.php';?><main class="main"><h1>Campaign websites</h1><p class="muted">Publish trusted static campaign ZIPs at ferrnagency.com/your-campaign/. Activate or deactivate each independently. Only the super administrator can upload code because campaign JavaScript shares the Ferrn website origin. Never upload unreviewed third-party code.</p>
<?php if($error):?><p style="color:#ff4100"><?=htmlspecialchars($error)?></p><?php endif;?>
<section class="panel"><h2>Create or replace campaign</h2><form method="post" enctype="multipart/form-data"><input type="hidden" name="csrf" value="<?=htmlspecialchars($csrf)?>"><input type="hidden" name="action" value="save">
<div class="grid"><div class="field"><label>Campaign title</label><input name="name" placeholder="Dental product launch" required></div><div class="field"><label>Public URL slug</label><input name="slug" pattern="[a-z][a-z0-9-]{2,58}" placeholder="dental-launch" required></div></div>
<div class="field"><label>Static HTML page (max 2 MB) or website ZIP (index.html at ZIP root; max 12 MB)</label><input type="file" name="archive" accept=".zip,.html,.htm,application/zip,text/html"></div><p class="muted">To update an existing campaign, enter its current slug and upload a replacement file. Leave the file blank to change the campaign's title or visibility only. PHP, scripts requiring server execution and hidden files are not supported.</p>
<label><input type="checkbox" name="active" value="1"> Publish/enable immediately</label><p><button class="btn">Save campaign</button></p></form></section>
<section class="panel"><h2>Existing campaigns</h2>
<?php if(!$items):?><p class="muted">No campaigns uploaded yet.</p><?php endif;?>
<?php foreach($items as $item):?><article class="record"><div><strong><?=htmlspecialchars($item['name'])?></strong><p class="muted"><?=!empty($item['active'])?'Active':'Disabled'?> · URL: /<?=htmlspecialchars($item['slug'])?>/</p><?php if(!empty($item['active'])):?><a href="/<?=htmlspecialchars($item['slug'])?>/" target="_blank" rel="noopener" style="color:#ff4100">Open campaign ↗</a><?php endif;?></div><div class="actions"><form method="post"><input type="hidden" name="csrf" value="<?=htmlspecialchars($csrf)?>"><input type="hidden" name="slug" value="<?=htmlspecialchars($item['slug'])?>"><input type="hidden" name="action" value="toggle"><button class="btn secondary"><?=!empty($item['active'])?'Disable':'Enable'?></button></form><form method="post" onsubmit="return confirm('Permanently delete campaign and uploaded files?')"><input type="hidden" name="csrf" value="<?=htmlspecialchars($csrf)?>"><input type="hidden" name="slug" value="<?=htmlspecialchars($item['slug'])?>"><input type="hidden" name="action" value="delete"><button class="btn secondary">Delete</button></form></div></article><?php endforeach;?></section></main></div></body></html>
