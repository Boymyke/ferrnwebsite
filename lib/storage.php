<?php
declare(strict_types=1);
date_default_timezone_set('Africa/Lagos');

function ferrn_storage_dir(): string {
    $root = rtrim((string)($_SERVER['DOCUMENT_ROOT'] ?? ''), '/');
    $home = $root !== '' ? dirname($root) : sys_get_temp_dir();
    $dir = $home . '/ferrn_cms';
    if (!is_dir($dir)) { @mkdir($dir, 0750, true); }
    return $dir;
}

function ferrn_load_json(string $file, array $default = []): array {
    $path = ferrn_storage_dir() . '/' . $file;
    if (!is_file($path)) {
        ferrn_save_json($file, $default);
        return $default;
    }
    $raw = @file_get_contents($path);
    if ($raw === false || trim($raw) === '') return $default;
    $data = json_decode($raw, true);
    return is_array($data) ? $data : $default;
}

function ferrn_save_json(string $file, array $data): bool {
    $dir = ferrn_storage_dir();
    $path = $dir . '/' . $file;
    $tmp = $path . '.tmp';
    $json = json_encode($data, JSON_PRETTY_PRINT | JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE);
    if ($json === false) return false;
    if (@file_put_contents($tmp, $json, LOCK_EX) === false) return false;
    @chmod($tmp, 0640);
    return @rename($tmp, $path);
}

function ferrn_slugify(string $value): string {
    $value = strtolower(trim($value));
    $value = preg_replace('/[^a-z0-9]+/', '-', $value) ?? '';
    return trim($value, '-') ?: 'post-' . date('Ymd-His');
}

function ferrn_excerpt(string $html, int $limit = 180): string {
    $plain = trim(preg_replace('/\s+/', ' ', strip_tags($html)) ?? '');
    if (mb_strlen($plain) <= $limit) return $plain;
    return rtrim(mb_substr($plain, 0, $limit - 1)) . '…';
}

function ferrn_sanitize_html(string $html): string {
    $allowed = '<p><br><h2><h3><h4><strong><em><a><ul><ol><li><blockquote><code><pre><img><figure><figcaption><hr>';
    $clean = strip_tags($html, $allowed);
    $clean = preg_replace('/\son\w+\s*=\s*(["\']).*?\1/iu', '', $clean) ?? $clean;
    $clean = preg_replace('/javascript\s*:/iu', '', $clean) ?? $clean;
    return $clean;
}

function ferrn_default_posts(): array {
    return [
        ['id'=>'seed-website-webapp','title'=>'Website or web app: what does your business actually need?','slug'=>'website-or-web-app-what-does-your-business-actually-need','category'=>'Strategy','excerpt'=>'A website sells the business. A web application helps run it. Here is how to know which problem you are really solving.','content'=>'<p>A lot of digital projects start with the wrong question: <strong>“What should we build?”</strong> The better question is: <strong>“What is stopping the business from making money, saving time, or serving customers better?”</strong></p><h2>Choose a website when the problem is trust, clarity or demand</h2><p>If prospects do not understand what you do, your credibility is buried, or enquiries are weak, the first problem is usually your public-facing experience. A conversion-focused website should make the value clear, prove the business is credible and give the right visitor an obvious next action.</p><h2>Choose a web app when the problem lives inside the workflow</h2><p>If teams are copying data between spreadsheets, approvals disappear in email, customers cannot see status, or reporting takes hours of manual work, you are dealing with an operational problem. That is where a custom portal, dashboard or workflow system can be the better investment.</p><h2>Sometimes the answer is both</h2><p>The strongest digital systems connect the commercial front door to the operation behind it. A good website can create qualified demand; a good application can make delivering on that demand faster and more reliable.</p>','status'=>'published','created_at'=>'2026-09-05T00:00:00+01:00','updated_at'=>'2026-09-05T00:00:00+01:00','published_at'=>'2026-09-05T00:00:00+01:00'],
        ['id'=>'seed-b2b-convert','title'=>'What makes a B2B website convert in 2026?','slug'=>'what-makes-a-b2b-website-convert-in-2026','category'=>'Web Design','excerpt'=>'Modern visuals help, but buyers convert because the site reduces uncertainty. These are the signals that matter most.','content'=>'<p>Beautiful design gets attention. It does not automatically create pipeline. A strong B2B website reduces the questions a serious buyer has to answer before they feel safe starting a conversation.</p><h2>Make the value obvious before listing features</h2><p>Lead with the business problem you solve, who you solve it for, and the outcome the customer is trying to create. Service lists are supporting evidence, not the headline.</p><h2>Put proof close to the promise</h2><p>Projects, client logos, accreditations, product screenshots, testimonials and specific examples should sit near the claims they support. Buyers should not have to dig through five pages to discover why you are credible.</p><h2>Design the next action around intent</h2><p>Not every visitor wants a 45-minute call. Strong sites give high-intent buyers a direct route while still allowing earlier-stage visitors to inspect work, understand process and learn how you think.</p>','status'=>'published','created_at'=>'2026-09-05T00:00:00+01:00','updated_at'=>'2026-09-05T00:00:00+01:00','published_at'=>'2026-09-05T00:00:00+01:00'],
        ['id'=>'seed-spreadsheets','title'=>'When spreadsheets become a growth problem','slug'=>'when-spreadsheets-become-a-growth-problem','category'=>'Web Applications','excerpt'=>'Spreadsheets are excellent tools—until the business starts relying on them as databases, approval systems and customer portals at the same time.','content'=>'<p>Spreadsheets are not the enemy. They are often the fastest way to prove a process. The problem begins when a growing team quietly turns one sheet into the operating system for the whole company.</p><h2>Watch for repeated copying and reconciliation</h2><p>If the same customer, job or payment information is being re-entered across multiple files, the business is paying a hidden admin tax every week.</p><h2>Watch for invisible status</h2><p>When someone has to ask a colleague, search WhatsApp or inspect several tabs just to know what happens next, the workflow no longer has a dependable source of truth.</p><h2>Productise the workflow, not the spreadsheet</h2><p>A useful custom application should not simply recreate rows and columns in a browser. It should model the actual job: the people, states, approvals, alerts, documents and actions that move work forward.</p>','status'=>'published','created_at'=>'2026-09-05T00:00:00+01:00','updated_at'=>'2026-09-05T00:00:00+01:00','published_at'=>'2026-09-05T00:00:00+01:00']
    ];
}

function ferrn_posts(): array { return ferrn_load_json('posts.json', ferrn_default_posts()); }
function ferrn_leads(): array { return ferrn_load_json('leads.json', []); }
