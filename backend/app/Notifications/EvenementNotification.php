<?php

namespace App\Notifications;

use Illuminate\Notifications\Notification;

class EvenementNotification extends Notification
{
    public function __construct(
        private string $type,
        private string $titre,
        private string $message,
        private ?int $transactionId = null,
    ) {}

    public function via(object $notifiable): array
    {
        return ['database'];
    }

    public function toArray(object $notifiable): array
    {
        return [
            'type'           => $this->type,
            'titre'          => $this->titre,
            'message'        => $this->message,
            'transaction_id' => $this->transactionId,
        ];
    }
}