import { v2 as cloudinary } from 'cloudinary';
import { Readable } from 'stream';
import { env } from '../config/env.js';
import { logger } from '../utils/logger.js';
import { CloudinaryUploadResult } from '../types/index.js';

cloudinary.config({
  cloud_name: env.CLOUDINARY_CLOUD_NAME,
  api_key: env.CLOUDINARY_API_KEY,
  api_secret: env.CLOUDINARY_API_SECRET,
});

export class CloudinaryService {
  private readonly paymentProofsFolder = 'payment_proofs';
  private readonly mediaFolder = 'media';

  async uploadPaymentProof(
    buffer: Buffer,
    customerId: string,
    orderId: string
  ): Promise<CloudinaryUploadResult> {
    const publicId = `${this.paymentProofsFolder}/${customerId}/${orderId}_${Date.now()}`;

    try {
      const result = await this.uploadBuffer(buffer, {
        public_id: publicId,
        resource_type: 'image',
        folder: this.paymentProofsFolder,
        transformation: [
          { quality: 'auto:good' },
          { fetch_format: 'auto' },
        ],
      });

      logger.info({ publicId, orderId }, 'Payment proof uploaded');

      return result;
    } catch (error) {
      logger.error({ error, orderId }, 'Failed to upload payment proof');
      throw error;
    }
  }

  async uploadMedia(
    buffer: Buffer,
    options: {
      customerId: string;
      messageId: string;
      resourceType?: 'image' | 'video' | 'raw' | 'auto';
      format?: string;
    }
  ): Promise<CloudinaryUploadResult> {
    const publicId = `${this.mediaFolder}/${options.customerId}/${options.messageId}_${Date.now()}`;

    try {
      const result = await this.uploadBuffer(buffer, {
        public_id: publicId,
        resource_type: options.resourceType || 'auto',
        folder: this.mediaFolder,
      });

      logger.info({ publicId }, 'Media uploaded');

      return result;
    } catch (error) {
      logger.error({ error }, 'Failed to upload media');
      throw error;
    }
  }

  private uploadBuffer(
    buffer: Buffer,
    options: {
      public_id: string;
      resource_type?: 'image' | 'video' | 'raw' | 'auto';
      folder?: string;
      transformation?: object[];
    }
  ): Promise<CloudinaryUploadResult> {
    return new Promise((resolve, reject) => {
      const uploadStream = cloudinary.uploader.upload_stream(
        {
          public_id: options.public_id,
          resource_type: options.resource_type || 'auto',
          folder: options.folder,
          transformation: options.transformation,
        },
        (error, result) => {
          if (error) {
            reject(error);
          } else if (result) {
            resolve({
              publicId: result.public_id,
              url: result.url,
              secureUrl: result.secure_url,
              format: result.format,
              width: result.width,
              height: result.height,
            });
          } else {
            reject(new Error('Upload failed with no result'));
          }
        }
      );

      const stream = new Readable();
      stream.push(buffer);
      stream.push(null);
      stream.pipe(uploadStream);
    });
  }

  async deleteMedia(publicId: string): Promise<boolean> {
    try {
      const result = await cloudinary.uploader.destroy(publicId);
      logger.info({ publicId, result: result.result }, 'Media deleted');
      return result.result === 'ok';
    } catch (error) {
      logger.error({ error, publicId }, 'Failed to delete media');
      return false;
    }
  }

  async getMediaUrl(
    publicId: string,
    options?: {
      width?: number;
      height?: number;
      crop?: string;
      quality?: string;
    }
  ): Promise<string> {
    const transformation: any[] = [];

    if (options?.width || options?.height) {
      transformation.push({
        width: options.width,
        height: options.height,
        crop: options.crop || 'fill',
      });
    }

    if (options?.quality) {
      transformation.push({ quality: options.quality });
    }

    return cloudinary.url(publicId, {
      secure: true,
      transformation,
    });
  }

  async getSignedUrl(
    publicId: string,
    _expiresInSeconds: number = 3600
  ): Promise<string> {
    return cloudinary.url(publicId, {
      secure: true,
      sign_url: true,
      type: 'authenticated',
    });
  }
}

export const cloudinaryService = new CloudinaryService();
