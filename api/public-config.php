<?php
declare(strict_types=1);
require_once __DIR__.'/../lib/platform.php';
$s=ferrn_settings();ferrn_json_response(['ok'=>true,'chatbot'=>['enabled'=>(bool)$s['chatbot']['enabled'],'name'=>$s['chatbot']['name'],'welcome'=>$s['chatbot']['welcome'],'booking_url'=>$s['contact']['booking_url']],'contact'=>['email'=>$s['contact']['email'],'phone'=>$s['contact']['phone']]]);
