import { S3Client, PutObjectCommand } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";

const s3Client = new S3Client({
    region: process.env.AWS_REGION || "us-east-1",
    credentials: {
        accessKeyId: process.env.AWS_ACCESS_KEY_ID || "",
        secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY || "",
    },
});

export async function uploadToS3(file: Buffer, fileName: string, contentType: string) {
    const bucketName = process.env.AWS_S3_BUCKET;
    if (!bucketName) throw new Error("AWS_S3_BUCKET not configured");

    const key = `logistica/${Date.now()}-${fileName}`;

    await s3Client.send(
        new PutObjectCommand({
            Bucket: bucketName,
            Key: key,
            Body: file,
            ContentType: contentType,
        })
    );

    return `https://${bucketName}.s3.${process.env.AWS_REGION || "us-east-1"}.amazonaws.com/${key}`;
}
