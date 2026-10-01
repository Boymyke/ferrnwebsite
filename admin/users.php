<?php
declare(strict_types=1);
if(session_status()!==PHP_SESSION_ACTIVE)session_start();
require_once __DIR__.'/../lib/admin-users.php';
ferrn_require_admin_permission('users'); // only the super administrator owns user management
$user=ferrn_current_admin();if(($user['role']??'')!=='super'){http_response_code(403);exit('Super administrator only.');}
if(empty($_SESSION['csrf']))$_SESSION['csrf']=bin2hex(random_bytes(24));
$csrf=(string)$_SESSION['csrf'];$error='';
if($_SERVER['REQUEST_METHOD']==='POST'){
 if(!hash_equals($csrf,(string)($_POST['csrf']??''))){http_response_code(403);exit('Invalid request.');}
 $action=(string)($_POST['action']??'');$users=ferrn_admin_users();$id=(string)($_POST['id']??'');
 if($action==='create'){
  $email=strtolower(trim((string)($_POST['email']??'')));$name=trim((string)($_POST['name']??''));
  if(!filter_var($email,FILTER_VALIDATE_EMAIL)||mb_strlen($name)<2)$error='Enter a valid email and name.';
  elseif($email==='michael@ferrnagency.com'||count(array_filter($users,fn($u)=>strtolower((string)($u['email']??''))===$email)))$error='This email is already registered.';
  else{
    $pw=ferrn_random_temp_password();
    $users[]=['id'=>bin2hex(random_bytes(12)),'name'=>mb_substr($name,0,160),'email'=>$email,
      'password_hash'=>password_hash($pw,PASSWORD_DEFAULT),'role'=>'admin','permissions'=>ferrn_sanitize_permissions((array)($_POST['permissions']??[])),
      'active'=>true,'must_change'=>true,'created_at'=>date(DATE_ATOM)];
    if(ferrn_save_admin_users($users)){$_SESSION['new_admin_credential']=['email'=>$email,'password'=>$pw];header('Location:/admin/users.php');exit;}else $error='Could not create user.';
  }
 }
 if($action==='update'||$action==='disable'||$action==='reset'){
  foreach($users as &$u){
   if(($u['id']??'')!==$id)continue;
   if($action==='update'){$u['permissions']=ferrn_sanitize_permissions((array)($_POST['permissions']??[]));$u['active']=!empty($_POST['active']);}
   elseif($action==='disable')$u['active']=false;
   elseif($action==='reset'){
      $pw=ferrn_random_temp_password();$u['password_hash']=password_hash($pw,PASSWORD_DEFAULT);$u['must_change']=true;
      $_SESSION['new_admin_credential']=['email'=>$u['email'],'password'=>$pw];
   }
   $u['updated_at']=date(DATE_ATOM);break;
  }unset($u);
  if(ferrn_save_admin_users($users)){header('Location:/admin/users.php');exit;}
  $error='Could not update user.';
 }
}
$users=ferrn_admin_users();$cred=$_SESSION['new_admin_credential']??null;unset($_SESSION['new_admin_credential']);
?><!doctype html><html lang="en" data-admin-theme="dark"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Admin users — Ferrn</title><link href="https://fonts.googleapis.com/css2?family=Poppins:wght@400;500;600&display=swap" rel="stylesheet"><link rel="stylesheet" href="/assets/admin-unified.css"><script src="/assets/admin-unified.js" defer></script>
<style>*{box-sizing:border-box}body{margin:0;font:13px Poppins,system-ui;background:var(--adm-bg);color:var(--adm-text)}.app{display:grid;grid-template-columns:245px minmax(0,1fr);min-height:100vh}.main{padding:36px clamp(16px,4vw,55px)}.panel{padding:24px;border:1px solid var(--adm-border);border-radius:20px;background:var(--adm-panel);margin:20px 0}.panel h2{margin-top:0;font-size:19px}.grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:16px}.field{display:grid;gap:8px}.field input{padding:12px;background:var(--adm-field);color:var(--adm-text);border:1px solid var(--adm-border);border-radius:9px}.permissions{display:grid;grid-template-columns:repeat(auto-fit,minmax(155px,1fr));gap:7px;margin:20px 0}.permissions label{border:1px solid var(--adm-border);border-radius:9px;padding:9px;font-size:11px}.btn{padding:11px 17px;border:0;border-radius:99px;background:#ff4100;color:#fff;font-weight:600;cursor:pointer}.secondary{background:var(--adm-hover);color:var(--adm-text);border:1px solid var(--adm-border)}.account{padding:18px 0;border-top:1px solid var(--adm-border)}.actions{display:flex;gap:10px;flex-wrap:wrap;margin-top:10px}.muted{font-size:12px;color:var(--adm-muted)}.secret{padding:16px;border:1px solid #ff4100;border-radius:14px;background:var(--adm-panel)}.secret code{font-size:16px;word-break:break-all}@media(max-width:900px){.app{grid-template-columns:1fr}.grid{grid-template-columns:1fr}}</style></head><body><div class="app"><?php $tab='users';include __DIR__.'/sidebar.php'; ?><main class="main">
<h1>Admin users & permissions</h1><p class="muted">You are the super administrator. Choose exactly which sections a teammate can manage. New accounts must change their temporary password at first sign-in.</p>
<?php if($error):?><p style="color:#ff4100"><?=htmlspecialchars($error)?></p><?php endif;?>
<?php if($cred):?><section class="secret" role="status"><strong>New temporary login credentials — copy now, they will not be shown again.</strong><p>Email: <?=htmlspecialchars($cred['email'])?></p><p>Password: <code><?=htmlspecialchars($cred['password'])?></code></p><p class="muted">Share credentials securely. The system does not automatically send login emails.</p></section><?php endif;?>
<section class="panel"><h2>Create a user</h2><form method="post"><input type="hidden" name="csrf" value="<?=htmlspecialchars($csrf)?>"><input type="hidden" name="action" value="create"><div class="grid"><div class="field"><label>Full name</label><input name="name" required></div><div class="field"><label>Work email</label><input type="email" name="email" required></div></div><h3>Editable sections</h3><div class="permissions"><?php foreach(ferrn_permission_keys() as $key=>$label):?><label><input type="checkbox" name="permissions[<?=htmlspecialchars($key)?>]" value="1" <?=$key==='dashboard'?'checked':''?>> <?=htmlspecialchars($label)?></label><?php endforeach;?></div><button class="btn">Create admin account</button></form></section>
<section class="panel"><h2>Existing users</h2>
<?php if(!$users):?><p class="muted">No additional admins yet.</p><?php endif;?>
<?php foreach($users as $u):?><div class="account"><h3><?=htmlspecialchars($u['name'])?> · <?=htmlspecialchars($u['email'])?></h3><p class="muted"><?=!empty($u['active'])?'Enabled':'Disabled'?> · <?=!empty($u['must_change'])?'Password change required':'Password set'?></p>
<form method="post"><input type="hidden" name="csrf" value="<?=htmlspecialchars($csrf)?>"><input type="hidden" name="id" value="<?=htmlspecialchars($u['id'])?>"><input type="hidden" name="action" value="update"><div class="permissions"><?php foreach(ferrn_permission_keys() as $key=>$label):?><label><input type="checkbox" name="permissions[<?=htmlspecialchars($key)?>]" value="1" <?=!empty($u['permissions'][$key])?'checked':''?>> <?=htmlspecialchars($label)?></label><?php endforeach;?></div><label><input type="checkbox" name="active" value="1" <?=!empty($u['active'])?'checked':''?>> Account enabled</label><p><button class="btn">Save permissions</button></p></form><div class="actions"><form method="post" onsubmit="return confirm('Issue a new temporary password?')"><input type="hidden" name="csrf" value="<?=htmlspecialchars($csrf)?>"><input type="hidden" name="id" value="<?=htmlspecialchars($u['id'])?>"><input type="hidden" name="action" value="reset"><button class="btn secondary">Reset password</button></form><form method="post" onsubmit="return confirm('Disable this account?')"><input type="hidden" name="csrf" value="<?=htmlspecialchars($csrf)?>"><input type="hidden" name="id" value="<?=htmlspecialchars($u['id'])?>"><input type="hidden" name="action" value="disable"><button class="btn secondary">Disable</button></form></div></div><?php endforeach;?></section>
</main></div></body></html>
