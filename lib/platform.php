<?php
declare(strict_types=1);
require_once __DIR__.'/storage.php';

function ferrn_load_private_env(): void {
    $path=ferrn_storage_dir().'/.env';
    if(!is_file($path)) return;
    $lines=@file($path, FILE_IGNORE_NEW_LINES | FILE_SKIP_EMPTY_LINES);
    if(!is_array($lines)) return;
    foreach($lines as $line){
        $line=trim((string)$line);
        if($line==='' || str_starts_with($line,'#') || !str_contains($line,'=')) continue;
        [$key,$value]=array_map('trim',explode('=',$line,2));
        if($key==='' || !preg_match('/^[A-Z0-9_]+$/',$key)) continue;
        if((string)getenv($key)===''){
            $value=trim($value," \t\n\r\0\x0B\"'");
            putenv($key.'='.$value);
            $_ENV[$key]=$value;
        }
    }
}
ferrn_load_private_env();

function ferrn_default_settings(): array {
    return [
        'brand'=>[
            'name'=>'Ferrn Agency',
            'legal_name'=>'Ferrn Agency',
            'tagline'=>"We Build What’s Next.",
            'primary_color'=>'#ff4100',
            'font'=>'Poppins'
        ],
        'contact'=>[
            'email'=>'info@ferrnagency.com',
            'phone'=>'',
            'booking_url'=>'https://cal.com/ferrn-agency',
            'address'=>'',
            'country'=>'Nigeria'
        ],
        'company'=>[
            'registration_jurisdiction'=>'Nigeria',
            'registration_number'=>'',
            'year_established'=>'',
            'ownership_structure'=>'',
            'tax_information'=>'',
            'geographic_coverage'=>'Nigeria · United Kingdom · United States · Canada · Australia · Remote/Global',
            'procurement_contact'=>'info@ferrnagency.com',
            'capability_statement_url'=>'',
            'company_profile_url'=>''
        ],
        'ai'=>[
            'enabled'=>false,
            'articles_per_day'=>10,
            'trend_region'=>'NG',
            'text_model'=>'gpt-5.6-terra',
            'image_model'=>'gpt-image-2.5-flare',
            'auto_publish'=>false
        ],
        'analytics'=>['enabled'=>true,'consent_required'=>true],
        'chatbot'=>['enabled'=>true,'name'=>'Ferrn Assistant','welcome'=>'Tell me what you are trying to build or improve.']
    ];
}

function ferrn_settings(): array {
    return array_replace_recursive(ferrn_default_settings(), ferrn_load_json('settings.json', []));
}

function ferrn_save_settings(array $settings): bool {
    return ferrn_save_json('settings.json', array_replace_recursive(ferrn_default_settings(), $settings));
}

function ferrn_setting(string $path, mixed $default=null): mixed {
    $value=ferrn_settings();
    foreach(explode('.', $path) as $key){
        if(!is_array($value) || !array_key_exists($key,$value)) return $default;
        $value=$value[$key];
    }
    return $value;
}

function ferrn_collection(string $name, array $default=[]): array {
    return ferrn_load_json($name.'.json',$default);
}

function ferrn_save_collection(string $name,array $items): bool {
    return ferrn_save_json($name.'.json',array_values($items));
}

function ferrn_item_id(): string { return bin2hex(random_bytes(8)); }

function ferrn_public_collections(): array {
    return [
        'team'=>ferrn_collection('team'),
        'certifications'=>ferrn_collection('certifications'),
        'awards'=>ferrn_collection('awards'),
        'policies'=>ferrn_collection('policies', ferrn_default_policies())
    ];
}

function ferrn_default_policies(): array {
    $titles=[
        'Privacy Policy','Cookie Policy','Terms of Use','Data Protection Policy',
        'Information Security Policy','Acceptable Use Policy','Accessibility Statement',
        'Modern Slavery Statement','Anti-Bribery / Anti-Corruption Policy',
        'Conflict of Interest Policy','Code of Conduct'
    ];
    $out=[];
    foreach($titles as $title){
        $out[]=['id'=>ferrn_slugify($title),'slug'=>ferrn_slugify($title),'title'=>$title,'summary'=>'','content'=>'','published'=>false,'updated_at'=>date(DATE_ATOM)];
    }
    return $out;
}

function ferrn_safe_text(string $value,int $max=5000): string {
    $value=trim(preg_replace('/\s+/u',' ',$value)??'');
    return mb_substr($value,0,$max);
}

function ferrn_current_origin(): string {
    $https=(!empty($_SERVER['HTTPS']) && $_SERVER['HTTPS']!=='off');
    $host=$_SERVER['HTTP_HOST']??'www.ferrnagency.com';
    return ($https?'https':'http').'://'.$host;
}

function ferrn_json_response(array $data,int $status=200): never {
    http_response_code($status);
    header('Content-Type: application/json; charset=utf-8');
    header('Cache-Control: no-store');
    echo json_encode($data,JSON_UNESCAPED_SLASHES|JSON_UNESCAPED_UNICODE);
    exit;
}
