<?php

namespace App\Http\Controllers;

use App\Services\EnergieService;
use Illuminate\Http\Request;

class EnergieController extends Controller
{
    // Bilan et surplus sur les N derniers jours (défaut 30)
    public function bilan(Request $request, EnergieService $energie)
    {
        $jours = min(max((int) $request->query('jours', 30), 1), 90);

        return $energie->bilan($request->user(), $jours);
    }
}