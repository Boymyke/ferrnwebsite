<?php
declare(strict_types=1);
if(session_status()!==PHP_SESSION_ACTIVE)session_start();
require_once __DIR__.'/../lib/admin-users.php';
require_once __DIR__.'/../lib/storage.php';

const ADMIN_EMAIL='michael@ferrnagency.com';
const ADMIN_HASH='$2y$12$0BYQeftlTVmqVqjUAjmZduUPPh6tL2aDD9H15RS28dXpSJhsEf8F2';

function admin_credentials():array{
    return ferrn_load_json('admin-auth.json',[
        'email'=>ADMIN_EMAIL,
        'password_hash'=>ADMIN_HASH,
        'password_changed'=>false
    ]);
}
function csrf():string{
    if(empty($_SESSION['csrf']))$_SESSION['csrf']=bin2hex(random_bytes(24));
    return (string)$_SESSION['csrf'];
}
if(!ferrn_current_admin()){header('Location:/admin/');exit;}

$error='';$success='';$user=ferrn_current_admin();$isSuper=($user['role']??'')==='super';
if($_SERVER['REQUEST_METHOD']==='POST'){
    if(!hash_equals((string)($_SESSION['csrf']??''),(string)($_POST['csrf']??''))){http_response_code(403);exit('Invalid request');}
    $creds=$isSuper?admin_credentials():$user;
    $current=(string)($_POST['current_password']??'');
    $new=(string)($_POST['new_password']??'');
    $confirm=(string)($_POST['confirm_password']??'');
    if(!password_verify($current,(string)($creds['password_hash']??''))){
        $error='Your current password is incorrect.';
    }elseif(strlen($new)<12){
        $error='Use at least 12 characters for the new password.';
    }elseif($new!==$confirm){
        $error='The new passwords do not match.';
    }else{
        if($isSuper){
          $creds['email']=$creds['email']??ADMIN_EMAIL;
          $creds['password_hash']=password_hash($new,PASSWORD_BCRYPT,['cost'=>12]);
          $creds['password_changed']=true;$creds['updated_at']=date(DATE_ATOM);
          $saved=ferrn_save_json('admin-auth.json',$creds);
        }else{
          $users=ferrn_admin_users();$saved=false;
          foreach($users as &$u){
            if(($u['id']??'')!==$user['id'])continue;
            $u['password_hash']=password_hash($new,PASSWORD_BCRYPT,['cost'=>12]);$u['must_change']=false;$u['updated_at']=date(DATE_ATOM);
            $saved=ferrn_save_admin_users($users);break;
          }unset($u);
        }
        if($saved){$success='Password updated successfully.';$first=false;}
        else $error='Could not save the new password.';
    }
}
$first=!empty($_GET['first'])&&($isSuper?empty(admin_credentials()['password_changed']):!empty($user['must_change']));
?><!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Ferrn Admin Account</title><link rel="icon" href="/assets/ferrn-mark.svg"><link href="https://fonts.googleapis.com/css2?family=Poppins:wght@400;500;600&display=swap" rel="stylesheet"><style>*{box-sizing:border-box}body{margin:0;min-height:100vh;background:#090909;color:#f7f7f4;font-family:Poppins;padding:24px}.wrap{max-width:760px;margin:40px auto}.top{display:flex;align-items:center;justify-content:space-between;gap:20px;margin-bottom:28px}.top img{width:38px}.top a{color:#aaa;text-decoration:none;font-size:12px}.panel{background:#111;border:1px solid #252525;border-radius:20px;padding:26px}.panel h1{font-size:30px;font-weight:500;margin:0 0 8px}.panel p{color:#888;font-size:12px;line-height:1.6}.notice{padding:12px 14px;border-radius:12px;margin:14px 0;font-size:12px}.notice.warn{background:#32180f;color:#ffb59b}.notice.ok{background:#11351e;color:#9ce9b3}.grid{display:grid;grid-template-columns:1fr 1fr;gap:12px;margin-top:20px}.field{display:flex;flex-direction:column;gap:7px}.field.full{grid-column:1/-1}.field label{font-size:10px;color:#888}.field input{background:#080808;border:1px solid #2b2b2b;color:#fff;border-radius:10px;padding:13px;font:inherit}.btn{margin-top:18px;border:0;border-radius:999px;background:#ff4100;color:#fff;padding:12px 18px;font:600 12px Poppins;cursor:pointer}@media(max-width:650px){.grid{grid-template-columns:1fr}.field.full{grid-column:auto}}</style><link rel="stylesheet" href="/assets/admin-unified.css"><script src="/assets/admin-unified.js" defer></script><style>html[data-admin-theme] .wrap .panel{background:var(--adm-panel);border-color:var(--adm-border)}html[data-admin-theme] .wrap .panel p,html[data-admin-theme] .top a,html[data-admin-theme] .field label{color:var(--adm-muted)}html[data-admin-theme] .field input{background:var(--adm-field);border-color:var(--adm-border);color:var(--adm-text)}</style></head><body><div class="wrap"><div class="top"><img src="/assets/ferrn-mark.svg" alt="Ferrn"><div style="display:flex;align-items:center;gap:12px"><button type="button" data-admin-theme-toggle class="admin-theme-toggle">Light mode</button><a href="/admin/">← Back to dashboard</a></div></div><section class="panel"><h1>Admin account</h1><p>Change the password used to access the Ferrn admin. The password is stored only as a one-way hash in private server storage.</p><?php if($first):?><div class="notice warn">You must change your temporary or initial password before continuing.</div><?php endif;?><?php if($error):?><div class="notice warn"><?=htmlspecialchars($error)?></div><?php endif;?><?php if($success):?><div class="notice ok"><?=htmlspecialchars($success)?></div><?php endif;?><form method="post"><input type="hidden" name="csrf" value="<?=csrf()?>"><div class="grid"><div class="field full"><label>Current password</label><input type="password" name="current_password" required autocomplete="current-password"></div><div class="field"><label>New password</label><input type="password" name="new_password" minlength="12" required autocomplete="new-password"></div><div class="field"><label>Confirm new password</label><input type="password" name="confirm_password" minlength="12" required autocomplete="new-password"></div></div><button class="btn" type="submit">Update password</button></form></section></div></body></html>