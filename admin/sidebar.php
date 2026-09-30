<?php
$adminMenu=[
['Dashboard','dashboard'],['Leads','leads'],['Projects','projects'],['Posts','posts'],['Testimonials','testimonials'],
['Website settings','settings'],['Team','team'],['Certifications','certifications'],['Awards','awards'],
['Policies','policies'],['Careers','careers'],['RFP enquiries','rfps'],['Newsletter','newsletter'],
['Analytics & heatmap','analytics'],['Chatbot knowledge','knowledge']
];
?><aside class="side admin-navigation"><div class="admin-logo"><img src="/assets/ferrn-mark.svg" alt="Ferrn"><span>FERRN ADMIN</span></div><nav aria-label="Admin dashboard"><?php foreach($adminMenu as $entry):?><a class="<?=($tab===$entry[1])?'active':''?>" href="/admin/?tab=<?=$entry[1]?>"><?=htmlspecialchars($entry[0])?></a><?php endforeach;?></nav><div class="admin-sidebar-bottom"><button class="admin-theme-toggle" type="button" data-admin-theme-toggle aria-label="Switch admin colour theme">☀ &nbsp; Light mode</button><a href="/admin/account.php">Account & password</a><a href="/" target="_blank" rel="noopener">View website ↗</a><a href="/admin/?logout=1">Sign out</a></div></aside>