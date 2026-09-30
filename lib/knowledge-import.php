<?php
declare(strict_types=1);
require_once __DIR__.'/platform.php';
/* Sources are extracted privately; the public chatbot never gets file paths. */
function ferrn_import_knowledge_pdf(array $f): array {
    if(($f['error']??UPLOAD_ERR_NO_FILE)!==UPLOAD_ERR_OK)throw new RuntimeException('Choose a PDF to upload.');
    if(($f['size']??0)<1 || ($f['size']??0)>8*1024*1024)throw new RuntimeException('PDF must be between 1 byte and 8 MB.');
    $mime=(new finfo(FILEINFO_MIME_TYPE))->file((string)$f['tmp_name']);
    $head=@file_get_contents((string)$f['tmp_name'],false,null,0,5);
    if($mime!=='application/pdf'||$head!=='%PDF-')throw new RuntimeException('Only real PDF documents are accepted.');
    $exe=null;
    foreach(['/usr/bin/pdftotext','/usr/local/bin/pdftotext'] as $path){if(is_executable($path)){$exe=$path;break;}}
    if($exe===null)throw new RuntimeException('PDF extraction is not enabled on this hosting account. Install Poppler pdftotext or paste the approved content manually.');
    $dir=ferrn_storage_dir().'/knowledge-documents';
    if(!is_dir($dir) && !@mkdir($dir,0700,true))throw new RuntimeException('Private document directory unavailable.');
    $file=bin2hex(random_bytes(14)).'.pdf';$dest=$dir.'/'.$file;
    if(!move_uploaded_file((string)$f['tmp_name'],$dest))throw new RuntimeException('Could not store the PDF.');
    @chmod($dest,0600);
    try{
        $pipes=[];$process=proc_open([$exe,'-layout','-nopgbrk',$dest,'-'],[0=>['pipe','r'],1=>['pipe','w'],2=>['pipe','w']],$pipes,null,['PATH'=>'/usr/bin:/bin']);
        if(!is_resource($process))throw new RuntimeException('PDF extraction did not start.');
        fclose($pipes[0]);$txt=stream_get_contents($pipes[1],400000);fclose($pipes[1]);$err=stream_get_contents($pipes[2],300);fclose($pipes[2]);$code=proc_close($process);
        $txt=trim((string)$txt);
        if($code!==0||$txt==='')throw new RuntimeException('The PDF has no extractable text. A scanned document needs OCR before uploading.');
        return ['content'=>mb_substr($txt,0,35000),'source_type'=>'pdf','source_name'=>basename((string)($f['name']??'Document.pdf')),'stored_file'=>$file];
    }catch(Throwable $e){@unlink($dest);throw $e;}
}
function ferrn_public_website_ip(string $ip): bool {
    return filter_var($ip,FILTER_VALIDATE_IP,FILTER_FLAG_NO_PRIV_RANGE|FILTER_FLAG_NO_RES_RANGE)!==false;
}
function ferrn_import_knowledge_url(string $url): array {
    $p=parse_url($url);
    if(!is_array($p)||strtolower($p['scheme']??'')!=='https'||empty($p['host'])||isset($p['user'])||isset($p['pass'])||isset($p['port'])||isset($p['fragment']))throw new RuntimeException('Use a public HTTPS webpage without credentials or a custom port.');
    $host=strtolower($p['host']);
    if($host==='localhost'||str_ends_with($host,'.local')||str_ends_with($host,'.internal'))throw new RuntimeException('Only public webpages are supported.');
    if(filter_var($host,FILTER_VALIDATE_IP))throw new RuntimeException('Use a public HTTPS website hostname.');
    $ips=@gethostbynamel($host);
    if(!$ips)throw new RuntimeException('The website hostname could not be resolved.');
    foreach($ips as $ip)if(!ferrn_public_website_ip($ip))throw new RuntimeException('Private or reserved network addresses cannot be imported.');
    if(!function_exists('curl_init'))throw new RuntimeException('HTTPS importing requires the PHP cURL extension.');
    $ch=curl_init($url);
    curl_setopt_array($ch,[
        CURLOPT_RETURNTRANSFER=>true,CURLOPT_FOLLOWLOCATION=>false,CURLOPT_CONNECTTIMEOUT=>5,CURLOPT_TIMEOUT=>12,
        CURLOPT_SSL_VERIFYPEER=>true,CURLOPT_SSL_VERIFYHOST=>2,CURLOPT_HTTPHEADER=>['Accept: text/html, text/plain','User-Agent: FerrnKnowledgeImporter/1.0'],
        CURLOPT_MAXREDIRS=>0,CURLOPT_RESOLVE=>array_map(fn($ip)=>$host.':443:'.$ip,$ips),
        CURLOPT_PROTOCOLS=>CURLPROTO_HTTPS
    ]);
    $html=curl_exec($ch);$status=(int)curl_getinfo($ch,CURLINFO_RESPONSE_CODE);$mime=(string)curl_getinfo($ch,CURLINFO_CONTENT_TYPE);$error=curl_error($ch);curl_close($ch);
    if($html===false||$status!==200)throw new RuntimeException('The website could not be imported (HTTP '.$status.'). '.$error);
    if(strlen($html)>700000)throw new RuntimeException('This webpage is too large to import.');
    if(!preg_match('~^(text/html|text/plain)~i',$mime))throw new RuntimeException('Provide an HTML or text webpage URL.');
    $html=preg_replace('~<(script|style|nav|footer|header|noscript)[^>]*>.*?</\\1>~is',' ',(string)$html);
    $txt=trim(preg_replace('/\\s+/u',' ',html_entity_decode(strip_tags((string)$html),ENT_QUOTES|ENT_HTML5,'UTF-8'))??'');
    if($txt==='')throw new RuntimeException('No readable webpage text was found.');
    return ['content'=>mb_substr($txt,0,35000),'source_type'=>'website','source_name'=>$url,'source_url'=>$url];
}
