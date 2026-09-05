<?php
declare(strict_types=1);
require_once __DIR__ . '/lib/storage.php';
require_once __DIR__ . '/lib/projects.php';
$projects=ferrn_projects();
header('Content-Type: application/xml; charset=utf-8');
$urls=[['loc'=>'https://www.ferrnagency.com/','priority'=>'1.0'],['loc'=>'https://www.ferrnagency.com/work/','priority'=>'0.9'],['loc'=>'https://www.ferrnagency.com/insights/','priority'=>'0.8']];
foreach($projects as $slug=>$p)$urls[]=['loc'=>'https://www.ferrnagency.com/work/'.$slug,'priority'=>'0.8'];
foreach(ferrn_posts() as $p)if(($p['status']??'')==='published')$urls[]=['loc'=>'https://www.ferrnagency.com/insights/'.($p['slug']??''),'priority'=>'0.7','lastmod'=>substr((string)($p['updated_at']??$p['published_at']??''),0,10)];
echo '<?xml version="1.0" encoding="UTF-8"?>' . "\n";
?><urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"><?php foreach($urls as $u):?><url><loc><?=htmlspecialchars($u['loc'],ENT_XML1)?></loc><?php if(!empty($u['lastmod'])):?><lastmod><?=htmlspecialchars($u['lastmod'],ENT_XML1)?></lastmod><?php endif;?><priority><?=htmlspecialchars($u['priority'],ENT_XML1)?></priority></url><?php endforeach;?></urlset>
