import { S3Client } from '@aws-sdk/client-s3';
import { Upload } from '@aws-sdk/lib-storage';
import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

@Injectable()
export class S3Service {
  private s3Client: S3Client;

  constructor(private configService: ConfigService) {
    this.s3Client = new S3Client({
      region: configService.get('AWS_REGION'),
      credentials: {
        secretAccessKey: configService.get('AWS_SECRET_KEY')!,
        accessKeyId: configService.get('AWS_ACCESS_KEY')!,
      },
    });
  }

  async uploadFile(file: { buffer: Buffer; mimetype: string }, key: string) {
    const bucket = this.configService.get('AWS_BUCKET') as string;
    const upload = new Upload({
      client: this.s3Client,
      params: {
        Bucket: bucket,
        Key: key,
        Body: file.buffer,
        ContentType: file.mimetype,
      },
    });

    upload.on('httpUploadProgress', (progress) => console.log(progress));

    await upload.done();

    return `https://${bucket}.s3.${process.env.AWS_REGION}.amazonaws.com/${key}`;
  }
}
