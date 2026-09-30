<?php
declare(strict_types=1);
require_once __DIR__.'/storage.php';
/* The encryption key and ciphertext are both kept outside the document root,
   with restrictive permissions. Prefer a hosting environment secret when set. */
function ferrn_secret_key():string {
    $keyfile=ferrn_storage_dir().'/.secret-key';
    if(!is_file($keyfile)){
        $h=@fopen($keyfile,'x');
        if(!$h)throw new RuntimeException('Private key storage is unavailable.');
        @chmod($keyfile,0600);
        fwrite($h,base64_encode(random_bytes(SODIUM_CRYPTO_SECRETBOX_KEYBYTES)));
        fclose($h);
    }
    $k=base64_decode(trim((string)@file_get_contents($keyfile)),true);
    if($k===false||strlen($k)!==SODIUM_CRYPTO_SECRETBOX_KEYBYTES)throw new RuntimeException('Encrypted key storage is invalid.');
    return $k;
}
function ferrn_store_api_key(string $apiKey):void {
    if(!function_exists('sodium_crypto_secretbox'))throw new RuntimeException('Enable the PHP Sodium extension before saving API keys.');
    $path=ferrn_storage_dir().'/.openai-credential';
    $nonce=random_bytes(SODIUM_CRYPTO_SECRETBOX_NONCEBYTES);
    $cipher=sodium_crypto_secretbox($apiKey,$nonce,ferrn_secret_key());
    $tmp=$path.'.tmp';
    if(file_put_contents($tmp,base64_encode($nonce.$cipher),LOCK_EX)===false)throw new RuntimeException('Could not save the API credential.');
    @chmod($tmp,0600);if(!rename($tmp,$path))throw new RuntimeException('Could not finalize secure credential storage.');
}
function ferrn_get_api_key():string {
    $env=trim((string)getenv('OPENAI_API_KEY'));
    if($env!=='')return $env;
    $path=ferrn_storage_dir().'/.openai-credential';
    if(!is_file($path)||!function_exists('sodium_crypto_secretbox_open'))return '';
    try{
        $data=base64_decode((string)file_get_contents($path),true);
        if($data===false||strlen($data)<SODIUM_CRYPTO_SECRETBOX_NONCEBYTES)return '';
        $nonce=substr($data,0,SODIUM_CRYPTO_SECRETBOX_NONCEBYTES);
        $cipher=substr($data,SODIUM_CRYPTO_SECRETBOX_NONCEBYTES);
        $plain=sodium_crypto_secretbox_open($cipher,$nonce,ferrn_secret_key());
        return $plain===false?'':$plain;
    }catch(Throwable $e){return '';}
}
