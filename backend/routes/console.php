<?php

use Illuminate\Support\Facades\Schedule;

Schedule::command('pos:backup-db')->dailyAt('02:00');
