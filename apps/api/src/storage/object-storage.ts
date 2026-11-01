import { S3Client, GetObjectCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { Row } from '../database/database';
let client:S3Client|undefined;
/** Call only after the row has passed tenant and user authorization. */
export async function attachPhoto<T extends Row>(row:T):Promise<T & {photo_url:string|null}>{
  if(!row.photo_key||!process.env.S3_BUCKET)return {...row,photo_url:null};
  client??=new S3Client({region:process.env.S3_REGION||'ap-south-1',endpoint:process.env.S3_ENDPOINT||undefined,forcePathStyle:!!process.env.S3_ENDPOINT});
  return {...row,photo_url:await getSignedUrl(client,new GetObjectCommand({Bucket:process.env.S3_BUCKET,Key:row.photo_key}),{expiresIn:600})};
}
