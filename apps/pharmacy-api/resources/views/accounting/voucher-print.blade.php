@php
    use App\Modules\Accounting\Services\MoneyPaisa;
    $isBn = ($lang ?? 'en') === 'bn';
    $typeLabelsEn = [
        'receipt' => 'Receipt Voucher',
        'payment' => 'Payment Voucher',
        'journal' => 'Journal Voucher',
        'contra' => 'Contra Voucher',
        'sales' => 'Sales Voucher',
        'purchase' => 'Purchase Voucher',
        'sales_return' => 'Sales Return (Credit Note)',
        'purchase_return' => 'Purchase Return (Debit Note)',
        'opening_balance' => 'Opening Balance Voucher',
        'stock_adjustment' => 'Stock Adjustment Voucher',
        'payroll' => 'Payroll Voucher',
    ];
    $typeLabelsBn = [
        'receipt' => 'রিসিপ্ট ভাউচার',
        'payment' => 'পেমেন্ট ভাউচার',
        'journal' => 'জার্নাল ভাউচার',
        'contra' => 'কন্ট্রা ভাউচার',
        'sales' => 'বিক্রয় ভাউচার',
        'purchase' => 'ক্রয় ভাউচার',
        'sales_return' => 'বিক্রয় ফেরত (ক্রেডিট নোট)',
        'purchase_return' => 'ক্রয় ফেরত (ডেবিট নোট)',
        'opening_balance' => 'প্রারম্ভিক স্থিতি ভাউচার',
        'stock_adjustment' => 'স্টক সমন্বয় ভাউচার',
        'payroll' => 'বেতন ভাউচার',
    ];
    $title = $isBn ? ($typeLabelsBn[$voucher->type] ?? 'ভাউচার') : ($typeLabelsEn[$voucher->type] ?? 'Voucher');
@endphp
<!DOCTYPE html>
<html lang="{{ $isBn ? 'bn' : 'en' }}">
<head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <title>{{ $voucher->number ?: 'Draft #'.$voucher->id }} — {{ $title }}</title>
    <link rel="preconnect" href="https://fonts.googleapis.com">
    <link href="https://fonts.googleapis.com/css2?family=Lato:wght@400;700&family=Noto+Sans+Bengali:wght@400;600;700&family=Raleway:wght@600;700&display=swap" rel="stylesheet">
    <style>
        * { box-sizing: border-box; }
        body {
            margin: 0;
            padding: 24px;
            background: #EAECE9;
            color: #222222;
            font-family: {{ $isBn ? "'Noto Sans Bengali', 'Lato', sans-serif" : "'Lato', 'Noto Sans Bengali', sans-serif" }};
            font-size: 13px;
            line-height: 1.5;
        }
        .sheet {
            max-width: 820px;
            margin: 0 auto;
            background: #FFFFFF;
            border: 1px solid #CCCCCC;
            border-radius: 2px;
            padding: 28px 32px;
        }
        .toolbar {
            max-width: 820px;
            margin: 0 auto 12px;
            display: flex;
            justify-content: space-between;
            align-items: center;
            gap: 8px;
        }
        .btn {
            display: inline-block;
            padding: 6px 14px;
            font-size: 12.5px;
            font-weight: 700;
            border-radius: 2px;
            text-decoration: none;
            cursor: pointer;
            border: 1px solid #0E5F3F;
            background: #0E5F3F;
            color: #FFFFFF;
        }
        .btn-outline {
            background: #FFFFFF;
            color: #222222;
            border-color: #CCCCCC;
        }
        .header {
            display: flex;
            justify-content: space-between;
            align-items: flex-start;
            border-bottom: 2px solid #0E5F3F;
            padding-bottom: 14px;
            margin-bottom: 16px;
        }
        .brand h1 {
            margin: 0;
            font-family: 'Raleway', 'Noto Sans Bengali', sans-serif;
            font-size: 20px;
            color: #0E5F3F;
        }
        .brand p { margin: 2px 0 0; color: #555555; font-size: 12px; }
        .doc-title { text-align: right; }
        .doc-title h2 {
            margin: 0;
            font-size: 17px;
            color: #222222;
        }
        .badge {
            display: inline-block;
            margin-top: 4px;
            padding: 2px 8px;
            border-radius: 2px;
            font-size: 11px;
            font-weight: 700;
            background: #EAF5F0;
            color: #0E5F3F;
            border: 1px solid #0E5F3F;
        }
        .meta {
            display: grid;
            grid-template-columns: repeat(2, 1fr);
            gap: 8px 24px;
            margin-bottom: 16px;
            padding: 10px 12px;
            background: #F5F7F4;
            border: 1px solid #D5DBD3;
        }
        .meta-row { display: flex; justify-content: space-between; gap: 8px; }
        .meta-label { color: #555555; font-weight: 600; }
        .mono { font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace; }
        table {
            width: 100%;
            border-collapse: collapse;
            margin-top: 8px;
        }
        th, td {
            border: 1px solid #D5DBD3;
            padding: 8px 10px;
            text-align: left;
            vertical-align: top;
        }
        th {
            background: #F5F7F4;
            font-weight: 700;
            font-size: 12px;
            color: #222222;
        }
        .right { text-align: right; }
        .total-row td {
            background: #EAF5F0;
            font-weight: 700;
            color: #0E5F3F;
        }
        .narration {
            margin-top: 14px;
            padding: 10px 12px;
            border: 1px solid #D5DBD3;
            background: #FAFAFA;
        }
        .signatures {
            display: grid;
            grid-template-columns: repeat(3, 1fr);
            gap: 24px;
            margin-top: 48px;
            text-align: center;
        }
        .sig-line {
            border-top: 1px solid #666666;
            padding-top: 6px;
            font-size: 12px;
            color: #444444;
        }
        @media print {
            body { background: #FFFFFF; padding: 0; }
            .toolbar { display: none; }
            .sheet { border: none; padding: 0; max-width: none; }
        }
    </style>
</head>
<body>
    <div class="toolbar">
        <div>
            <a href="{{ route('accounting.vouchers.print', ['voucher' => $voucher->id, 'lang' => $isBn ? 'en' : 'bn']) }}" class="btn btn-outline">
                {{ $isBn ? 'Switch to English' : 'বাংলায় দেখুন' }}
            </a>
        </div>
        <button type="button" onclick="window.print()" class="btn">
            {{ $isBn ? 'প্রিন্ট / PDF সংরক্ষণ' : 'Print / Save PDF' }}
        </button>
    </div>

    <div class="sheet">
        <div class="header">
            <div class="brand">
                <h1>{{ $tenant?->name ?? 'PharmaCore Pharmacy' }}</h1>
                <p>{{ $voucher->branch?->name ?? '' }} {{ $voucher->branch?->address ? '· '.$voucher->branch->address : '' }}</p>
                @if($voucher->branch?->phone)
                    <p>{{ $isBn ? 'ফোন:' : 'Phone:' }} {{ $voucher->branch->phone }}</p>
                @endif
            </div>
            <div class="doc-title">
                <h2>{{ $title }}</h2>
                <span class="badge">{{ ucfirst(str_replace('_', ' ', $voucher->status)) }}</span>
            </div>
        </div>

        <div class="meta">
            <div class="meta-row">
                <span class="meta-label">{{ $isBn ? 'ভাউচার নম্বর:' : 'Voucher Number:' }}</span>
                <span class="mono" style="font-weight:700;">{{ $voucher->number ?: 'Draft #'.$voucher->id }}</span>
            </div>
            <div class="meta-row">
                <span class="meta-label">{{ $isBn ? 'তারিখ:' : 'Date:' }}</span>
                <span class="mono">{{ $voucher->date->format('d M Y') }}</span>
            </div>
            <div class="meta-row">
                <span class="meta-label">{{ $isBn ? 'শাখা:' : 'Branch:' }}</span>
                <span>{{ $voucher->branch?->name ?? '—' }}</span>
            </div>
            <div class="meta-row">
                <span class="meta-label">{{ $isBn ? 'উৎস:' : 'Source:' }}</span>
                <span>{{ ucfirst(str_replace('_', ' ', $voucher->source_module ?: 'manual')) }}</span>
            </div>
        </div>

        <table>
            <thead>
                <tr>
                    <th style="width:90px;">{{ $isBn ? 'কোড' : 'Code' }}</th>
                    <th>{{ $isBn ? 'হিসাবের নাম ও বিবরণ' : 'Account & Description' }}</th>
                    <th style="width:140px;" class="right">{{ $isBn ? 'ডেবিট (৳)' : 'Debit (BDT)' }}</th>
                    <th style="width:140px;" class="right">{{ $isBn ? 'ক্রেডিট (৳)' : 'Credit (BDT)' }}</th>
                </tr>
            </thead>
            <tbody>
                @foreach($voucher->lines as $line)
                    <tr>
                        <td class="mono">{{ $line->account?->code }}</td>
                        <td>
                            <div style="font-weight:700;">
                                {{ $isBn ? ($line->account?->name_bn ?: $line->account?->name_en) : $line->account?->name_en }}
                            </div>
                            @if($line->party)
                                <div style="font-size:11.5px;color:#555555;">
                                    {{ $isBn ? 'পার্টি:' : 'Party:' }} {{ $line->party->name }}
                                </div>
                            @endif
                            @if($line->narration)
                                <div style="font-size:11.5px;color:#666666;">{{ $line->narration }}</div>
                            @endif
                        </td>
                        <td class="right mono">{{ $line->debit_paisa > 0 ? MoneyPaisa::formatBdt((int) $line->debit_paisa) : '—' }}</td>
                        <td class="right mono">{{ $line->credit_paisa > 0 ? MoneyPaisa::formatBdt((int) $line->credit_paisa) : '—' }}</td>
                    </tr>
                @endforeach
                <tr class="total-row">
                    <td colspan="2" class="right">{{ $isBn ? 'সর্বমোট' : 'Total' }}</td>
                    <td class="right mono">{{ MoneyPaisa::formatBdt((int) $voucher->total_debit_paisa) }}</td>
                    <td class="right mono">{{ MoneyPaisa::formatBdt((int) $voucher->total_credit_paisa) }}</td>
                </tr>
            </tbody>
        </table>

        @if($voucher->narration)
            <div class="narration">
                <strong>{{ $isBn ? 'বিবরণ (Narration):' : 'Narration:' }}</strong>
                <span>{{ $voucher->narration }}</span>
            </div>
        @endif

        <div class="signatures">
            <div>
                <div style="min-height:22px;font-weight:600;">{{ $voucher->creator?->name ?? 'System' }}</div>
                <div class="sig-line">{{ $isBn ? 'প্রস্তুতকারী' : 'Prepared By' }}</div>
            </div>
            <div>
                <div style="min-height:22px;font-weight:600;">{{ $voucher->approver?->name ?? ($voucher->poster?->name ?? '') }}</div>
                <div class="sig-line">{{ $isBn ? 'অনুমোদনকারী' : 'Approved By' }}</div>
            </div>
            <div>
                <div style="min-height:22px;"></div>
                <div class="sig-line">{{ $isBn ? 'গ্রহণকারী / স্বাক্ষর' : 'Received By' }}</div>
            </div>
        </div>
    </div>
</body>
</html>

