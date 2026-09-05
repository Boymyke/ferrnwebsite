<?php
declare(strict_types=1);
require_once __DIR__.'/../lib/storage.php';
$slug=ferrn_slugify((string)($_GET['slug']??''));
$post=null;
foreach(ferrn_posts() as $candidate) if(($candidate['slug']??'')===$slug&&($candidate['status']??'')==='published'){$post=$candidate;break;}
if(!$post){http_response_code(404);$post=['title'=>'Insight not found','excerpt'=>'This article is not available.','content'=>'<p>The article you requested could not be found.</p>','category'=>'404','published_at'=>''];}
$date=$post['published_at']??$post['created_at']??'';
$pageTitle=(string)$post['title'].' — Ferrn Digital Agency';
$pageDescription=(string)($post['excerpt']??ferrn_excerpt($post['content']??''));
$canonical='https://www.ferrnagency.com/insights/'.$slug;
$ogType='article';
$schema=['@context'=>'https://schema.org','@type'=>'BlogPosting','headline'=>$post['title'],'description'=>$post['excerpt']??'','datePublished'=>$date,'dateModified'=>$post['updated_at']??$date,'author'=>['@type'=>'Organization','name'=>'Ferrn Digital Agency'],'publisher'=>['@type'=>'Organization','name'=>'Ferrn Digital Agency','url'=>'https://www.ferrnagency.com/'],'mainEntityOfPage'=>$canonical];
?><!doctype html><html lang="en" data-theme="dark"><head><?php include __DIR__.'/../lib/head.php'; ?></head><body><?php include __DIR__.'/../lib/nav.php'; ?><main><header class="post-hero"><div class="container"><div class="case-breadcrumb"><a href="/insights/">Insights</a><i data-lucide="chevron-right"></i><span><?=htmlspecialchars($post['category']??'Insight')?></span></div><h1><?=htmlspecialchars((string)$post['title'])?></h1><div class="post-meta"><span><?=htmlspecialchars($post['category']??'Insight')?></span><span><?=$date?htmlspecialchars(date('F j, Y',strtotime($date))):''?></span><span>Ferrn Digital Agency</span></div></div></header><article class="post-body"><?=ferrn_sanitize_html((string)($post['content']??''))?></article></main><?php include __DIR__.'/../lib/footer.php'; ?></body></html>
