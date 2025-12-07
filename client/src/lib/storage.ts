import { getStorage, ref, uploadBytes, getDownloadURL, deleteObject } from 'firebase/storage';
import app from './firebase';

const storage = getStorage(app);

/**
 * Upload a file to Firebase Storage
 * @param file - The file to upload
 * @param path - The storage path (e.g., 'orgs/orgId/logo.png')
 * @returns The download URL of the uploaded file
 */
export async function uploadFile(file: File, path: string): Promise<string> {
    const storageRef = ref(storage, path);
    await uploadBytes(storageRef, file);
    const downloadURL = await getDownloadURL(storageRef);
    return downloadURL;
}

/**
 * Delete a file from Firebase Storage
 * @param path - The storage path of the file to delete
 */
export async function deleteFile(path: string): Promise<void> {
    const storageRef = ref(storage, path);
    await deleteObject(storageRef);
}

/**
 * Upload an organization logo
 * @param orgId - The organization ID
 * @param file - The logo file
 * @returns The download URL of the uploaded logo
 */
export async function uploadOrgLogo(orgId: string, file: File): Promise<string> {
    const fileExtension = file.name.split('.').pop();
    const path = `orgs/${orgId}/logo.${fileExtension}`;
    return uploadFile(file, path);
}

/**
 * Delete an organization logo
 * @param logoUrl - The download URL of the logo to delete
 */
export async function deleteOrgLogo(logoUrl: string): Promise<void> {
    // Extract the path from the download URL
    const pathMatch = logoUrl.match(/\/o\/(.+?)\?/);
    if (pathMatch) {
        const path = decodeURIComponent(pathMatch[1]);
        await deleteFile(path);
    }
}
