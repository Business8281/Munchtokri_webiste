import { NextRequest, NextResponse } from 'next/server';
import admin, { adminDb } from '@/lib/firebase-admin';

// Helper to verify admin token
async function verifyAdmin(request: NextRequest) {
    const authHeader = request.headers.get('Authorization');
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
        return { error: 'Unauthorized', status: 401 };
    }

    const token = authHeader.split('Bearer ')[1];
    try {
        const decodedToken = await admin.auth().verifyIdToken(token);
        const email = decodedToken.email;
        if (!email) {
            return { error: 'Invalid token email', status: 401 };
        }

        // Check if the user is an admin in Firestore
        const adminDoc = await adminDb.collection('admins').doc(email).get();
        let isAuthorized = adminDoc.exists && adminDoc.data()?.role === 'admin';

        if (!isAuthorized) {
            // Fallback: query by email field
            const adminsQuery = await adminDb.collection('admins').where('email', '==', email).get();
            if (!adminsQuery.empty) {
                const data = adminsQuery.docs[0].data();
                if (data.role === 'admin') {
                    isAuthorized = true;
                }
            }
        }

        if (!isAuthorized) {
            return { error: 'Forbidden: Admin access required', status: 403 };
        }

        return { user: decodedToken };
    } catch (error) {
        console.error("Token verification error:", error);
        return { error: 'Unauthorized', status: 401 };
    }
}

export async function POST(request: NextRequest) {
    const verification = await verifyAdmin(request);
    if (verification.error) {
        return NextResponse.json({ error: verification.error }, { status: verification.status });
    }

    try {
        const body = await request.json();
        const { email, password, name, role } = body;

        if (!email || !password || !name || !role) {
            return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
        }

        // Create user in Firebase Auth
        const userRecord = await admin.auth().createUser({
            email,
            password,
            displayName: name,
        });

        // Add user to Firestore `admins` collection
        const normalizedEmail = email.toLowerCase().trim();
        await adminDb.collection('admins').doc(normalizedEmail).set({
            email: normalizedEmail,
            name,
            role,
            createdAt: new Date().toISOString()
        });

        return NextResponse.json({ success: true, uid: userRecord.uid });
    } catch (error: any) {
        console.error("Error creating staff:", error);
        return NextResponse.json({ error: error.message || 'Internal Server Error' }, { status: 500 });
    }
}

export async function DELETE(request: NextRequest) {
    const verification = await verifyAdmin(request);
    if (verification.error) {
        return NextResponse.json({ error: verification.error }, { status: verification.status });
    }

    try {
        const { searchParams } = new URL(request.url);
        const email = searchParams.get('email');

        if (!email) {
            return NextResponse.json({ error: 'Email parameter required' }, { status: 400 });
        }

        const normalizedEmail = email.toLowerCase().trim();

        // 1. Delete from Firebase Auth
        try {
            const userRecord = await admin.auth().getUserByEmail(normalizedEmail);
            await admin.auth().deleteUser(userRecord.uid);
        } catch (authError: any) {
            if (authError.code !== 'auth/user-not-found') {
                throw authError; // Ignore if user doesn't exist in Auth, but throw other errors
            }
        }

        // 2. Delete from Firestore
        await adminDb.collection('admins').doc(normalizedEmail).delete();
        
        // Also check if there's any document with the email field and delete it to be thorough
        const snapshot = await adminDb.collection('admins').where('email', '==', normalizedEmail).get();
        if (!snapshot.empty) {
            const batch = adminDb.batch();
            snapshot.docs.forEach((doc) => {
                batch.delete(doc.ref);
            });
            await batch.commit();
        }

        return NextResponse.json({ success: true });
    } catch (error: any) {
        console.error("Error deleting staff:", error);
        return NextResponse.json({ error: error.message || 'Internal Server Error' }, { status: 500 });
    }
}
