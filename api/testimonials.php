<?php
declare(strict_types=1);
require_once __DIR__ . '/../lib/testimonials.php';
header('Content-Type: application/json; charset=utf-8');
header('Cache-Control: no-store, max-age=0');
echo json_encode(['ok'=>true,'testimonials'=>ferrn_public_testimonials()], JSON_UNESCAPED_SLASHES|JSON_UNESCAPED_UNICODE);
