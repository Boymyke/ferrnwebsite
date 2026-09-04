<?php
declare(strict_types=1);
require_once __DIR__ . '/../lib/storage.php';
header('Content-Type: application/json; charset=utf-8');
$posts = array_values(array_filter(ferrn_posts(), fn($p) => ($p['status'] ?? '') === 'published'));
usort($posts, fn($a,$b) => strcmp((string)($b['published_at'] ?? $b['created_at'] ?? ''), (string)($a['published_at'] ?? $a['created_at'] ?? '')));
$out = array_map(function($p){
    $date = $p['published_at'] ?? $p['created_at'] ?? '';
    return ['title'=>$p['title']??'','slug'=>$p['slug']??'','category'=>$p['category']??'Insight','excerpt'=>$p['excerpt']??ferrn_excerpt($p['content']??''),'date_label'=>$date?date('M j, Y',strtotime($date)):''];
}, $posts);
echo json_encode(['ok'=>true,'posts'=>$out], JSON_UNESCAPED_SLASHES);
