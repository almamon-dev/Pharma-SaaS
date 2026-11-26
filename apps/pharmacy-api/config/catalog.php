<?php

return [
    /*
    |--------------------------------------------------------------------------
    | Catalog Dosage Forms
    |--------------------------------------------------------------------------
    | Suggested and standard dosage forms for medicine products.
    */
    'dosage_forms' => [
        'tablet',
        'capsule',
        'syrup',
        'suspension',
        'injection',
        'cream',
        'ointment',
        'gel',
        'drop',
        'inhaler',
        'spray',
        'suppository',
        'lotion',
        'powder',
        'patch',
        'solution',
        'sachet',
        'ampoule',
        'vial',
        'cartridge',
    ],

    /*
    |--------------------------------------------------------------------------
    | Unit Name Suggestions
    |--------------------------------------------------------------------------
    | Standard suggested unit names across Bangladesh pharmacy workflows.
    */
    'unit_suggestions' => [
        'pcs',
        'strip',
        'box',
        'bottle',
        'vial',
        'tube',
        'sachet',
        'ampoule',
        'pack',
        'carton',
        'blister',
        'can',
    ],

    /*
    |--------------------------------------------------------------------------
    | Barcode Label Presets
    |--------------------------------------------------------------------------
    */
    'label_presets' => [
        '38x25' => [
            'name' => '38mm x 25mm (Standard Sticker)',
            'width_mm' => 38,
            'height_mm' => 25,
            'type' => 'roll',
            'cols' => 1,
            'rows' => 1,
        ],
        '50x30' => [
            'name' => '50mm x 30mm (Large Label)',
            'width_mm' => 50,
            'height_mm' => 30,
            'type' => 'roll',
            'cols' => 1,
            'rows' => 1,
        ],
        'a4_3x8' => [
            'name' => 'A4 Sheet (3x8 = 24 Labels)',
            'width_mm' => 70,
            'height_mm' => 37,
            'type' => 'sheet',
            'cols' => 3,
            'rows' => 8,
        ],
    ],
];

