const AWS = require('aws-sdk');
const s3 = new AWS.S3();

exports.handler = async (event) => {
  try {
    const { fileName, contentType, fileContent } = JSON.parse(event.body);
    const buffer = Buffer.from(fileContent, 'base64');

    const uploadParams = {
      Bucket: 'assignment3cc116177249276',
      Key: `uploads/${fileName}`,
      Body: buffer,
      ContentType: contentType,
    };

    await s3.putObject(uploadParams).promise();

    return {
      statusCode: 200,
      headers: { 'Access-Control-Allow-Origin': '*' },
      body: JSON.stringify({ message: 'Upload successful!' }),
    };
  } catch (err) {
    console.log("Error:", err);
    return {
      statusCode: 500,
      headers: { 'Access-Control-Allow-Origin': '*' },
      body: JSON.stringify({ error: err.message }),
    };
  }
};
