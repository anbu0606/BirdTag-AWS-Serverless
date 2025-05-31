const AWS = require('aws-sdk');
const s3 = new AWS.S3();

exports.handler = async (event) => {
  try {
    const { fileName, contentType } = JSON.parse(event.body);

  
    const allowedTypes = ['image', 'video', 'audio'];
    const type = contentType.split('/')[0];

    if (!allowedTypes.includes(type)) {
      return {
        statusCode: 400,
        headers: { 'Access-Control-Allow-Origin': '*' },
        body: JSON.stringify({ error: 'Only image, video, or audio files are allowed.' }),
      };
    }

    const bucketName = 'assignment3cc116177249276';
    const key = `${type}/${fileName}`;

   
    try {
      await s3.headObject({ Bucket: bucketName, Key: key }).promise();
      // If no error, file exists
      return {
        statusCode: 409,
        headers: { 'Access-Control-Allow-Origin': '*' },
        body: JSON.stringify({ error: 'A file with the same name already exists.' }),
      };
    } catch (err) {
      if (err.code !== 'NotFound') throw err; // Only ignore NotFound
    }

    const url = s3.getSignedUrl('putObject', {
      Bucket: bucketName,
      Key: key,
      ContentType: contentType,
      Expires: 300 // 5 minutes
    });

    return {
      statusCode: 200,
      headers: { 'Access-Control-Allow-Origin': '*' },
      body: JSON.stringify({ url }),
    };
  } catch (err) {
    return {
      statusCode: 500,
      headers: { 'Access-Control-Allow-Origin': '*' },
      body: JSON.stringify({ error: err.message }),
    };
  }
};
