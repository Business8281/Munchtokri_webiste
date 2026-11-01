import { NextResponse } from 'next/server';

export async function POST(req: Request) {
    try {
        const body = await req.json();

        // Forward to the secure Cloud Function backend (no backend secrets in frontend)
        const backendUrl = process.env.FIREBASE_FUNCTIONS_URL || 'https://munch-tokri.web.app/api/create-subscription';
        const response = await fetch(backendUrl, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(body),
        });

        const data = await response.json();
        return NextResponse.json(data, { status: response.status });
    } catch (error: any) {
        console.error("Subscription proxy error:", error);
        return NextResponse.json({ 
            error: error.message || "Failed to create subscription" 
        }, { status: 500 });
    }
}
