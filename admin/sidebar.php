<?php
require_once __DIR__.'/../lib/admin-users.php';
$adminMenu=[
['Dashboard','dashboard'],['Leads','leads'],['Projects','projects'],['Posts','posts'],['Testimonials','testimonials'],['Proposals','proposals'],['Campaign websites','campaigns'],
['Website settings','settings'],['Team','team'],['Certifications','certifications'],['Awards','awards'],
['Policies','policies'],['Careers','careers'],['RFP enquiries','rfps'],['Newsletter','newsletter'],
['Analytics & heatmap','analytics'],['Chatbot knowledge','knowledge'],['Chatbot questions','chat_questions'],['Client logos','client_logos']
];
?><aside class="side admin-navigation"><div class="admin-logo"><img src="/assets/ferrn-mark.svg" alt="Ferrn"><span>FERRN ADMIN</span></div><nav aria-label="Admin dashboard"><?php foreach($adminMenu as $entry):if(!ferrn_admin_can($entry[1]))continue;?><a class="<?=($tab===$entry[1])?'active':''?>" href="/admin/?tab=<?=$entry[1]?>"><?=htmlspecialchars($entry[0])?></a><?php endforeach;?></nav><div class="admin-sidebar-bottom"><?php if((ferrn_current_admin()['role']??'')==='super'):?><a href="/admin/users.php" class="<?=$tab==='users'?'active':''?>">Admin users & permissions</a><?php endif;?><button class="admin-theme-toggle" type="button" data-admin-theme-toggle aria-label="Switch admin colour theme">☀ &nbsp; Light mode</button><a href="/admin/account.php">Account & password</a><a href="/" target="_blank" rel="noopener">View website ↗</a><a href="/admin/?logout=1">Sign out</a></div></aside>