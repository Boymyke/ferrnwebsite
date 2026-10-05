<?php
declare(strict_types=1);
require_once __DIR__.'/storage.php';

function ferrn_secret_key():string {
    $keyfile=ferrn_storage_dir().'/.secret-key';
    if(!is_file($keyfile)){
        $raw=random_bytes(32);
        $h=@fopen($keyfile,'x');
        if(!$h)throw new RuntimeException('Private key storage is unavailable. Check the private storage directory permissions.');
        @chmod($keyfile,0600);
        fwrite($h,base64_encode($raw));
        fclose($h);
    }
    $k=base64_decode(trim((string)@file_get_contents($keyfile)),true);
    if($k===false||strlen($k)!==32)throw new RuntimeException('Encrypted key storage is invalid.');
    return $k;
}

function ferrn_store_api_key(string $apiKey):void {
    $path=ferrn_storage_dir().'/.openai-credential';
    $key=ferrn_secret_key();
    if(function_exists('sodium_crypto_secretbox')){
        $nonce=random_bytes(SODIUM_CRYPTO_SECRETBOX_NONCEBYTES);
        $cipher=sodium_crypto_secretbox($apiKey,$nonce,$key);
        $envelope=['v'=>2,'alg'=>'sodium-secretbox','nonce'=>base64_encode($nonce),'cipher'=>base64_encode($cipher)];
    }elseif(function_exists('openssl_encrypt')){
        $iv=random_bytes(12);$tag='';
        $cipher=openssl_encrypt($apiKey,'aes-256-gcm',$key,OPENSSL_RAW_DATA,$iv,$tag,'ferrn-openai-key');
        if($cipher===false)throw new RuntimeException('OpenSSL could not encrypt the API credential.');
        $envelope=['v'=>2,'alg'=>'aes-256-gcm','iv'=>base64_encode($iv),'tag'=>base64_encode($tag),'cipher'=>base64_encode($cipher)];
    }else{
        throw new RuntimeException('This PHP installation needs either Sodium or OpenSSL enabled to store API credentials securely.');
    }
    $tmp=$path.'.tmp';
    $encoded=json_encode($envelope,JSON_UNESCAPED_SLASHES);
    if($encoded===false||file_put_contents($tmp,$encoded,LOCK_EX)===false)throw new RuntimeException('Could not save the API credential. Check private storage write permissions.');
    @chmod($tmp,0600);
    if(!@rename($tmp,$path)){@unlink($tmp);throw new RuntimeException('Could not finalize secure credential storage.');}
}

function ferrn_read_stored_api_key():string {
    $path=ferrn_storage_dir().'/.openai-credential';
    if(!is_file($path))return '';
    try{
        $raw=(string)file_get_contents($path);
        $decoded=json_decode($raw,true);
        $key=ferrn_secret_key();
        if(is_array($decoded)&&($decoded['v']??0)===2){
            if(($decoded['alg']??'')==='sodium-secretbox'&&function_exists('sodium_crypto_secretbox_open')){
                $nonce=base64_decode((string)($decoded['nonce']??''),true);$cipher=base64_decode((string)($decoded['cipher']??''),true);
                if($nonce===false||$cipher===false)return '';
                $plain=sodium_crypto_secretbox_open($cipher,$nonce,$key);return $plain===false?'':$plain;
            }
            if(($decoded['alg']??'')==='aes-256-gcm'&&function_exists('openssl_decrypt')){
                $iv=base64_decode((string)($decoded['iv']??''),true);$tag=base64_decode((string)($decoded['tag']??''),true);$cipher=base64_decode((string)($decoded['cipher']??''),true);
                if($iv===false||$tag===false||$cipher===false)return '';
                $plain=openssl_decrypt($cipher,'aes-256-gcm',$key,OPENSSL_RAW_DATA,$iv,$tag,'ferrn-openai-key');return $plain===false?'':$plain;
            }
            return '';
        }
        /* Backward compatibility with the original Sodium-only credential format. */
        if(function_exists('sodium_crypto_secretbox_open')){
            $data=base64_decode($raw,true);
            if($data!==false&&strlen($data)>=SODIUM_CRYPTO_SECRETBOX_NONCEBYTES){
                $nonce=substr($data,0,SODIUM_CRYPTO_SECRETBOX_NONCEBYTES);$cipher=substr($data,SODIUM_CRYPTO_SECRETBOX_NONCEBYTES);
                $plain=sodium_crypto_secretbox_open($cipher,$nonce,$key);return $plain===false?'':$plain;
            }
        }
    }catch(Throwable $e){}
    return '';
}

function ferrn_get_api_key():string {
    $env=trim((string)getenv('OPENAI_API_KEY'));
    if($env!=='')return $env;
    return ferrn_read_stored_api_key();
}

function ferrn_api_key_source():string {
    if(trim((string)getenv('OPENAI_API_KEY'))!=='')return 'environment';
    return ferrn_read_stored_api_key()!==''?'encrypted_storage':'none';
}
