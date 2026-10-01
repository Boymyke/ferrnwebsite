<?php
declare(strict_types=1);
/* GitHub Actions only. Populates a disposable private CMS directory next to the runner checkout. */
$_SERVER['DOCUMENT_ROOT']=realpath(__DIR__.'/..');
require_once __DIR__.'/../lib/admin-users.php';
ferrn_save_json('admin-auth.json',[
 'email'=>'qa-super@example.invalid',
 'password_hash'=>password_hash('QA-super-passphrase-2026',PASSWORD_DEFAULT),
 'password_changed'=>true
]);
ferrn_save_admin_users([
 ['id'=>'qa-limited','name'=>'QA Limited','email'=>'qa-limited@example.invalid',
 'password_hash'=>password_hash('QA-limited-passphrase-2026',PASSWORD_DEFAULT),'active'=>true,
 'role'=>'admin','must_change'=>false,'permissions'=>['dashboard'=>true,'leads'=>true,'settings'=>false,'testimonials'=>false]]
]);
ferrn_save_json('leads.json',[
 ['id'=>'qa-seed','name'=>'QA Lead','email'=>'qa-lead@example.invalid','company'=>'Test','project'=>'Website','budget'=>'','timeline'=>'','message'=>'Synthetic test enquiry','status'=>'new','created_at'=>date(DATE_ATOM)]
]);
echo "Prepared disposable QA credentials.\n";
