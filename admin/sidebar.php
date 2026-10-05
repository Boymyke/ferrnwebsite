<?php
require_once __DIR__.'/../lib/admin-users.php';
$groups=[
 'Overview'=>[
  ['Dashboard','dashboard'],['Leads','leads'],['Projects','projects'],['Posts','posts'],
 ],
 'Content'=>[
  ['Testimonials','testimonials'],['Proposals','proposals'],['Campaign websites','campaigns'],['Website settings','settings'],
 ],
 'Company'=>[
  ['Team','team'],['Certifications','certifications'],['Awards','awards'],['Policies','policies'],['Careers','careers'],
 ],
 'Growth & data'=>[
  ['RFP enquiries','rfps'],['Newsletter','newsletter'],['Analytics & heatmap','analytics'],['Chatbot knowledge','knowledge'],['Chatbot questions','chat_questions'],['Client logos','client_logos'],
 ],
];
?>
<script>
/* Critical theme bootstrap: some admin pages intentionally share this sidebar but
   their HTML root is emitted before admin-unified.js runs. Apply the saved theme
   before the navigation or page content is parsed so there is no flash of the
   legacy/default anchor styling during every tab change. */
(function(){
  var theme='dark';
  try{theme=localStorage.getItem('ferrn-admin-theme')||'dark';}catch(e){}
  document.documentElement.dataset.adminTheme=theme;
})();
</script>
<style>
/* Critical navigation paint. Keep this tiny and colocated with the shared shell
   so every admin route paints the same navigation on the first frame. */
.admin-navigation a{text-decoration:none!important;-webkit-user-select:none;user-select:none}
.admin-navigation nav a,.admin-navigation .admin-sidebar-bottom a{transition:background .12s ease,color .12s ease,transform .12s ease!important}
.admin-navigation nav a:not(.active),.admin-navigation .admin-sidebar-bottom a:not(.active){border-color:transparent!important;box-shadow:none!important}
.admin-navigation a:focus{outline:none}
.admin-navigation a:focus-visible{outline:2px solid #ff4100!important;outline-offset:2px}
html{scrollbar-gutter:stable}
</style>
<aside class="side admin-navigation">
 <div class="admin-logo"><img src="/assets/ferrn-mark.svg" alt="Ferrn"><span>FERRN ADMIN</span></div>
 <nav aria-label="Admin dashboard">
  <?php foreach($groups as $group=>$entries):
   $visible=array_values(array_filter($entries,fn($entry)=>ferrn_admin_can($entry[1])));
   if(!$visible)continue; ?>
   <div class="admin-nav-group"><?=htmlspecialchars($group)?></div>
   <?php foreach($visible as $entry): ?>
    <a class="<?=($tab===$entry[1])?'active':''?>" href="/admin/?tab=<?=htmlspecialchars($entry[1])?>"><?=htmlspecialchars($entry[0])?></a>
   <?php endforeach; ?>
  <?php endforeach; ?>
 </nav>
 <div class="admin-sidebar-bottom">
  <?php if((ferrn_current_admin()['role']??'')==='super'):?><a href="/admin/users.php" class="<?=$tab==='users'?'active':''?>">Admin users & permissions</a><?php endif;?>
  <button class="admin-theme-toggle" type="button" data-admin-theme-toggle aria-label="Switch admin colour theme">☀ &nbsp; Light mode</button>
  <a href="/admin/account.php">Account & password</a>
  <a href="/" target="_blank" rel="noopener">View website ↗</a>
  <a href="/admin/?logout=1">Sign out</a>
 </div>
</aside>