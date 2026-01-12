const supabase = require('../config/supabase');

/**
 * Upload base64 image to Supabase Storage
 * 
 * @param {string} base64Data - Base64 data URL (e.g., "data:image/png;base64,...")
 * @param {string} bucket - Supabase storage bucket name
 * @param {string} filename - Filename for the uploaded file
 * @returns {Promise<string>} Public URL of uploaded image
 */
async function uploadBase64Image(base64Data, bucket, filename) {
    try {
        // Extract base64 string from data URL
        const base64String = base64Data.split(';base64,').pop();

        if (!base64String) {
            throw new Error('Invalid base64 data');
        }

        // Convert base64 to buffer
        const imageBuffer = Buffer.from(base64String, 'base64');

        // Upload to Supabase Storage
        const { data, error } = await supabase.storage
            .from(bucket)
            .upload(filename, imageBuffer, {
                contentType: 'image/png',
                upsert: true,
                cacheControl: '3600'
            });

        if (error) {
            console.error('[Upload Helper] Supabase upload error:', error);
            throw error;
        }

        // Get public URL
        const { data: { publicUrl } } = supabase.storage
            .from(bucket)
            .getPublicUrl(filename);

        console.log(`[Upload Helper] Successfully uploaded: ${filename} to ${bucket}`);
        return publicUrl;
    } catch (error) {
        console.error('[Upload Helper] Error uploading base64 image:', error);
        throw new Error('Failed to upload image to storage');
    }
}

/**
 * Upload file from multer to Supabase Storage
 * 
 * @param {Object} file - Multer file object
 * @param {string} bucket - Supabase storage bucket name
 * @param {string} filename - Optional custom filename
 * @returns {Promise<string>} Public URL of uploaded file
 */
async function uploadFileToSupabase(file, bucket, filename = null) {
    try {
        const uploadFilename = filename || `${Date.now()}_${file.originalname}`;

        const { data, error } = await supabase.storage
            .from(bucket)
            .upload(uploadFilename, file.buffer, {
                contentType: file.mimetype,
                upsert: true,
                cacheControl: '3600'
            });

        if (error) {
            console.error('[Upload Helper] Supabase file upload error:', error);
            throw error;
        }

        // Get public URL
        const { data: { publicUrl } } = supabase.storage
            .from(bucket)
            .getPublicUrl(uploadFilename);

        console.log(`[Upload Helper] Successfully uploaded file: ${uploadFilename}`);
        return publicUrl;
    } catch (error) {
        console.error('[Upload Helper] Error uploading file:', error);
        throw new Error('Failed to upload file to storage');
    }
}

/**
 * Delete file from Supabase Storage
 * 
 * @param {string} fileUrl - Full URL of the file to delete
 * @param {string} bucket - Supabase storage bucket name
 * @returns {Promise<boolean>} True if deleted successfully
 */
async function deleteFileFromSupabase(fileUrl, bucket) {
    try {
        // Extract filename from URL
        const urlParts = fileUrl.split('/');
        const filename = urlParts[urlParts.length - 1];

        const { error } = await supabase.storage
            .from(bucket)
            .remove([filename]);

        if (error) {
            console.error('[Upload Helper] Error deleting file:', error);
            return false;
        }

        console.log(`[Upload Helper] Successfully deleted: ${filename}`);
        return true;
    } catch (error) {
        console.error('[Upload Helper] Error in deleteFileFromSupabase:', error);
        return false;
    }
}

module.exports = {
    uploadBase64Image,
    uploadFileToSupabase,
    deleteFileFromSupabase
};
