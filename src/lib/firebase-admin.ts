import admin from 'firebase-admin';

const initFirebase = () => {
    if (admin.apps.length) return admin;

    const projectId = process.env.FIREBASE_PROJECT_ID;
    const clientEmail = process.env.FIREBASE_CLIENT_EMAIL;
    const privateKey = process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n');

    if (!projectId || !clientEmail || !privateKey) {
        // Backend operations are managed in functions/
        return admin;
    }

    try {
        admin.initializeApp({
            credential: admin.credential.cert({
                projectId,
                clientEmail,
                privateKey,
            }),
            databaseURL: `https://${projectId}.firebaseio.com`,
        });
    } catch (error) {
        console.error('Firebase admin initialization error', error);
    }
    return admin;
};

initFirebase();

export const adminDb = admin.apps.length > 0 ? admin.firestore() : {} as FirebaseFirestore.Firestore;
export default admin;
