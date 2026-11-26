<?php

namespace App\Modules\Billing\Support;

use App\Modules\Billing\Models\Subscription;
use Carbon\Carbon;

class SubscriptionState
{
    /**
     * Determine if a subscription permits write (POST/PUT/PATCH/DELETE) operations.
     */
    public static function isWritable(?Subscription $subscription): bool
    {
        if ($subscription === null) {
            return false;
        }

        return in_array($subscription->status, [
            Subscription::STATUS_TRIAL,
            Subscription::STATUS_ACTIVE,
            Subscription::STATUS_GRACE,
        ], true);
    }

    /**
     * Determine if a subscription is in a read-only or restricted state.
     */
    public static function isReadOnly(?Subscription $subscription): bool
    {
        return ! self::isWritable($subscription);
    }

    /**
     * Return banner metadata for display in the layout header/banner.
     *
     * @return array{type: string, title: string, message: string, action_label: string, action_url: string}|null
     */
    public static function banner(?Subscription $subscription, string $locale = 'en'): ?array
    {
        if ($subscription === null) {
            return [
                'type' => 'error',
                'title' => $locale === 'bn' ? 'কোনো সক্রিয় সাবস্ক্রিপশন নেই' : 'No Active Subscription',
                'message' => $locale === 'bn'
                    ? 'আপনার ফার্মেসির সাবস্ক্রিপশন মেয়াদোত্তীর্ণ হওয়ায় ওয়ার্কস্পেস রিড-অনলি মোডে রয়েছে।'
                    : 'Your pharmacy does not have an active subscription and is in read-only mode.',
                'action_label' => $locale === 'bn' ? 'প্ল্যান দেখুন' : 'Browse Plans',
                'action_url' => '/billing/plans',
            ];
        }

        if ($subscription->status === Subscription::STATUS_GRACE) {
            $until = $subscription->grace_until ? $subscription->grace_until->format('d M Y') : 'soon';
            return [
                'type' => 'warning',
                'title' => $locale === 'bn' ? 'গ্রেস পিরিয়ড চলছে' : 'Grace Period Active',
                'message' => $locale === 'bn'
                    ? "আপনার সাবস্ক্রিপশনের মেয়াদ শেষ হয়েছে। {$until} তারিখ পর্যন্ত গ্রেস পিরিয়ড সক্রিয় থাকবে, এরপর রিড-অনলি মোড শুরু হবে।"
                    : "Your subscription expired. You have until {$until} before read-only mode begins.",
                'action_label' => $locale === 'bn' ? 'রিনিউ করুন' : 'Renew Now',
                'action_url' => '/billing/plans',
            ];
        }

        if (in_array($subscription->status, [
            Subscription::STATUS_READ_ONLY,
            Subscription::STATUS_ARCHIVED,
            Subscription::STATUS_PENDING_DELETE,
            Subscription::STATUS_CANCELLED,
        ], true)) {
            return [
                'type' => 'error',
                'title' => $locale === 'bn' ? 'রিড-অনলি মোড' : 'Read-Only Mode',
                'message' => $locale === 'bn'
                    ? 'আপনার ওয়ার্কস্পেস বর্তমানে রিড-অনলি মোডে রয়েছে। তথ্য পরিবর্তন বা নতুন এন্ট্রি করতে প্ল্যান আপগ্রেড করুন।'
                    : 'This workspace is currently in read-only mode. Renew or upgrade to modify data.',
                'action_label' => $locale === 'bn' ? 'প্ল্যান আপগ্রেড' : 'Upgrade Plan',
                'action_url' => '/billing/plans',
            ];
        }

        if ($subscription->status === Subscription::STATUS_TRIAL) {
            $daysLeft = $subscription->daysLeft();
            if ($daysLeft <= 3) {
                return [
                    'type' => 'warning',
                    'title' => $locale === 'bn' ? 'ট্রায়াল শেষ হতে চলেছে' : 'Trial Ending Soon',
                    'message' => $locale === 'bn'
                        ? "আপনার ১৪-দিনের ফ্রি ট্রায়ালের আর মাত্র {$daysLeft} দিন বাকি আছে।"
                        : "Your free trial will expire in {$daysLeft} day(s). Upgrade to keep uninterrupted access.",
                    'action_label' => $locale === 'bn' ? 'প্ল্যান বাছুন' : 'Select Plan',
                    'action_url' => '/billing/plans',
                ];
            }
        }

        return null;
    }

    /**
     * Format a badge for the UI.
     *
     * @return array{label: string, color: string}
     */
    public static function statusBadge(?Subscription $subscription): array
    {
        if ($subscription === null) {
            return ['label' => 'No Subscription', 'color' => 'gray'];
        }

        return match ($subscription->status) {
            Subscription::STATUS_ACTIVE => ['label' => 'Active', 'color' => 'emerald'],
            Subscription::STATUS_TRIAL => ['label' => 'Free Trial', 'color' => 'sky'],
            Subscription::STATUS_GRACE => ['label' => 'Grace Period', 'color' => 'amber'],
            Subscription::STATUS_READ_ONLY => ['label' => 'Read-Only', 'color' => 'rose'],
            Subscription::STATUS_ARCHIVED => ['label' => 'Archived', 'color' => 'zinc'],
            Subscription::STATUS_PENDING_DELETE => ['label' => 'Pending Deletion', 'color' => 'red'],
            Subscription::STATUS_CANCELLED => ['label' => 'Cancelled', 'color' => 'slate'],
            default => ['label' => ucfirst($subscription->status), 'color' => 'gray'],
        };
    }
}

