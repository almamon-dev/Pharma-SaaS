<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <title>404 - Page Not Found | <?php echo e(config('app.name', 'PharmaCore SaaS')); ?></title>
    <link rel="preconnect" href="https://fonts.googleapis.com">
    <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
    <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&display=swap" rel="stylesheet">
    <script src="https://cdn.tailwindcss.com"></script>
    <style>
        body { font-family: 'Inter', sans-serif; }
    </style>
</head>
<body class="bg-[#f8fafc] text-[#202223] min-h-screen flex items-center justify-center p-4">
    <div class="max-w-md w-full text-center bg-white rounded-lg border border-slate-200 shadow-sm p-8">
        <div class="w-16 h-16 mx-auto mb-4 rounded-full bg-orange-50 text-[#FF4A1F] flex items-center justify-center font-bold text-2xl">
            404
        </div>
        <h1 class="text-xl font-bold text-slate-900 mb-2">Page or Order Not Found</h1>
        <p class="text-sm text-slate-500 mb-6 leading-relaxed">
            The requested page or record could not be found. It may have been moved, reassigned, or already processed.
        </p>
        <div class="flex items-center justify-center gap-3">
            <button onclick="window.history.back()" class="px-4 py-2 text-xs font-semibold rounded-[4px] border border-slate-200 text-slate-700 hover:bg-slate-50 transition-colors">
                Go Back
            </button>
            <a href="/cashier/dashboard" class="px-4 py-2 text-xs font-semibold rounded-[4px] bg-[#FF4A1F] text-white hover:bg-[#e03d15] transition-colors shadow-sm">
                Cashier Dashboard
            </a>
        </div>
    </div>
</body>
</html>
<?php /**PATH /app/resources/views/errors/404.blade.php ENDPATH**/ ?>