<?php
declare(strict_types=1);
require_once __DIR__.'/storage.php';

function ferrn_permission_keys():array {
 return [
  'dashboard'=>'Dashboard','leads'=>'Leads','projects'=>'Projects','posts'=>'Posts','testimonials'=>'Testimonials',
  'settings'=>'Website settings','team'=>'Team','certifications'=>'Certifications','awards'=>'Awards','policies'=>'Policies',
  'careers'=>'Careers','rfps'=>'RFP enquiries','newsletter'=>'Newsletter','analytics'=>'Analytics & heatmap',
  'knowledge'=>'Chatbot knowledge','client_logos'=>'Client logos','chat_questions'=>'Chatbot questions',
  'proposals'=>'Proposals','campaigns'=>'Campaign websites'
 ];
}
function ferrn_admin_users():array{return ferrn_load_json('admin-users.json',[]);}
function ferrn_save_admin_users(array $users):bool{return ferrn_save_json('admin-users.json',array_values($users));}
function ferrn_current_admin():?array {
 if(empty($_SESSION['ferrn_admin']))return null;
 $id=(string)($_SESSION['ferrn_admin_user']??'super');
 if($id==='super')return ['id'=>'super','email'=>'michael@ferrnagency.com','name'=>'Super Admin','role'=>'super','active'=>true,'must_change'=>false,'permissions'=>array_fill_keys(array_keys(ferrn_permission_keys()),true)];
 foreach(ferrn_admin_users() as $user){
  if(($user['id']??'')===$id && !empty($user['active']))return $user;
 }
 unset($_SESSION['ferrn_admin'],$_SESSION['ferrn_admin_user']);
 return null;
}
function ferrn_admin_can(string $permission):bool {
 $user=ferrn_current_admin();if(!$user)return false;
 if(($user['role']??'')==='super')return true;
 if($permission==='overview')$permission='dashboard';
 return !empty($user['permissions'][$permission]);
}
function ferrn_require_admin_permission(string $permission):void {
 if(!ferrn_admin_can($permission)){http_response_code(403);header('Content-Type:text/html; charset=utf-8');echo '<!doctype html><title>Access denied</title><style>body{font:16px system-ui;background:#0b0b0b;color:#fff;padding:8vw}a{color:#ff4100}</style><h1>Access denied</h1><p>Your Ferrn admin account does not have permission for this section.</p><p><a href="/admin/">Return to dashboard</a></p>';exit;}
}
function ferrn_secondary_login(string $email,string $password):?array {
 $email=strtolower(trim($email));
 foreach(ferrn_admin_users() as $user){
  if(empty($user['active'])||strtolower((string)($user['email']??''))!==$email)continue;
  if(!password_verify($password,(string)($user['password_hash']??'')))return null;
  $_SESSION['ferrn_admin']=1;$_SESSION['ferrn_admin_user']=$user['id'];
  return $user;
 }
 return null;
}
function ferrn_random_temp_password():string {
 return 'F!'.substr(strtr(base64_encode(random_bytes(16)),'+/','AZ'),0,18).'9';
}
function ferrn_sanitize_permissions(array $input):array {
 $allowed=array_keys(ferrn_permission_keys());$result=[];
 foreach($allowed as $key)$result[$key]=!empty($input[$key]);
 return $result;
}
