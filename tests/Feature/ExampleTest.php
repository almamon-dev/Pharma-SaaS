<?php

namespace Tests\Feature;

use Database\Seeders\PlanSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Inertia\Testing\AssertableInertia as Assert;
use Tests\TestCase;

class ExampleTest extends TestCase
{
    use RefreshDatabase;

    public function test_the_application_returns_a_successful_response(): void
    {
        $this->seed(PlanSeeder::class);

        $response = $this->get('/');

        $response->assertStatus(200)
            ->assertInertia(fn (Assert $page) => $page
                ->component('Welcome')
                ->has('plans', 3)
            );
    }
}
