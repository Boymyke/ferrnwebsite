<?php
declare(strict_types=1);
require_once __DIR__ . '/storage.php';

function ferrn_default_projects(): array {
    return require __DIR__ . '/../data/projects.php';
}

function ferrn_projects(): array {
    $path = ferrn_storage_dir() . '/projects.json';
    if (!is_file($path)) return ferrn_default_projects();
    return ferrn_load_json('projects.json', ferrn_default_projects());
}

function ferrn_save_projects(array $projects): bool {
    return ferrn_save_json('projects.json', $projects);
}

function ferrn_project_points(string $category): array {
    return match ($category) {
        'webapp' => [
            ['workflow','Workflow clarity','Turns fragmented operational steps into one visible system.'],
            ['layout-dashboard','Shared visibility','Gives teams a clearer view of status, actions and exceptions.'],
            ['chart-no-axes-combined','Business leverage','Reduces manual coordination and makes important states easier to act on.'],
        ],
        'ai' => [
            ['bot','Useful AI interaction','AI is applied to a defined user problem instead of added as decoration.'],
            ['messages-square','Faster access to answers','Users can get relevant guidance through a conversational experience.'],
            ['shield-check','Guardrails and trust','The experience is designed around clear scope, responsible guidance and usability.'],
        ],
        default => [
            ['badge-check','Credibility first','The experience makes the strongest reasons to trust the business easier to find.'],
            ['waypoints','Clear user journeys','Visitors move from understanding the offer to the right next action with less friction.'],
            ['mouse-pointer-click','Conversion focus','Content, proof and calls to action work together as a commercial experience.'],
        ],
    };
}

function ferrn_screenshot_url(string $url): string {
    return 'https://image.thum.io/get/width/1400/crop/900/noanimate/' . $url;
}
