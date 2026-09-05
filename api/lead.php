<?php
declare(strict_types=1);
require_once __DIR__ . '/../lib/storage.php';
header('Content-Type: application/json; charset=utf-8');
if ($_SERVER['REQUEST_METHOD'] !== 'POST') { http_response_code(405); echo json_encode(['ok'=>false,'message'=>'Method not allowed.']); exit; }
if (!empty($_POST['website'] ?? '')) { echo json_encode(['ok'=>true]); exit; }
$name=trim((string)($_POST['name']??'')); $email=trim((string)($_POST['email']??'')); $company=trim((string)($_POST['company']??'')); $project=trim((string)($_POST['project']??'')); $budget=trim((string)($_POST['budget']??'')); $timeline=trim((string)($_POST['timeline']??'')); $message=trim((string)($_POST['message']??''));
if ($name==='' || !filter_var($email,FILTER_VALIDATE_EMAIL) || $message==='') { http_response_code(422); echo json_encode(['ok'=>false,'message'=>'Please add your name, a valid email and a short project brief.']); exit; }
$leads=ferrn_leads(); $leads[]=['id'=>bin2hex(random_bytes(6)),'name'=>$name,'email'=>$email,'company'=>$company,'project'=>$project,'budget'=>$budget,'timeline'=>$timeline,'message'=>$message,'status'=>'new','created_at'=>date(DATE_ATOM)];
if (!ferrn_save_json('leads.json',$leads)) { http_response_code(500); echo json_encode(['ok'=>false,'message'=>'Could not save your enquiry. Please email info@ferrnagency.com.']); exit; }
echo json_encode(['ok'=>true]);
