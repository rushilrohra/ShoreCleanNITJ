const cloudinary = require('cloudinary').v2;

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

/**
 * Uploads a buffer to Cloudinary.
 * @param {Buffer} buffer - The file buffer.
 * @param {string} folder - Destination folder in Cloudinary.
 * @param {string} publicId - Optional public ID for the file.
 * @param {string} resourceType - 'image', 'video', or 'raw' (for PDFs).
 * @returns {Promise<string>} - The secure URL of the uploaded file.
 */
const uploadBuffer = (buffer, folder, publicId = null, resourceType = 'image') => {
  return new Promise((resolve, reject) => {
    const uploadStream = cloudinary.uploader.upload_stream(
      {
        folder,
        public_id: publicId,
        resource_type: resourceType,
        overwrite: true,
      },
      (error, result) => {
        if (error) {
          console.error('Cloudinary Upload Error:', error);
          return reject(error);
        }
        resolve(result.secure_url);
      }
    );
    uploadStream.end(buffer);
  });
};

module.exports = {
  cloudinary,
  uploadBuffer,
};
