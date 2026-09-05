<?php
declare(strict_types=1);
require_once __DIR__ . '/storage.php';

function ferrn_default_testimonials(): array {
    return [
        ['id'=>'vanessa','name'=>'Vanessa','role'=>'CEO, Bagzilla','image'=>'https://res.cloudinary.com/dyizdpyem/image/upload/v1774525428/WhatsApp_Image_2026-03-26_at_11.38.36_y99rhu.jpg','audio'=>'https://res.cloudinary.com/dyizdpyem/video/upload/v1774525428/WhatsApp_Audio_2026-03-26_at_11.34.46_cmbcpi.ogg','active'=>true,'sort'=>1],
        ['id'=>'chisom','name'=>'Chisom','role'=>'CEO, Hush D','image'=>'https://res.cloudinary.com/dyizdpyem/image/upload/v1774525428/Screenshot_2026-03-25_at_10.17.36_PM_u3t6hu.png','audio'=>'https://res.cloudinary.com/dyizdpyem/video/upload/v1774525446/Chisom_Okereke_qfoc78.ogg','active'=>true,'sort'=>2],
        ['id'=>'john-sax','name'=>'John Sax','role'=>'CEO, Jstar Films','image'=>'https://res.cloudinary.com/dyizdpyem/image/upload/v1774525428/me_gm1itv.jpg','audio'=>'https://res.cloudinary.com/dyizdpyem/video/upload/v1774525427/John_Sax_djjmeq.ogg','active'=>true,'sort'=>3],
        ['id'=>'ifechukwu','name'=>'Ifechukwu','role'=>'Brand Director, Outbox Experience','image'=>'https://res.cloudinary.com/dyizdpyem/image/upload/v1774535349/WhatsApp_Image_2025-09-06_at_10.17.44_dzj8xi.jpg','audio'=>'https://res.cloudinary.com/dyizdpyem/video/upload/v1774535400/WhatsApp_Audio_2026-03-26_at_13.22.53_ovnohj.ogg','active'=>true,'sort'=>4],
        ['id'=>'nkem','name'=>'Nkem','role'=>'Monitoring & Evaluation Lead, PWAN','image'=>'https://res.cloudinary.com/dyizdpyem/image/upload/v1774553630/Screenshot_2026-03-26_at_6.23.23_PM_u6e1lv.png','audio'=>'https://res.cloudinary.com/dyizdpyem/video/upload/v1774553644/WhatsApp_Audio_2026-03-26_at_6.18.43_PM_pqa6ch.3gp','active'=>true,'sort'=>5],
        ['id'=>'elsa','name'=>'Elsa','role'=>'Upwork Client','image'=>'https://res.cloudinary.com/dyizdpyem/image/upload/v1777105055/Elsa_ccnhsh.jpg','audio'=>'https://res.cloudinary.com/dyizdpyem/video/upload/v1777105046/Elsa_wxbent.mp3','active'=>true,'sort'=>6],
        ['id'=>'mark','name'=>'Mark','role'=>'Startup Founder, UrbanixNest','image'=>'https://res.cloudinary.com/dyizdpyem/image/upload/v1777104987/Mark_l7a0ys.jpg','audio'=>'https://res.cloudinary.com/dyizdpyem/video/upload/v1777104985/Mark_wkx4ix.mp3','active'=>true,'sort'=>7],
        ['id'=>'stan','name'=>'Stan','role'=>'Founder, Upwork Client','image'=>'https://res.cloudinary.com/dyizdpyem/image/upload/v1777104925/stan_qv4rvo.jpg','audio'=>'https://res.cloudinary.com/dyizdpyem/video/upload/v1777104866/Stan_qag6is.mp3','active'=>true,'sort'=>8],
    ];
}

function ferrn_testimonials(): array {
    $items = ferrn_load_json('testimonials.json', ferrn_default_testimonials());
    usort($items, fn($a,$b) => ((int)($a['sort']??999)) <=> ((int)($b['sort']??999)));
    return $items;
}

function ferrn_public_testimonials(): array {
    return array_values(array_filter(ferrn_testimonials(), fn($t) => !empty($t['active'])));
}

function ferrn_save_testimonials(array $items): bool {
    usort($items, fn($a,$b) => ((int)($a['sort']??999)) <=> ((int)($b['sort']??999)));
    return ferrn_save_json('testimonials.json', array_values($items));
}
