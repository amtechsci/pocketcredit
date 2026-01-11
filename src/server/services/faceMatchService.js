const axios = require('axios');
const FormData = require('form-data');

// Digitap Face Match API URLs (Based on official documentation)
// UAT/DEMO: https://apidemo.digitap.work
// Production: https://api.digitap.ai
const DIGITAP_BASE_URL = process.env.DIGITAP_BASE_URL || 'https://apidemo.digitap.work';
const FACE_MATCH_ENDPOINT = '/fmfl/v2/face-match';
const DIGITAP_CLIENT_ID = process.env.DIGITAP_CLIENT_ID;
const DIGITAP_CLIENT_SECRET = process.env.DIGITAP_CLIENT_SECRET;

/**
 * Get authorization header for Digitap API
 * Format: Basic Base64(client_id:client_secret)
 */
function getAuthHeader() {
    const credentials = `${DIGITAP_CLIENT_ID}:${DIGITAP_CLIENT_SECRET}`;
    const base64Credentials = Buffer.from(credentials).toString('base64');
    return `Basic ${base64Credentials}`;
}

/**
 * Generate client reference ID (max 45 chars as per API spec)
 */
function generateClientRefId() {
    const timestamp = Date.now();
    const random = Math.random().toString(36).substring(2, 6);
    return `fm-${timestamp}-${random}`; // Keeping it under 45 chars
}

/**
 * Compare two face images using Digitap Face Match API
 * 
 * API Documentation: Digitap Face Match v2
 * 
 * @param {Buffer|string} selfieImage - Selfie image (person) - Buffer or base64 string
 * @param {Buffer|string} cardImage - Digilocker/ID photo (card) - Buffer or base64 string
 * @param {string} applicationId - Application ID for tracking
 * @returns {Promise<{success: boolean, match: boolean, confidence?: number, error?: string}>}
 */
async function compareFaces(selfieImage, cardImage, applicationId) {
    try {

        // Convert images to base64 if they're buffers
        const personBase64 = Buffer.isBuffer(selfieImage)
            ? selfieImage.toString('base64')
            : selfieImage;

        const cardBase64 = Buffer.isBuffer(cardImage)
            ? cardImage.toString('base64')
            : cardImage;

        const clientRefId = generateClientRefId();

        // Prepare request payload according to Digitap API spec
        // Using JSON format (API supports both multipart/form-data and JSON)
        const payload = {
            person: personBase64,      // Selfie image
            card: cardBase64,          // Digilocker/ID photo
            clientRefId: clientRefId   // Unique reference ID
        };

        const apiUrl = `${DIGITAP_BASE_URL}${FACE_MATCH_ENDPOINT}`;
        console.log(`📤 Calling Digitap Face Match API: ${apiUrl}`);
        console.log(`📋 Client Ref ID: ${clientRefId}`);

        // Call Digitap Face Match API
        const response = await axios.post(
            apiUrl,
            payload,
            {
                headers: {
                    'authorization': getAuthHeader(),  // Basic auth with base64 encoded credentials
                    'content-type': 'application/json'
                },
                timeout: 30000 // 30 seconds
            }
        );

        console.log('📥 Digitap Face Match API Response:', {
            status: response.data?.status,
            statusCode: response.data?.statusCode
        });

        // Check if response is successful (statusCode 200 or status "success")
        if (response.data &&
            (response.data.statusCode === 200 || response.data.statusCode === "200") &&
            response.data.status === "success") {

            const result = response.data.result || {};

            // Parse Digitap response fields
            const isSameFace = result.is_same_face === true || result.is_same_face === "true";
            const confidence = result.same_face_confidence
                ? (parseFloat(result.same_face_confidence) * 100) // Convert 0-1 to 0-100
                : 0;

            const personImageBlurry = result.is_person_image_blurry === true || result.is_person_image_blurry === "true";
            const cardImageBlurry = result.is_card_image_blurry === true || result.is_card_image_blurry === "true";
            const personIdentified = result.person_image_correctly_identified === true || result.person_image_correctly_identified === "true";
            const cardIdentified = result.card_image_correctly_identified === true || result.card_image_correctly_identified === "true";

            console.log(`✅ Face Match Result: ${isSameFace ? 'MATCH ✓' : 'NO MATCH ✗'} (Confidence: ${confidence.toFixed(2)}%)`);
            console.log(`   - Person image blurry: ${personImageBlurry}, Card image blurry: ${cardImageBlurry}`);
            console.log(`   - Person identified: ${personIdentified}, Card identified: ${cardIdentified}`);

            return {
                success: true,
                match: isSameFace,
                confidence: confidence,
                details: {
                    client_ref_id: clientRefId,
                    req_id: response.data.reqId,
                    timestamp: new Date().toISOString(),
                    is_person_image_blurry: personImageBlurry,
                    is_card_image_blurry: cardImageBlurry,
                    person_image_correctly_identified: personIdentified,
                    card_image_correctly_identified: cardIdentified,
                    raw_response: result
                }
            };
        } else {
            // Handle error response
            const statusCode = response.data?.statusCode;
            const errorMessage = response.data?.error || 'Face match API returned unsuccessful response';

            console.warn(`⚠️ Digitap Face Match API error - Status Code: ${statusCode}`);
            console.warn(`   Error: ${errorMessage}`);

            return {
                success: false,
                match: false,
                error: `${errorMessage} (Status: ${statusCode})`,
                status_code: statusCode
            };
        }

    } catch (error) {
        console.error('❌ Digitap Face Match API error:', error.message);

        // Handle specific error types
        if (error.code === 'ECONNABORTED') {
            return {
                success: false,
                match: false,
                error: 'Face match request timeout'
            };
        }

        if (error.response) {
            const errorData = error.response.data;
            console.error('Face Match API error response:', error.response.status, errorData);

            return {
                success: false,
                match: false,
                error: errorData?.error || `API error: ${error.response.status}`,
                status_code: errorData?.statusCode,
                details: errorData
            };
        }

        if (error.request) {
            return {
                success: false,
                match: false,
                error: 'No response from Face Match API'
            };
        }

        return {
            success: false,
            match: false,
            error: error.message
        };
    }
}

/**
 * Download image from URL
 * @param {string} url - Image URL
 * @returns {Promise<Buffer>}
 */
async function downloadImage(url) {
    try {
        console.log(`📥 Downloading image from: ${url.substring(0, 50)}...`);

        const response = await axios.get(url, {
            responseType: 'arraybuffer',
            timeout: 15000
        });

        return Buffer.from(response.data);
    } catch (error) {
        console.error('Error downloading image:', error.message);
        throw new Error(`Failed to download image: ${error.message}`);
    }
}

module.exports = {
    compareFaces,
    downloadImage
};
