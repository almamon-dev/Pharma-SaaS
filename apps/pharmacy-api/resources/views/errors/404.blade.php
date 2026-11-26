<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <title>404 - Page Not Found | {{ config('app.name', 'PharmaCore SaaS') }}</title>
    <link rel="preconnect" href="https://fonts.googleapis.com">
    <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
    <link href="https://fonts.googleapis.com/css2?family=Lato:ital,wght@0,300;0,400;0,700;1,400&family=Raleway:wght@300;400;500;600;700&family=Noto+Sans+Bengali:wght@400;500;600;700&display=swap" rel="stylesheet">
    <script src="https://cdn.tailwindcss.com"></script>
    <style>
        body { font-family: 'Lato', 'Helvetica Neue', Helvetica, Arial, 'SolaimanLipi', 'Noto Sans Bengali', sans-serif; }
        h1, h2, h3, h4, h5, h6 { font-family: 'Raleway', 'Lato', 'Helvetica Neue', Helvetica, Arial, 'SolaimanLipi', 'Noto Sans Bengali', sans-serif; }
    </style>
</head>
<body class="bg-[#EAECE9] text-[#333333] min-h-screen flex items-center justify-center p-4">
    <div class="max-w-md w-full text-center bg-white rounded-[2px] border border-[#D5DBD3] shadow-sm p-8">
        <div class="w-16 h-16 mx-auto mb-4 rounded-full bg-[#EAF5F0] text-[#0E5F3F] flex items-center justify-center font-bold text-2xl">
            404
        </div>
        <h1 class="text-xl font-bold text-slate-900 mb-2">Page or Order Not Found</h1>
        <p class="text-sm text-slate-500 mb-6 leading-relaxed">
            The requested page or record could not be found. It may have been moved, reassigned, or already processed.
        </p>
        <div class="flex items-center justify-center gap-3">
            <button onclick="window.history.back()" class="px-4 py-2 text-xs font-semibold rounded-[2px] border border-[#2E6DA4] bg-[#337AB7] text-white hover:bg-[#286090] transition-colors">
                Go Back
            </button>
            <a href="/cashier/dashboard" class="px-4 py-2 text-xs font-semibold rounded-[2px] border border-[#4CAE4C] bg-[#5CB85C] text-white hover:bg-[#449D44] transition-colors shadow-sm">
                Cashier Dashboard
            </a>
        </div>
    </div>
</body>
</html>

