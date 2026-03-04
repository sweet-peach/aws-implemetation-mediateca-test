import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { jsonResponse, errorResponse, parseBody } from '../shared/response.mjs';
import { S3_BUCKET, CLOUDFRONT_URL } from '../shared/constants.mjs';
import crypto from 'node:crypto';

const s3 = new S3Client({});

export async function handler(event) {
  try {
    if (event.httpMethod === 'OPTIONS') {
      return jsonResponse(200, {});
    }

    if (event.httpMethod !== 'POST') {
      return errorResponse(405, 'Method not allowed');
    }

    const body = parseBody(event);
    const { filename, contentType } = body;

    if (!filename) return errorResponse(400, 'filename is required');
    if (!contentType) return errorResponse(400, 'contentType is required');

    const mediaId = crypto.randomUUID();
    const s3Key = `media/${mediaId}/${filename}`;

    const command = new PutObjectCommand({
      Bucket: S3_BUCKET,
      Key: s3Key,
      ContentType: contentType,
    });

    const uploadUrl = await getSignedUrl(s3, command, { expiresIn: 300 });
    const base = CLOUDFRONT_URL
      ? (CLOUDFRONT_URL.startsWith('http://') || CLOUDFRONT_URL.startsWith('https://')
          ? CLOUDFRONT_URL.replace(/\/+$/, '')
          : `https://${CLOUDFRONT_URL.replace(/^\/+|\/+$/g, '')}`)
      : null;
    const cdnUrl = base ? `${base}/${s3Key}` : `https://${S3_BUCKET}.s3.amazonaws.com/${s3Key}`;

    return jsonResponse(200, { uploadUrl, mediaId, s3Key, cdnUrl });
  } catch (err) {
    console.error('Presign handler error:', err);
    return errorResponse(500, err.message || 'Internal server error');
  }
}
