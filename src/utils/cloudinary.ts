/**
 * Cloudinary Upload Utility
 * 
 * Configuration:
 * - Cloud Name: df8uaeazt
 * - Upload Preset: ml_default (Unsigned)
 */

export const uploadToCloudinary = async (uri: string, fileName: string): Promise<string> => {
    // If already a remote URL, skip upload
    if (!uri || uri.startsWith('http')) {
        return uri;
    }

    try {
        const formData = new FormData();
        const response = await fetch(uri);
        const blob = await response.blob();

        formData.append('file', blob);
        formData.append('upload_preset', 'ml_default');
        formData.append('cloud_name', 'df8uaeazt');

        // Add timestamp to avoid filename conflicts
        const cleanName = fileName.split('.')[0].replace(/[^a-zA-Z0-9]/g, '_');
        formData.append('public_id', `${cleanName}_${Date.now()}`);

        const res = await fetch(`https://api.cloudinary.com/v1_1/df8uaeazt/auto/upload`, {
            method: 'POST',
            body: formData,
        });

        const data = await res.json();
        if (data.error) {
            throw new Error(data.error.message);
        }

        return data.secure_url;
    } catch (error) {
        console.error('Cloudinary upload error:', error);
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
