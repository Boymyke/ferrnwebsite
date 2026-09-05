<?php
ob_start(function(string $html): string {
  $html = str_replace('Ferrn Studio', 'Ferrn Digital Agency', $html);
  $html = str_replace('Private content and enquiry dashboard.', 'Private content, blog and enquiry dashboard.', $html);
  return $html;
});
require __DIR__.'/../studio/index.php';
