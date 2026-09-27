<?php
declare(strict_types=1);
require_once __DIR__.'/../lib/platform.php';

if (PHP_SAPI !== 'cli') {
    $secret = (string)getenv('FERRN_AI_CRON_KEY');
    if ($secret === '' || !hash_equals($secret, (string)($_GET['key'] ?? ''))) {
        http_response_code(403);
        exit('Forbidden');
    }
}

$settings = ferrn_settings();
if (empty($settings['ai']['enabled'])) exit("AI publishing disabled\n");

$apiKey = (string)getenv('OPENAI_API_KEY');
if ($apiKey === '') exit("OPENAI_API_KEY missing\n");

function ferrn_ai_http(string $url, array $payload, string $key): array {
    $ch = curl_init($url);
    curl_setopt_array($ch, [
        CURLOPT_POST => true,
        CURLOPT_RETURNTRANSFER => true,
        CURLOPT_HTTPHEADER => ['Authorization: Bearer '.$key, 'Content-Type: application/json'],
        CURLOPT_POSTFIELDS => json_encode($payload),
        CURLOPT_TIMEOUT => 120
    ]);
    $raw = curl_exec($ch);
    $code = (int)curl_getinfo($ch, CURLINFO_RESPONSE_CODE);
    curl_close($ch);
    $data = json_decode((string)$raw, true);
    return [$code, is_array($data) ? $data : []];
}

function ferrn_ai_text(array $data): string {
    $text = '';
    foreach (($data['output'] ?? []) as $output) {
        foreach (($output['content'] ?? []) as $content) {
            if (($content['type'] ?? '') === 'output_text') $text .= (string)($content['text'] ?? '');
        }
    }
    return trim($text);
}

function ferrn_ai_json(string $text): array {
    $text = trim($text);
    $text = preg_replace('/^\x60\x60\x60(?:json)?\s*|\s*\x60\x60\x60$/m', '', $text) ?? $text;
    $decoded = json_decode($text, true);
    return is_array($decoded) ? $decoded : [];
}

$region = preg_replace('/[^A-Z]/', '', strtoupper((string)$settings['ai']['trend_region'])) ?: 'NG';
$trends = [];
$rss = @file_get_contents('https://trends.google.com/trending/rss?geo='.rawurlencode($region));
if ($rss) {
    $xml = @simplexml_load_string($rss);
    if ($xml && isset($xml->channel->item)) {
        foreach ($xml->channel->item as $item) $trends[] = trim((string)$item->title);
    }
}

$posts = ferrn_posts();
$recent = array_slice(array_map(fn($post) => (string)($post['title'] ?? ''), $posts), -100);
$limit = max(1, min(10, (int)$settings['ai']['articles_per_day']));

$topicPrompt =
    "Choose up to {$limit} high-intent SEO article topics for Ferrn Agency. ".
    "Ferrn sells conversion-focused websites, custom web applications, portals, dashboards, product design, digital systems and practical AI automation to organisations. ".
    "Use a current trend only when it has a real connection to those services or to a business buyer's search intent. Ignore entertainment, celebrity, sports, politics and unrelated viral stories. ".
    "Mix commercial-intent, problem-aware and educational topics. Avoid duplicate or near-duplicate titles. ".
    "Return ONLY a JSON array. Each object must contain title, primary_keyword, search_intent and angle. ".
    "Current trends: ".json_encode(array_slice($trends, 0, 30)).". ".
    "Existing titles: ".json_encode($recent);

[$topicCode, $topicResponse] = ferrn_ai_http(
    'https://api.openai.com/v1/responses',
    [
        'model' => (string)$settings['ai']['text_model'],
        'input' => $topicPrompt,
        'reasoning' => ['effort' => 'low'],
        'max_output_tokens' => 3000
    ],
    $apiKey
);

if ($topicCode >= 400) exit("Topic generation failed\n");
$topics = ferrn_ai_json(ferrn_ai_text($topicResponse));
if (!$topics) exit("No qualified topics\n");

$documentRoot = rtrim((string)($_SERVER['DOCUMENT_ROOT'] ?? dirname(__DIR__)), '/');
$imageDir = $documentRoot.'/assets/generated';
if (!is_dir($imageDir)) @mkdir($imageDir, 0755, true);

$generated = 0;
foreach (array_slice($topics, 0, $limit) as $topic) {
    if (!is_array($topic) || empty($topic['title'])) continue;

    $title = ferrn_safe_text((string)$topic['title'], 180);
    $slug = ferrn_slugify($title);
    $duplicate = false;
    foreach ($posts as $post) {
        if (($post['slug'] ?? '') === $slug) { $duplicate = true; break; }
    }
    if ($duplicate) continue;

    $articlePrompt =
        "Write a genuinely useful Ferrn Agency insight article for a business decision-maker. ".
        "Topic: ".$title.". Primary keyword: ".($topic['primary_keyword'] ?? '').". ".
        "Search intent: ".($topic['search_intent'] ?? '').". Angle: ".($topic['angle'] ?? '').". ".
        "Requirements: 1200-1800 words, original reasoning, no fake statistics, no fabricated client claims, practical examples, short paragraphs, useful H2/H3 structure, and subtle relevance to Ferrn without sales spam. ".
        "Return ONLY JSON with keys title, category, excerpt, meta_description, content_html and image_prompt. ".
        "content_html may contain only p,h2,h3,strong,ul,ol,li and blockquote elements.";

    [$articleCode, $articleResponse] = ferrn_ai_http(
        'https://api.openai.com/v1/responses',
        [
            'model' => (string)$settings['ai']['text_model'],
            'input' => $articlePrompt,
            'reasoning' => ['effort' => 'low'],
            'max_output_tokens' => 6500
        ],
        $apiKey
    );
    if ($articleCode >= 400) continue;

    $article = ferrn_ai_json(ferrn_ai_text($articleResponse));
    if (empty($article['content_html'])) continue;

    $heroImage = '';
    $imagePrompt = trim((string)($article['image_prompt'] ?? ''));
    if ($imagePrompt !== '') {
        [$imageCode, $imageResponse] = ferrn_ai_http(
            'https://api.openai.com/v1/images/generations',
            [
                'model' => (string)$settings['ai']['image_model'],
                'prompt' => 'Editorial technology image for Ferrn Agency. No text and no logos. '.$imagePrompt,
                'size' => '1536x1024',
                'quality' => 'medium',
                'output_format' => 'webp'
            ],
            $apiKey
        );
        $b64 = (string)($imageResponse['data'][0]['b64_json'] ?? '');
        if ($imageCode < 400 && $b64 !== '') {
            $filename = $slug.'-'.date('Ymd').'.webp';
            if (@file_put_contents($imageDir.'/'.$filename, base64_decode($b64)) !== false) {
                $heroImage = '/assets/generated/'.$filename;
            }
        }
    }

    $contentHtml = ferrn_sanitize_html((string)$article['content_html']);
    if ($heroImage !== '') {
        $contentHtml = '<figure><img src="'.htmlspecialchars($heroImage, ENT_QUOTES).'" alt="'.htmlspecialchars($title, ENT_QUOTES).'" loading="lazy"></figure>'.$contentHtml;
    }

    $now = date(DATE_ATOM);
    $status = !empty($settings['ai']['auto_publish']) ? 'published' : 'draft';
    $posts[] = [
        'id' => ferrn_item_id(),
        'title' => $title,
        'slug' => $slug,
        'category' => ferrn_safe_text((string)($article['category'] ?? 'Digital Strategy'), 100),
        'excerpt' => ferrn_safe_text((string)($article['excerpt'] ?? ''), 300),
        'meta_description' => ferrn_safe_text((string)($article['meta_description'] ?? ''), 180),
        'content' => $contentHtml,
        'hero_image' => $heroImage,
        'status' => $status,
        'source' => 'ai',
        'primary_keyword' => ferrn_safe_text((string)($topic['primary_keyword'] ?? ''), 180),
        'created_at' => $now,
        'updated_at' => $now,
        'published_at' => $status === 'published' ? $now : null
    ];
    $generated++;
}

ferrn_save_json('posts.json', $posts);
echo "Generated {$generated} article(s)\n";
