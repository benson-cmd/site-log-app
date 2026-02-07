/**
 * Cloudinary Upload Utility
 * 
 * Configuration:
 * - Cloud Name: df8uaeazt
 * - Upload Preset: ml_default (Unsigned)
 */

export const uploadToCloudinary = async (uri: string, fileName: string): Promise<string> => {
    // 1. Validation: If already a remote URL or not a local blob/file, return immediately
    if (!uri || uri.startsWith('http')) {
        return uri;
    }

    try {
        console.log(`[Cloudinary] Preparing to upload: ${fileName} (${uri.substring(0, 30)}...)`);

        // 2. Fetch Handling with explicit error checks
        let response;
        try {
            response = await fetch(uri);
        } catch (fetchError: any) {
            console.error('[Cloudinary] Fetch local blob failed:', fetchError);
            if (fetchError.message?.includes('fetch') || fetchError.name === 'TypeError') {
                throw new Error('檔案存取失效（可能因為預覽太久），請重新選擇檔案後再儲存。');
            }
            throw fetchError;
        }

        if (!response.ok) {
            throw new Error(`無法讀取本地檔案 (Status: ${response.status})`);
        }

        const blob = await response.blob();
        const formData = new FormData();
        formData.append('file', blob);
        formData.append('upload_preset', 'ml_default');
        formData.append('cloud_name', 'df8uaeazt');

        // Add timestamp to avoid filename conflicts
        const cleanName = fileName ? fileName.split('.')[0].replace(/[^a-zA-Z0-9]/g, '_') : 'file';
        formData.append('public_id', `${cleanName}_${Date.now()}`);

        // 3. Cloudinary API Call
        const res = await fetch(`https://api.cloudinary.com/v1_1/df8uaeazt/auto/upload`, {
            method: 'POST',
            body: formData,
        });

        const data = await res.json();
        if (data.error) {
            console.error('[Cloudinary] API Error:', data.error);
            throw new Error(data.error.message);
        }

        console.log(`[Cloudinary] Upload success: ${data.secure_url}`);
        return data.secure_url;
    } catch (error: any) {
        console.error('[Cloudinary] Upload process error:', error);
        throw error;
    }
};

/**
 * Upload multiple files to Cloudinary
 * @param files Array of file objects with uri and name properties
 * @returns Array of uploaded file objects with updated URLs
 */
export const uploadMultipleToCloudinary = async (
    files: Array<{ uri: string; name: string;[key: string]: any }>
): Promise<Array<{ url: string;[key: string]: any }>> => {
    const uploadPromises = files.map(async (file) => {
        const uploadedUrl = await uploadToCloudinary(file.uri, file.name);
        return {
            ...file,
            url: uploadedUrl,
            uri: uploadedUrl
        };
    });

    return Promise.all(uploadPromises);
};
