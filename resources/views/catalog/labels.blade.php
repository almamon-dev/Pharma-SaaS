<!DOCTYPE html>
<html lang="bn">
<head>
    <meta charset="UTF-8">
    <title>Barcode Labels</title>
    <link rel="preconnect" href="https://fonts.googleapis.com">
    <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
    <link href="https://fonts.googleapis.com/css2?family=Hind+Siliguri:wght@500;600;700&family=Libre+Barcode+128&display=swap" rel="stylesheet">
    <style>
        @page {
            margin: 0;
            size: {{ $cfg['width_mm'] }}mm {{ $cfg['height_mm'] }}mm;
        }
        * {
            box-sizing: border-box;
            margin: 0;
            padding: 0;
        }
        body {
            font-family: 'Hind Siliguri', -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
            background: #f4f4f4;
            color: #111;
            -webkit-print-color-adjust: exact;
        }
        .container {
            display: flex;
            flex-wrap: wrap;
            padding: 5mm;
            gap: 2mm;
            justify-content: flex-start;
        }
        .label {
            width: {{ $cfg['width_mm'] }}mm;
            height: {{ $cfg['height_mm'] }}mm;
            background: #fff;
            padding: 2mm 3mm;
            border: 1px dashed #ccc;
            display: flex;
            flex-direction: column;
            justify-content: space-between;
            overflow: hidden;
            page-break-inside: avoid;
        }
        .prod-title {
            font-size: 11px;
            font-weight: 700;
            line-height: 1.2;
            white-space: nowrap;
            overflow: hidden;
            text-overflow: ellipsis;
        }
        .prod-sub {
            font-size: 9px;
            color: #444;
            display: flex;
            justify-content: space-between;
        }
        .barcode-wrap {
            text-align: center;
            margin-top: 1mm;
        }
        .barcode-font {
            font-family: 'Libre Barcode 128', monospace;
            font-size: 32px;
            line-height: 0.9;
            letter-spacing: 0;
            display: block;
        }
        .barcode-text {
            font-family: monospace;
            font-size: 9px;
            font-weight: 600;
            letter-spacing: 1px;
        }

        @media print {
            body { background: transparent; }
            .container { padding: 0; gap: 0; }
            .label { border: none; }
            .no-print { display: none; }
        }
    </style>
</head>
<body>
    <div class="no-print" style="padding: 12px; background: #1e293b; color: #fff; display: flex; justify-content: space-between; align-items: center;">
        <div><strong>Print Preview:</strong> {{ count($labels) }} labels (Preset: {{ $cfg['name'] }})</div>
        <button onclick="window.print()" style="padding: 6px 16px; background: #0284c7; color: #fff; border: none; border-radius: 4px; cursor: pointer; font-weight: 600;">Print Now</button>
    </div>

    <div class="container">
        @foreach($labels as $lbl)
            <div class="label">
                <div class="prod-title">{{ $lbl['name_bn'] ?: $lbl['name'] }}</div>
                <div class="prod-sub">
                    <span>{{ $lbl['strength'] }}</span>
                    <span>{{ $lbl['company'] }}</span>
                </div>
                <div class="barcode-wrap">
                    <span class="barcode-font">{{ $lbl['barcode'] }}</span>
                    <span class="barcode-text">{{ $lbl['barcode'] }}</span>
                </div>
            </div>
        @endforeach
    </div>
</body>
</html>

