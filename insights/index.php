<?php
declare(strict_types=1);
require_once __DIR__.'/../lib/storage.php';
$posts=array_values(array_filter(ferrn_posts(),fn($p)=>($p['status']??'')==='published'));
usort($posts,fn($a,$b)=>strcmp((string)($b['published_at']??''),(string)($a['published_at']??'')));
$pageTitle='Insights — Ferrn Digital Agency';
$pageDescription='Practical thinking from Ferrn Digital Agency on websites, web applications, product design, automation and digital systems.';
$canonical='https://www.ferrnagency.com/insights/';
?><!doctype html><html lang="en" data-theme="dark"><head><?php include __DIR__.'/../lib/head.php'; ?></head><body><?php include __DIR__.'/../lib/nav.php'; ?><main class="blog-shell"><div class="container"><span class="eyebrow">Ferrn insights</span><h1 class="display">Useful thinking for better digital decisions.</h1><p class="lead" style="margin-top:30px">No filler. Notes on conversion, product strategy, web applications and the systems that help businesses work better.</p><div class="blog-grid"><?php foreach($posts as $p):$date=$p['published_at']??$p['created_at']??'';?><a class="article-card" href="/insights/<?=htmlspecialchars($p['slug'])?>"><div class="article-meta"><span><?=htmlspecialchars($p['category']??'Insight')?></span><span><?=$date?htmlspecialchars(date('M j, Y',strtotime($date))):''?></span></div><h3><?=htmlspecialchars($p['title']??'')?></h3><p><?=htmlspecialchars($p['excerpt']??ferrn_excerpt($p['content']??''))?></p><div class="article-link"><span>Read insight</span><i data-lucide="arrow-up-right"></i></div></a><?php endforeach;?></div></div></main><?php include __DIR__.'/../lib/footer.php'; ?></body></html>
